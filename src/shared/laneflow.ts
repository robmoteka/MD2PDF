/**
 * Shared LaneFlow rendering helper.
 *
 * Used by:
 *   - src/main/ipc-handlers.ts  (Electron IPC, serves the renderer process)
 *   - src/cli/cli.ts             (Puppeteer PDF pipeline)
 *
 * NEVER imported by src/renderer/* — @laneflow/renderer depends on
 * @resvg/resvg-js (native binding) and cannot run inside Chromium.
 *
 * Both @laneflow packages are pure ESM. This module is compiled to CJS
 * (tsconfig.main.json / tsconfig.cli.json both use "module": "commonjs"),
 * so all ESM imports must be dynamic. Modules are cached after first load.
 */

import type { ParseResult, Document } from '@laneflow/parser';
import type { RenderOptions } from '@laneflow/renderer';

// ─── Public types ─────────────────────────────────────────────────────────────

export type LaneflowTheme = 'light' | 'dark';
export type LaneflowDirection = 'TB' | 'LR';

export interface LaneflowRenderOptions {
  theme: LaneflowTheme;
  direction?: LaneflowDirection;
}

// ─── Lazy ESM module cache ────────────────────────────────────────────────────

interface LazyModules {
  parse: (source: string) => ParseResult;
  renderToSvg: (input: string | Document, options?: RenderOptions) => string;
}

let _modules: LazyModules | null = null;

async function getModules(): Promise<LazyModules> {
  if (_modules !== null) return _modules;

  const [parserMod, rendererMod] = await Promise.all([
    import('@laneflow/parser'),
    import('@laneflow/renderer'),
  ]);

  const loaded: LazyModules = {
    parse: parserMod.parse,
    renderToSvg: rendererMod.renderToSvg,
  };
  _modules = loaded;
  return loaded;
}

// ─── Info-string parser ───────────────────────────────────────────────────────

/**
 * Parse the fence info-string after "laneflow".
 *
 * Examples:
 *   "laneflow"     → {}
 *   "laneflow LR"  → { direction: 'LR' }
 *   "laneflow TB"  → { direction: 'TB' }
 *   "laneflow lr"  → { direction: 'LR' }   (case-insensitive)
 *   "laneflow xyz" → {}                    (unknown tokens ignored)
 */
export function parseLaneflowInfo(info: string): { direction?: LaneflowDirection } {
  const tokens = info.trim().split(/\s+/).slice(1); // drop 'laneflow' itself
  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (upper === 'LR' || upper === 'TB') {
      return { direction: upper as LaneflowDirection };
    }
  }
  return {};
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

/**
 * Render a LaneFlow source string to an HTML snippet ready for insertion.
 *
 * On success: returns `<div class="laneflow-rendered">…SVG…</div>`
 * On error:   returns `<pre class="laneflow-error">…message…</pre>`
 *
 * Never rejects — all errors are captured and rendered inline so they
 * appear in the PDF rather than silently disappearing.
 */
export async function renderLaneflowFence(
  source: string,
  opts: LaneflowRenderOptions,
): Promise<string> {
  let modules: LazyModules;
  try {
    modules = await getModules();
  } catch (err) {
    return errorBlock(source, `Failed to load LaneFlow modules:\n${(err as Error).message}`);
  }

  const { parse, renderToSvg } = modules;

  // Phase 1: parse — produce detailed error block on failure
  let parseResult: ParseResult;
  try {
    parseResult = parse(source);
  } catch (err) {
    return errorBlock(source, `Internal parser exception:\n${(err as Error).message}`);
  }

  if (parseResult.errors.length > 0) {
    const errorLines = parseResult.errors
      .map(e => `  [${e.code}] line ${e.line}: ${e.message}`)
      .join('\n');
    return errorBlock(source, `LaneFlow parse errors:\n${errorLines}`);
  }

  // Phase 2: render — capture renderer exceptions too
  try {
    const renderOpts: RenderOptions = {
      theme: opts.theme,
      ...(opts.direction !== undefined ? { direction: opts.direction } : {}),
    };
    const svg = renderToSvg(parseResult.document, renderOpts);
    return `<div class="laneflow-rendered">${svg}</div>`;
  } catch (err) {
    return errorBlock(source, `LaneFlow render error:\n${(err as Error).message}`);
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function errorBlock(source: string, message: string): string {
  return `<pre class="laneflow-error">${escapeHtml(message)}\n\n--- source ---\n${escapeHtml(source)}</pre>`;
}
