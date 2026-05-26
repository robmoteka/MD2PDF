import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { createMenu } from './menu';
import { registerIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;

if (process.platform === 'linux') {
  // AppImage cannot rely on root-owned setuid sandbox binary on many systems.
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-setuid-sandbox');
  // GetVSyncParametersIfAvailable() spam: Chromium GL compositor cannot read
  // VSync timing on many Linux display configs (X11, hybrid GPU, VMs).
  // Disabling hw-vsync silences the log; rendering is unaffected.
  app.commandLine.appendSwitch('disable-gpu-vsync');
  // NOTE: "invalid cast from GtkFileChooserNative to GtkWidget" is an
  // Electron 28 bug — GtkFileChooserNative does not inherit GtkWidget in GTK3
  // but Electron's dialog code tries to cast it anyway. The dialogs work
  // correctly despite the message. Fixed upstream in Electron ≥ 30.
  // Workaround: dialogs are called without a parent window on Linux
  // (see ipc-handlers.ts showOpenDialogSafe / showSaveDialogSafe).
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'MD2PDF',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'));

  createMenu(mainWindow);
  registerIpcHandlers(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
