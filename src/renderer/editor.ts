import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

export class MarkdownEditor {
  private view: EditorView;
  private onChangeCallback: ((content: string) => void) | null = null;

  constructor(parent: HTMLElement) {
    const state = EditorState.create({
      doc: '',
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ codeLanguages: languages }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && this.onChangeCallback) {
            this.onChangeCallback(this.getContent());
          }
        }),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': { overflow: 'auto', fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" },
          '.cm-content': { padding: '12px 16px' },
          '.cm-gutters': { minWidth: '40px' },
        }),
      ],
    });

    this.view = new EditorView({ state, parent });
  }

  getContent(): string {
    return this.view.state.doc.toString();
  }

  setContent(content: string): void {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: content },
    });
  }

  onContentChange(callback: (content: string) => void): void {
    this.onChangeCallback = callback;
  }

  getCursorPosition(): { line: number; col: number } {
    const pos = this.view.state.selection.main.head;
    const line = this.view.state.doc.lineAt(pos);
    return { line: line.number, col: pos - line.from + 1 };
  }

  focus(): void {
    this.view.focus();
  }
}
