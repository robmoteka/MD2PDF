import { Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron';
import { MenuAction } from '../shared/types';

export function createMenu(win: BrowserWindow): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Plik',
      submenu: [
        {
          label: 'Nowy',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendAction(win, 'new'),
        },
        {
          label: 'Otwórz...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendAction(win, 'open'),
        },
        { type: 'separator' },
        {
          label: 'Zapisz',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendAction(win, 'save'),
        },
        {
          label: 'Zapisz jako...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendAction(win, 'save-as'),
        },
        { type: 'separator' },
        {
          label: 'Eksportuj do PDF...',
          accelerator: 'CmdOrCtrl+E',
          click: () => sendAction(win, 'export-pdf'),
        },
        { type: 'separator' },
        { label: 'Zamknij', role: 'quit' },
      ],
    },
    {
      label: 'Edycja',
      submenu: [
        { label: 'Cofnij', role: 'undo' },
        { label: 'Ponów', role: 'redo' },
        { type: 'separator' },
        { label: 'Wytnij', role: 'cut' },
        { label: 'Kopiuj', role: 'copy' },
        { label: 'Wklej', role: 'paste' },
        { label: 'Zaznacz wszystko', role: 'selectAll' },
      ],
    },
    {
      label: 'Widok',
      submenu: [
        {
          label: 'Przełącz motyw',
          accelerator: 'CmdOrCtrl+T',
          click: () => sendAction(win, 'toggle-theme'),
        },
        { type: 'separator' },
        { label: 'Powiększ', role: 'zoomIn' },
        { label: 'Pomniejsz', role: 'zoomOut' },
        { label: 'Resetuj zoom', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Narzędzia deweloperskie', role: 'toggleDevTools' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function sendAction(win: BrowserWindow, action: MenuAction): void {
  win.webContents.send('menu:action', action);
}
