import { DocumentState } from './state';

export interface Tab {
  id: string;
  doc: DocumentState;
  scrollTop: number;
}

let nextId = 1;

export class TabManager {
  private tabs: Tab[] = [];
  private _activeId: string | null = null;
  private _onChangeCallbacks: Array<() => void> = [];

  get activeTab(): Tab | null {
    return this.tabs.find(t => t.id === this._activeId) || null;
  }

  get activeDoc(): DocumentState | null {
    return this.activeTab?.doc || null;
  }

  get allTabs(): ReadonlyArray<Tab> {
    return this.tabs;
  }

  get count(): number {
    return this.tabs.length;
  }

  createTab(filePath?: string, content?: string): Tab {
    const doc = new DocumentState();
    if (filePath && content !== undefined) {
      doc.loadFile(filePath, content);
    }
    const tab: Tab = {
      id: `tab-${nextId++}`,
      doc,
      scrollTop: 0,
    };
    this.tabs.push(tab);
    this._activeId = tab.id;
    this.notifyChange();
    return tab;
  }

  activate(id: string): Tab | null {
    const tab = this.tabs.find(t => t.id === id);
    if (!tab) return null;
    this._activeId = id;
    this.notifyChange();
    return tab;
  }

  closeTab(id: string): Tab | null {
    const idx = this.tabs.findIndex(t => t.id === id);
    if (idx === -1) return null;

    this.tabs.splice(idx, 1);

    if (this._activeId === id) {
      if (this.tabs.length > 0) {
        const newIdx = Math.min(idx, this.tabs.length - 1);
        this._activeId = this.tabs[newIdx].id;
      } else {
        this._activeId = null;
      }
    }

    this.notifyChange();
    return this.activeTab;
  }

  findByPath(filePath: string): Tab | null {
    return this.tabs.find(t => t.doc.filePath === filePath) || null;
  }

  hasUnsaved(): boolean {
    return this.tabs.some(t => t.doc.modified);
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
