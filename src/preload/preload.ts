import { contextBridge, ipcRenderer } from 'electron';
import { FileResult, MenuAction } from '../shared/types';

contextBridge.exposeInMainWorld('api', {
  // File operations
  openFile: (): Promise<FileResult | null> => ipcRenderer.invoke('file:open'),
  saveFile: (filePath: string, content: string): Promise<string | null> =>
    ipcRenderer.invoke('file:save', filePath, content),
  saveFileAs: (content: string): Promise<string | null> =>
    ipcRenderer.invoke('file:save-as', content),

  // PDF export
  exportPdf: (html: string, css: string): Promise<string | null> =>
    ipcRenderer.invoke('pdf:export', html, css),

  // Window
  setTitle: (title: string): Promise<void> => ipcRenderer.invoke('app:title', title),

  // Menu actions from main process
  onMenuAction: (callback: (action: MenuAction) => void): void => {
    ipcRenderer.on('menu:action', (_event, action: MenuAction) => {
      callback(action);
    });
  },
});
