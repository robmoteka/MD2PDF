import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { exportPdf } from './pdf-export';
import { FileResult, PdfOptions } from '../shared/types';

export function registerIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle('file:open', async (): Promise<FileResult | null> => {
    const result = await dialog.showOpenDialog(win, {
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { filePath, content };
  });

  ipcMain.handle('file:save', async (_event, filePath: string, content: string): Promise<string | null> => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return filePath;
    } catch {
      return null;
    }
  });

  ipcMain.handle('file:save-as', async (_event, content: string): Promise<string | null> => {
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    fs.writeFileSync(result.filePath, content, 'utf-8');
    return result.filePath;
  });

  ipcMain.handle('pdf:export', async (_event, html: string, css: string): Promise<string | null> => {
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    try {
      await exportPdf(html, css, result.filePath);
      return result.filePath;
    } catch (err) {
      return null;
    }
  });

  ipcMain.handle('app:title', async (_event, title: string): Promise<void> => {
    win.setTitle(title);
  });
}
