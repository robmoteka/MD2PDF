import { contextBridge, ipcRenderer } from 'electron';
import { FileResult, ExportAllItem, ExportAllResult, PdfOptions, MenuAction, LaneflowRenderRequest, LaneflowRenderResponse } from '../shared/types';

contextBridge.exposeInMainWorld('api', {
  // File operations
  openFile: (): Promise<FileResult[]> => ipcRenderer.invoke('file:open'),
  saveFile: (filePath: string, content: string): Promise<string | null> =>
    ipcRenderer.invoke('file:save', filePath, content),
  saveFileAs: (content: string): Promise<string | null> =>
    ipcRenderer.invoke('file:save-as', content),

  // PDF export
  exportPdf: (html: string, css: string, options: PdfOptions): Promise<string | null> =>
    ipcRenderer.invoke('pdf:export', html, css, options),
  exportAllPdf: (items: ExportAllItem[], options: PdfOptions): Promise<ExportAllResult[] | null> =>
    ipcRenderer.invoke('pdf:export-all', items, options),

  // Window
  setTitle: (title: string): Promise<void> => ipcRenderer.invoke('app:title', title),

  // Menu actions from main process
  onMenuAction: (callback: (action: MenuAction) => void): void => {
    ipcRenderer.on('menu:action', (_event, action: MenuAction) => {
      callback(action);
    });
  },

  // File watching (auto-reload)
  readFile: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('file:read', filePath),
  watchFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('file:watch', filePath),
  unwatchFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('file:unwatch', filePath),
  onFileChanged: (callback: (filePath: string) => void): void => {
    ipcRenderer.on('file:changed', (_event, filePath: string) => callback(filePath));
  },

  // LaneFlow diagram rendering (delegated to main process / Node)
  renderLaneflow: (req: LaneflowRenderRequest): Promise<LaneflowRenderResponse> =>
    ipcRenderer.invoke('laneflow:render', req),
});
