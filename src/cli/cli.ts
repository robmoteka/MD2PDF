#!/usr/bin/env node
/**
 * MD2PDF CLI
 * Konwertuje pliki Markdown do PDF bez uruchamiania GUI.
 * Działa w cron, pipeline CI/CD, terminalach bez środowiska graficznego.
 *
 * Użycie:
 *   node dist/cli/cli.js <plik.md> [--out output.pdf]
 *   node dist/cli/cli.js <katalog/>  [--out /katalog-wyjsciowy/]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import puppeteer from 'puppeteer';
import MarkdownIt from 'markdown-it';
import { renderLaneflowFence, parseLaneflowInfo } from '../shared/laneflow.js';
import type { LaneflowTheme } from '../shared/laneflow.js';

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { input: string; out: string | null; help: boolean; theme: LaneflowTheme } {
  const args = argv.slice(2);
  let input = '';
  let out: string | null = null;
  let help = false;
  let theme: LaneflowTheme = 'light';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      help = true;
    } else if (args[i] === '--out' || args[i] === '-o') {
      out = args[++i] ?? null;
    } else if (args[i] === '--theme') {
      const val = args[++i];
      if (val === 'dark' || val === 'light') {
        theme = val;
      } else {
        console.error(`Błąd: nieznany motyw "${val}". Dozwolone: light, dark.`);
        process.exit(1);
      }
    } else if (!input) {
      input = args[i];
    }
  }

  return { input, out, help, theme };
}

function printHelp(): void {
  console.log(`
MD2PDF CLI — konwertuje Markdown do PDF (z obsługą diagramów Mermaid i LaneFlow)

Użycie:
  node dist/cli/cli.js <wejście> [opcje]

Argumenty:
  <wejście>       Ścieżka do pliku .md lub katalogu z plikami .md

Opcje:
  --out, -o <ścieżka>   Plik wyjściowy (.pdf) lub katalog wyjściowy
                         Domyślnie: obok pliku wejściowego
  --theme <motyw>       Motyw dla diagramów LaneFlow: light (domyślnie) lub dark
  --help, -h            Pokaż tę pomoc

Przykłady:
  node dist/cli/cli.js dokument.md
  node dist/cli/cli.js dokument.md --out /tmp/dokument.pdf
  node dist/cli/cli.js dokument.md --theme dark
  node dist/cli/cli.js /moje/notatki/
  node dist/cli/cli.js /moje/notatki/ --out /pdfs/
`);
}

// ─── File discovery ───────────────────────────────────────────────────────────

interface ConvertJob {
  inputPath: string;
  outputPath: string;
}

function resolveJobs(input: string, out: string | null): ConvertJob[] {
  const absInput = path.resolve(input);

  if (!fs.existsSync(absInput)) {
    throw new Error(`Nie znaleziono: ${absInput}`);
  }

  const stat = fs.statSync(absInput);

  if (stat.isFile()) {
    // Pojedynczy plik
    const outputPath = resolveOutputPath(absInput, out, false);
    return [{ inputPath: absInput, outputPath }];
  }

  if (stat.isDirectory()) {
    // Wszystkie .md w katalogu (nierekurencyjnie)
    const files = fs.readdirSync(absInput)
      .filter(f => /\.(md|markdown)$/i.test(f))
      .map(f => path.join(absInput, f));

    if (files.length === 0) {
      throw new Error(`Brak plików .md w katalogu: ${absInput}`);
    }

    return files.map(f => ({
      inputPath: f,
      outputPath: resolveOutputPath(f, out, true),
    }));
  }

  throw new Error(`Nieobsługiwany typ wejścia: ${absInput}`);
}

function resolveOutputPath(inputPath: string, out: string | null, isDir: boolean): string {
  const baseName = path.basename(inputPath).replace(/\.(md|markdown)$/i, '');

  if (!out) {
    // Domyślnie: obok pliku wejściowego
    return path.join(path.dirname(inputPath), `${baseName}.pdf`);
  }

  const absOut = path.resolve(out);

  // Jeśli out kończy się / lub jest katalogiem → zapis do katalogu
  if (out.endsWith('/') || out.endsWith(path.sep) || isDir) {
    fs.mkdirSync(absOut, { recursive: true });
    return path.join(absOut, `${baseName}.pdf`);
  }

  // Pojedynczy plik wyjściowy
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  return absOut;
}

// ─── Markdown rendering ───────────────────────────────────────────────────────

interface LaneflowPending {
  id: number;
  source: string;
  direction?: import('../shared/laneflow.js').LaneflowDirection;
}

interface MarkdownRenderer {
  md: MarkdownIt;
  /** Returns LaneFlow blocks collected during the last md.render() call. */
  getPending: () => LaneflowPending[];
}

function buildMarkdownRenderer(): MarkdownRenderer {
  const pending: LaneflowPending[] = [];
  let counter = 0;

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false,
  });

  const defaultFence = md.renderer.rules.fence!.bind(md.renderer.rules);
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = token.info.trim();
    const lang = info.split(/\s+/)[0].toLowerCase();

    if (lang === 'laneflow') {
      const id = counter++;
      const { direction } = parseLaneflowInfo(info);
      pending.push({ id, source: token.content, direction });
      // Placeholder replaced asynchronously after md.render()
      return `<div class="laneflow-placeholder" data-laneflow-id="${id}"></div>`;
    }

    if (lang === 'mermaid') {
      const escaped = token.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      return `<div class="mermaid-container"><pre class="mermaid">${escaped}</pre></div>`;
    }

    return defaultFence(tokens, idx, options, env, self);
  };

  return {
    md,
    getPending: () => pending,
  };
}

