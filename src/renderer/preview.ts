import MarkdownIt from 'markdown-it';
import mermaid from 'mermaid';

export class MarkdownPreview {
  private container: HTMLElement;
  private md: MarkdownIt;
  private mermaidInitialized = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      breaks: false,
    });

    // Override fence renderer to handle mermaid blocks
    const defaultFence = this.md.renderer.rules.fence!.bind(this.md.renderer.rules);
    this.md.renderer.rules.fence = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      if (token.info.trim().toLowerCase() === 'mermaid') {
        const id = `mermaid-${idx}-${Date.now()}`;
        return `<div class="mermaid-container"><pre class="mermaid" id="${id}">${this.escapeHtml(token.content)}</pre></div>`;
      }
      return defaultFence(tokens, idx, options, env, self);
    };
  }

  async render(markdownText: string): Promise<void> {
    const html = this.md.render(markdownText);
    this.container.innerHTML = html;
    await this.renderMermaidDiagrams();
  }

  getRenderedHtml(): string {
    return this.container.innerHTML;
  }

  /**
   * Zwraca HTML przygotowany do eksportu PDF.
   * Przed każdym nagłówkiem, który poprzedza diagram Mermaid,
   * wstawia znacznik page-break (widoczny tylko w CSS PDF).
   */
  getPdfHtml(): string {
    this.insertDiagramPageBreaks();
    const html = this.container.innerHTML;
    this.removeDiagramPageBreaks();
    return html;
  }

  private insertDiagramPageBreaks(): void {
    const containers = this.container.querySelectorAll('.mermaid-container');
    for (const container of containers) {
      // Idź wstecz po rodzeństwie, znajdź najbliższy nagłówek
      let sibling = container.previousElementSibling;
      let nearestHeading: Element | null = null;
      while (sibling) {
        if (/^H[1-6]$/.test(sibling.tagName)) {
          nearestHeading = sibling;
          break;
        }
        sibling = sibling.previousElementSibling;
      }
      if (nearestHeading) {
        const pageBreak = document.createElement('div');
        pageBreak.className = 'diagram-page-break';
        nearestHeading.parentNode!.insertBefore(pageBreak, nearestHeading);
      }
    }
  }

  private removeDiagramPageBreaks(): void {
    this.container.querySelectorAll('.diagram-page-break').forEach(el => el.remove());
  }

  renderToHtml(markdownText: string): string {
    return this.md.render(markdownText);
  }

  private buildMermaidConfig(dark: boolean): Parameters<typeof mermaid.initialize>[0] {
    return {
      startOnLoad: false,
      theme: dark ? 'dark' : 'default',
      // Override default yellow (#ffffde) subgraph fills with light gray
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
        // Wider wrap threshold — prevents narrow nodes from clipping long labels
        wrappingWidth: 400,
        // Extra padding so node borders never overlap label text
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
      mermaid.initialize(this.buildMermaidConfig(false));
      this.mermaidInitialized = true;
    }

    for (const block of mermaidBlocks) {
      const pre = block as HTMLElement;
      // Replace literal \n escape sequences with <br/> so Mermaid renders them
      // as line breaks in labels (both flowchart nodes and sequence messages).
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

  setTheme(dark: boolean): void {
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

    // Remove Mermaid's inline overflow restriction
    svgEl.removeAttribute('overflow');
    svgEl.style.overflow = 'visible';

    // Expand viewBox so labels outside the original bounds become visible
    const vb = svgEl.getAttribute('viewBox');
    if (!vb) return;

    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return;

    const [x, y, w, h] = parts;
    const padX = 20;  // horizontal margin (px in SVG user units)
    const padY = 50;  // vertical margin — edge labels need more room above/below

    svgEl.setAttribute('viewBox', `${x - padX} ${y - padY} ${w + 2 * padX} ${h + 2 * padY}`);
    // Keep the rendered width unchanged; height scales proportionally via CSS
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
}
