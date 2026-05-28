import MarkdownIt from 'markdown-it';
import mermaid from 'mermaid';
import type { LaneflowThemeIpc, LaneflowDirectionIpc } from '../shared/types';

// ─── LaneFlow placeholder types ───────────────────────────────────────────────

interface LaneflowPending {
  id: number;
  source: string;
  direction?: LaneflowDirectionIpc;
}

// ─── Preview class ────────────────────────────────────────────────────────────

export class MarkdownPreview {
  private container: HTMLElement;
  private md: MarkdownIt;
  private mermaidInitialized = false;
  private isDark = false;

  // LaneFlow state — reset on each render()
  private laneflowPending: LaneflowPending[] = [];
  private laneflowCounter = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      breaks: false,
    });

    // Override fence renderer to handle mermaid and laneflow blocks
    const defaultFence = this.md.renderer.rules.fence!.bind(this.md.renderer.rules);
    this.md.renderer.rules.fence = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const info = token.info.trim();
      const lang = info.split(/\s+/)[0].toLowerCase();

      if (lang === 'mermaid') {
        const id = `mermaid-${idx}-${Date.now()}`;
        return `<div class="mermaid-container"><pre class="mermaid" id="${id}">${this.escapeHtml(token.content)}</pre></div>`;
      }

      if (lang === 'laneflow') {
        const id = this.laneflowCounter++;
        const direction = this.parseLaneflowDirection(info);
        this.laneflowPending.push({ id, source: token.content, direction });
        return `<div class="laneflow-placeholder" data-laneflow-id="${id}"></div>`;
      }

      return defaultFence(tokens, idx, options, env, self);
    };
  }

  async render(markdownText: string): Promise<void> {
    // Reset laneflow state before each render
    this.laneflowPending = [];
    this.laneflowCounter = 0;

    const html = this.md.render(markdownText)
      .replace(/<!--\s*pagebreak\s*-->/gi, '<div class="pdf-page-break"></div>');
    this.container.innerHTML = html;

    // Run both diagram passes concurrently
    await Promise.all([
      this.renderMermaidDiagrams(),
      this.renderLaneflowDiagrams(),
    ]);
  }

  getRenderedHtml(): string {
    return this.container.innerHTML;
  }

  getPdfHtml(): string {
    return this.container.innerHTML;
  }

  renderToHtml(markdownText: string): string {
    return this.md.render(markdownText);
  }

  private buildMermaidConfig(dark: boolean): Parameters<typeof mermaid.initialize>[0] {
    return {
      startOnLoad: false,
      theme: dark ? 'dark' : 'default',
      themeVariables: dark
        ? {}
        : {
            clusterBkg: '#efefef',
            clusterBorder: '#aaaaaa',
          },
      securityLevel: 'strict',
      fontFamily: 'sans-serif',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        wrappingWidth: 400,
        padding: 24,
        nodeSpacing: 50,
        rankSpacing: 60,
      },
    };
  }

  private async renderMermaidDiagrams(): Promise<void> {
    const mermaidBlocks = this.container.querySelectorAll('pre.mermaid');
    if (mermaidBlocks.length === 0) return;

    if (!this.mermaidInitialized) {
      mermaid.initialize(this.buildMermaidConfig(this.isDark));
      this.mermaidInitialized = true;
    }

    for (const block of mermaidBlocks) {
      const pre = block as HTMLElement;
      const code = (pre.textContent || '').replace(/\\n/g, '<br/>');
      const id = pre.id || `mermaid-${Date.now()}`;

      try {
        const { svg } = await mermaid.render(id + '-svg', code);
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-rendered';
        wrapper.innerHTML = svg;
        this.fixSvgClipping(wrapper);
        pre.parentElement!.replaceChild(wrapper, pre);
      } catch (err) {
        pre.classList.add('mermaid-error');
        pre.textContent = `Błąd diagramu Mermaid:\n${(err as Error).message}\n\n${code}`;
      }
    }
  }

  /**
   * Async pass: replaces all laneflow placeholder divs with SVG rendered
   * in the main process via IPC. All diagrams are requested concurrently.
   */
  private async renderLaneflowDiagrams(): Promise<void> {
    const pending = this.laneflowPending;
    if (pending.length === 0) return;

    const theme: LaneflowThemeIpc = this.isDark ? 'dark' : 'light';

    // Fire all IPC calls concurrently, then apply results
    const results = await Promise.all(
      pending.map(async p => {
        const { html } = await window.api.renderLaneflow({
          source: p.source,
          theme,
          direction: p.direction,
        });
        return { id: p.id, html };
      }),
    );

    for (const { id, html } of results) {
      const placeholder = this.container.querySelector(
        `[data-laneflow-id="${id}"]`,
      ) as HTMLElement | null;
      if (placeholder) {
        placeholder.outerHTML = html;
      }
    }
  }

  setTheme(dark: boolean): void {
    this.isDark = dark;
    this.mermaidInitialized = false;
    mermaid.initialize(this.buildMermaidConfig(dark));
    this.mermaidInitialized = true;
  }

  /**
   * Mermaid 10 sets overflow:hidden and a tight viewBox on the SVG.
   * Edge labels between subgraphs often fall outside that viewBox and get clipped.
   * We expand the viewBox by a fixed padding on all sides so every label is visible.
   */
  private fixSvgClipping(wrapper: HTMLElement): void {
    const svgEl = wrapper.querySelector('svg');
    if (!svgEl) return;

    svgEl.removeAttribute('overflow');
    svgEl.style.overflow = 'visible';

    const vb = svgEl.getAttribute('viewBox');
    if (!vb) return;

    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return;

    const [x, y, w, h] = parts;
    const padX = 20;
    const padY = 50;

    svgEl.setAttribute('viewBox', `${x - padX} ${y - padY} ${w + 2 * padX} ${h + 2 * padY}`);
    svgEl.style.width = '100%';
    svgEl.style.height = 'auto';
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Extract direction token from a laneflow fence info-string.
   * "laneflow LR" → 'LR', "laneflow TB" → 'TB', "laneflow" → undefined
   */
  private parseLaneflowDirection(info: string): LaneflowDirectionIpc | undefined {
    const tokens = info.trim().split(/\s+/).slice(1);
    for (const token of tokens) {
      const upper = token.toUpperCase();
      if (upper === 'LR' || upper === 'TB') return upper as LaneflowDirectionIpc;
    }
    return undefined;
  }
}