/**
 * Replace all laneflow placeholders in bodyHtml with rendered SVG (or error blocks).
 * LaneFlow SVG is pre-rendered in Node — no browser-side script needed.
 */
async function resolveLaneflowPlaceholders(
  bodyHtml: string,
  pending: LaneflowPending[],
  theme: LaneflowTheme,
): Promise<string> {
  if (pending.length === 0) return bodyHtml;

  // Render all diagrams concurrently
  const rendered = await Promise.all(
    pending.map(async p => ({
      id: p.id,
      html: await renderLaneflowFence(p.source, { theme, direction: p.direction }),
    })),
  );

  let result = bodyHtml;
  for (const { id, html } of rendered) {
    result = result.replace(
      `<div class="laneflow-placeholder" data-laneflow-id="${id}"></div>`,
      html,
    );
  }
  return result;
}

// ─── CSS loading ──────────────────────────────────────────────────────────────

function loadCss(): string {
  // Szukamy assets/ względem miejsca, gdzie jest zainstalowany projekt
  const projectRoot = path.resolve(__dirname, '..', '..');
  const previewCssPath = path.join(projectRoot, 'assets', 'styles', 'preview.css');
  const pdfCssPath = path.join(projectRoot, 'assets', 'styles', 'pdf.css');

  let css = '';
  try { css += fs.readFileSync(previewCssPath, 'utf-8') + '\n'; } catch { /* brak pliku — pomiń */ }
  try { css += fs.readFileSync(pdfCssPath, 'utf-8'); } catch { /* brak pliku — pomiń */ }
  return css;
}

// ─── HTML assembly ────────────────────────────────────────────────────────────

function buildFullHtml(bodyHtml: string, css: string): string {
  // Ścieżka do mermaid.min.js z node_modules
  const projectRoot = path.resolve(__dirname, '..', '..');
  const mermaidJs = path.join(projectRoot, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
  const mermaidSrc = `file://${mermaidJs}`;

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<style>
${css}
</style>
</head>
<body class="pdf-body">
${bodyHtml}
<script src="${mermaidSrc}"></script>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof mermaid === 'undefined') {
      window.__mermaidDone = true;
      return;
    }

    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'sans-serif',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        wrappingWidth: 400,
        padding: 24,
        nodeSpacing: 50,
        rankSpacing: 60,
      },
    });

    // Replikacja transformacji \\n → <br/> z preview.ts
    document.querySelectorAll('pre.mermaid').forEach(pre => {
      pre.textContent = (pre.textContent || '').replace(/\\\\n/g, '<br/>');
    });

    try {
      await mermaid.run();
    } catch (e) {
      console.error('Mermaid error:', e);
    }

    window.__mermaidDone = true;
  });
</script>
</body>
</html>`;
}

// ─── PDF generation ───────────────────────────────────────────────────────────

async function convertFile(
  job: ConvertJob,
  css: string,
  renderer: MarkdownRenderer,
  theme: LaneflowTheme,
): Promise<void> {
  const markdown = fs.readFileSync(job.inputPath, 'utf-8');
  const rawBodyHtml = renderer.md.render(markdown);
  const bodyHtml = await resolveLaneflowPlaceholders(rawBodyHtml, renderer.getPending(), theme);
  const fullHtml = buildFullHtml(bodyHtml, css);

  // Zapisz do pliku tymczasowego (Puppeteer wymaga file:// dla lokalnych zasobów)
  const tmpFile = path.join(os.tmpdir(), `md2pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmpFile, fullHtml, 'utf-8');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(`file://${tmpFile}`, { waitUntil: 'domcontentloaded' });

    // Czekaj na zakończenie renderowania Mermaid
    const hasMermaid = bodyHtml.includes('class="mermaid"');
    if (hasMermaid) {
      await page.waitForFunction('window.__mermaidDone === true', { timeout: 15000 });
    }

    await page.pdf({
      path: job.outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
    });
  } finally {
    await browser?.close();
    try { fs.unlinkSync(tmpFile); } catch { /* ignoruj */ }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { input, out, help, theme } = parseArgs(process.argv);

  if (help || !input) {
    printHelp();
    process.exit(help ? 0 : 1);
  }

  let jobs: ConvertJob[];
  try {
    jobs = resolveJobs(input, out);
  } catch (err) {
    console.error(`Błąd: ${(err as Error).message}`);
    process.exit(1);
  }

  const css = loadCss();
  let failed = 0;

  for (const job of jobs) {
    const rel = path.relative(process.cwd(), job.inputPath);
    process.stdout.write(`  Konwertuję: ${rel} → ${path.relative(process.cwd(), job.outputPath)} ... `);
    try {
      // Fresh renderer per file — pending list must be reset between documents
      const renderer = buildMarkdownRenderer();
      await convertFile(job, css, renderer, theme);
      console.log('✓');
    } catch (err) {
      console.log(`✗ ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\nGotowe: ${jobs.length - failed}/${jobs.length} plików`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Nieoczekiwany błąd:', err);
  process.exit(1);
});
