import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { exportPdf } from './pdf-export';
import { FileResult, ExportAllItem, ExportAllResult, PdfOptions, LaneflowRenderRequest, LaneflowRenderResponse } from '../shared/types';
import {
  getLastOpenDir,
  setLastOpenDir,
  getLastSaveDir,
  setLastSaveDir,
} from './settings';
import { renderLaneflowFence } from '../shared/laneflow';

export function registerIpcHandlers(win: BrowserWindow): void {
  // --- File watchers ---
  const watchers = new Map<string, fs.FSWatcher>();
  const debounceTimers = new Map<string, NodeJS.Timeout>();

  win.on('closed', () => {
    watchers.forEach(w => w.close());
    watchers.clear();
    debounceTimers.forEach(t => clearTimeout(t));
    debounceTimers.clear();
  });

  // Czyta plik bez dialogu (do auto-reload)
  ipcMain.handle('file:read', async (_e, filePath: string): Promise<string | null> => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  });

  // Uruchamia obserwator dla pliku
  ipcMain.handle('file:watch', async (_e, filePath: string): Promise<void> => {
    if (watchers.has(filePath)) return;
    try {
      const watcher = fs.watch(filePath, (eventType) => {
        if (eventType !== 'change') return; // pomiń 'rename' (usunięcie pliku)
        const prev = debounceTimers.get(filePath);
        if (prev) clearTimeout(prev);
        const t = setTimeout(() => {
          debounceTimers.delete(filePath);
          if (!win.isDestroyed()) win.webContents.send('file:changed', filePath);
        }, 300);
        debounceTimers.set(filePath, t);
      });
      watchers.set(filePath, watcher);
    } catch {
      // Ignoruj błędy (np. plik nie istnieje)
    }
  });

  // Zatrzymuje obserwator
  ipcMain.handle('file:unwatch', async (_e, filePath: string): Promise<void> => {
    watchers.get(filePath)?.close();
    watchers.delete(filePath);
    const t = debounceTimers.get(filePath);
    if (t) { clearTimeout(t); debounceTimers.delete(filePath); }
  });

  function focusForDialog(): void {
    if (process.platform === 'linux') {
      win.focus();
      return;
    }

    win.setAlwaysOnTop(true);
    win.focus();
    win.setAlwaysOnTop(false);
  }

  async function showOpenDialogSafe(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
    // Linux native GTK dialogs can log invalid cast warnings with parented dialogs.
    return process.platform === 'linux'
      ? dialog.showOpenDialog(options)
      : dialog.showOpenDialog(win, options);
  }

  async function showSaveDialogSafe(options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> {
    return process.platform === 'linux'
      ? dialog.showSaveDialog(options)
      : dialog.showSaveDialog(win, options);
  }

  async function showFolderDialogSafe(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
    return process.platform === 'linux'
      ? dialog.showOpenDialog({ ...options, properties: ['openDirectory'] })
      : dialog.showOpenDialog(win, { ...options, properties: ['openDirectory'] });
  }

  // --- Open: supports multi-select, returns array ---
  ipcMain.handle('file:open', async (): Promise<FileResult[]> => {
    focusForDialog();

    const lastDir = getLastOpenDir();
    const result = await showOpenDialogSafe({
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
      properties: ['openFile', 'multiSelections'],
      ...(lastDir ? { defaultPath: lastDir } : {}),
    });

    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }

    // Remember the directory of the first selected file
    setLastOpenDir(path.dirname(result.filePaths[0]));

    return result.filePaths.map((filePath) => ({
      filePath,
      content: fs.readFileSync(filePath, 'utf-8'),
    }));
  });

  // --- Save in place ---
  ipcMain.handle('file:save', async (_event, filePath: string, content: string): Promise<string | null> => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      setLastSaveDir(path.dirname(filePath));
      return filePath;
    } catch {
      return null;
    }
  });

  // --- Save As ---
  ipcMain.handle('file:save-as', async (_event, content: string): Promise<string | null> => {
    focusForDialog();

    const lastDir = getLastSaveDir();
    const result = await showSaveDialogSafe({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      ...(lastDir ? { defaultPath: lastDir } : {}),
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    fs.writeFileSync(result.filePath, content, 'utf-8');
    setLastSaveDir(path.dirname(result.filePath));
    return result.filePath;
  });

  // --- Export PDF ---
  ipcMain.handle('pdf:export', async (_event, html: string, css: string, options: PdfOptions): Promise<string | null> => {
    focusForDialog();

    const lastDir = getLastSaveDir();
    const result = await showSaveDialogSafe({
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      ...(lastDir ? { defaultPath: lastDir } : {}),
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    try {
      await exportPdf(html, css, result.filePath, options);
      setLastSaveDir(path.dirname(result.filePath));
      return result.filePath;
    } catch (err) {
      return null;
    }
  });

  // --- Export All to PDF ---
  ipcMain.handle('pdf:export-all', async (
    _event,
    items: ExportAllItem[],
    options: PdfOptions,
  ): Promise<ExportAllResult[] | null> => {
    if (!items || items.length === 0) return [];

    focusForDialog();

    const lastDir = getLastSaveDir();
    const folderResult = await showFolderDialogSafe({
      title: 'Wybierz folder docelowy dla PDF',
      ...(lastDir ? { defaultPath: lastDir } : {}),
    });

    if (folderResult.canceled || folderResult.filePaths.length === 0) {
      return null; // user cancelled
    }

    const outputDir = folderResult.filePaths[0];
    setLastSaveDir(outputDir);

    const results: ExportAllResult[] = [];

    for (const item of items) {
      const outputPath = path.join(outputDir, `${item.baseName}.pdf`);
      try {
        await exportPdf(item.html, item.css, outputPath, options);
        results.push({ baseName: item.baseName, success: true, outputPath });
      } catch (err) {
        results.push({
          baseName: item.baseName,
          success: false,
          error: (err as Error).message,
        });
      }
    }

    return results;
  });

  ipcMain.handle('app:title', async (_event, title: string): Promise<void> => {
    win.setTitle(title);
  });

  // --- LaneFlow render (Node-side, SVG returned as HTML snippet) ---
  ipcMain.handle(
    'laneflow:render',
    async (_event, req: LaneflowRenderRequest): Promise<LaneflowRenderResponse> => {
      const html = await renderLaneflowFence(req.source, {
        theme: req.theme,
        direction: req.direction,
      });
      return { html };
    },
  );
}
