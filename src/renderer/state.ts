export class DocumentState {
  private _filePath: string | null = null;
  private _content: string = '';
  private _savedContent: string = '';
  private _onChangeCallbacks: Array<() => void> = [];

  get filePath(): string | null {
    return this._filePath;
  }

  get content(): string {
    return this._content;
  }

  get modified(): boolean {
    return this._content !== this._savedContent;
  }

  get fileName(): string {
    if (!this._filePath) return 'Nowy dokument';
    const parts = this._filePath.split('/');
    return parts[parts.length - 1];
  }

  setContent(content: string): void {
    this._content = content;
    this.notifyChange();
  }

  loadFile(filePath: string, content: string): void {
    this._filePath = filePath;
    this._content = content;
    this._savedContent = content;
    this.notifyChange();
  }

  markSaved(filePath?: string): void {
    if (filePath) this._filePath = filePath;
    this._savedContent = this._content;
    this.notifyChange();
  }

  newDocument(): void {
    this._filePath = null;
    this._content = '';
    this._savedContent = '';
    this.notifyChange();
  }

  onChange(callback: () => void): void {
    this._onChangeCallbacks.push(callback);
  }

  private notifyChange(): void {
    for (const cb of this._onChangeCallbacks) {
      cb();
    }
  }
}
