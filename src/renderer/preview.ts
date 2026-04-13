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

  renderToHtml(markdownText: string): string {
    return this.md.render(markdownText);
  }

  private async renderMermaidDiagrams(): Promise<void> {
    const mermaidBlocks = this.container.querySelectorAll('pre.mermaid');
    if (mermaidBlocks.length === 0) return;

    if (!this.mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'strict',
        fontFamily: 'sans-serif',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          wrappingWidth: 200,
          padding: 15,
          nodeSpacing: 50,
          rankSpacing: 60,
        },
      });
      this.mermaidInitialized = true;
    }

    for (const block of mermaidBlocks) {
      const pre = block as HTMLElement;
      const code = pre.textContent || '';
      const id = pre.id || `mermaid-${Date.now()}`;

      try {
        const { svg } = await mermaid.render(id + '-svg', code);
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-rendered';
        wrapper.innerHTML = svg;
        pre.parentElement!.replaceChild(wrapper, pre);
      } catch (err) {
        pre.classList.add('mermaid-error');
        pre.textContent = `Błąd diagramu Mermaid:\n${(err as Error).message}\n\n${code}`;
      }
    }
  }

  setTheme(dark: boolean): void {
    this.mermaidInitialized = false;
    mermaid.initialize({
      startOnLoad: false,
      theme: dark ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: 'sans-serif',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        wrappingWidth: 200,
        padding: 15,
        nodeSpacing: 50,
        rankSpacing: 60,
      },
    });
    this.mermaidInitialized = true;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
