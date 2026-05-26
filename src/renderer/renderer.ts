import { MarkdownEditor } from './editor';
import { MarkdownPreview } from './preview';
import { TabManager, Tab } from './tabs';
import { MenuAction } from '../shared/types';

// --- State ---
const tabs = new TabManager();
let isDarkTheme = false;
let renderTimeout: ReturnType<typeof setTimeout> | null = null;

// --- DOM refs ---
const editorPane = document.getElementById('editor-pane')!;
const previewContent = document.getElementById('preview-content')!;
const fileNameEl = document.getElementById('file-name')!;
const modifiedEl = document.getElementById('modified-indicator')!;
const statusMsg = document.getElementById('status-message')!;
const cursorPos = document.getElementById('cursor-position')!;
const btnOpen = document.getElementById('btn-open')!;
const btnSave = document.getElementById('btn-save')!;
const btnExport = document.getElementById('btn-export')!;
const btnExportAll = document.getElementById('btn-export-all')!;
const btnTheme = document.getElementById('btn-theme')!;
const splitter = document.getElementById('splitter')!;
const tabListEl = document.getElementById('tab-list')!;
const btnNewTab = document.getElementById('btn-new-tab')!;

// --- Components ---
const editor = new MarkdownEditor(editorPane);
const preview = new MarkdownPreview(previewContent);

// --- Tab bar rendering ---
function renderTabBar(): void {
  tabListEl.innerHTML = '';
  for (const tab of tabs.allTabs) {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab' + (tab.id === tabs.activeTab?.id ? ' active' : '');
    tabEl.dataset.tabId = tab.id;

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = tab.doc.fileName;
    tabEl.appendChild(label);

    if (tab.doc.modified) {
      const dot = document.createElement('span');
      dot.className = 'tab-modified';
      dot.textContent = '●';
      tabEl.appendChild(dot);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '×';
    closeBtn.title = 'Zamknij zakładkę';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTabById(tab.id);
    });
    tabEl.appendChild(closeBtn);

    tabEl.addEventListener('click', () => {
      switchToTab(tab.id);
    });

    tabListEl.appendChild(tabEl);
  }
}

// --- Tab switching ---
function switchToTab(id: string): void {
  const prev = tabs.activeTab;
  if (prev && prev.id === id) return;

  // Save current state
  if (prev) {
    prev.doc.setContent(editor.getContent());
    prev.scrollTop = document.getElementById('preview-pane')!.scrollTop;
  }

  const tab = tabs.activate(id);
  if (!tab) return;

  loadTabIntoEditor(tab);
}

function loadTabIntoEditor(tab: Tab): void {
  editor.setContent(tab.doc.content);
  preview.render(tab.doc.content);
  document.getElementById('preview-pane')!.scrollTop = tab.scrollTop;
  updateToolbar();
  renderTabBar();
  editor.focus();
}

function updateToolbar(): void {
  const doc = tabs.activeDoc;
  if (!doc) {
    fileNameEl.textContent = 'MD2PDF';
    modifiedEl.classList.add('hidden');
    window.api.setTitle('MD2PDF');
    return;
  }
  fileNameEl.textContent = doc.fileName;
  modifiedEl.classList.toggle('hidden', !doc.modified);
  const title = doc.modified ? `● ${doc.fileName} — MD2PDF` : `${doc.fileName} — MD2PDF`;
  window.api.setTitle(title);
}

// --- Editor → State → Preview ---
editor.onContentChange((content) => {
  const doc = tabs.activeDoc;
  if (!doc) return;
  doc.setContent(content);

  // Debounce preview rendering
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    preview.render(content);
  }, 200);

  // Update cursor position
  const pos = editor.getCursorPosition();
  cursorPos.textContent = `Ln ${pos.line}, Col ${pos.col}`;

  updateToolbar();
  renderTabBar();
});

// --- Actions ---
function actionNew(): void {
  tabs.createTab();
  loadTabIntoEditor(tabs.activeTab!);
  setStatus('Nowa zakładka');
}

async function actionOpen(): Promise<void> {
  const results = await window.api.openFile();
  if (!results || results.length === 0) return;

  let openedCount = 0;

  for (const result of results) {
    // Switch to existing tab if file already open
    const existing = tabs.findByPath(result.filePath);
    if (existing) {
      switchToTab(existing.id);
      continue;
    }

    // First file: reuse the current empty untitled tab if available
    if (openedCount === 0) {
      const active = tabs.activeTab;
      if (active && !active.doc.filePath && !active.doc.modified && active.doc.content === '') {
        active.doc.loadFile(result.filePath, result.content);
        loadTabIntoEditor(active);
        window.api.watchFile(result.filePath);
        openedCount++;
        continue;
      }
    }

    tabs.createTab(result.filePath, result.content);
    window.api.watchFile(result.filePath);
    openedCount++;
  }

  // Make sure the last opened file is the active tab
  if (openedCount > 0) {
    loadTabIntoEditor(tabs.activeTab!);
  }

  if (results.length === 1) {
    setStatus(`Otwarto: ${tabs.activeDoc!.fileName}`);
  } else {
    setStatus(`Otwarto ${results.length} plików`);
  }
}

async function actionSave(): Promise<void> {
  const doc = tabs.activeDoc;
  if (!doc) return;

  if (doc.filePath) {
    const saved = await window.api.saveFile(doc.filePath, doc.content);
    if (saved) {
      doc.markSaved();
      updateToolbar();
      renderTabBar();
      setStatus(`Zapisano: ${doc.fileName}`);
    } else {
      setStatus('Błąd zapisu pliku');
    }
  } else {
    await actionSaveAs();
  }
}

async function actionSaveAs(): Promise<void> {
  const doc = tabs.activeDoc;
  if (!doc) return;

  const filePath = await window.api.saveFileAs(doc.content);
  if (filePath) {
    doc.markSaved(filePath);
    window.api.watchFile(filePath);
    updateToolbar();
    renderTabBar();
    setStatus(`Zapisano jako: ${doc.fileName}`);
  }
}

async function actionExportAll(): Promise<void> {
  const exportable = tabs.allTabs.filter(t => !!t.doc.filePath);
  if (exportable.length === 0) {
    setStatus('Brak otwartych plików z zapisaną ścieżką do eksportu');
    return;
  }

  setStatus(`Renderowanie ${exportable.length} pliku/plików…`);

  const css = await loadPdfCss();

  // Render each tab's markdown to HTML (this also renders Mermaid diagrams)
  const activeTab = tabs.activeTab;
  const items = [];

  for (const tab of exportable) {
    await preview.render(tab.doc.content);
    const html = preview.getPdfHtml();
    // Strip extension: "notes.md" → "notes", "doc.markdown" → "doc"
    const baseName = tab.doc.fileName.replace(/\.(md|markdown|txt)$/i, '');
    items.push({ html, css, baseName });
  }

  // Restore active tab's preview
  if (activeTab) {
    await preview.render(activeTab.doc.content);
  }

  const results = await window.api.exportAllPdf(items);

  if (results === null) {
    setStatus('Anulowano eksport');
    return;
  }

  const ok = results.filter(r => r.success).length;
  const fail = results.filter(r => !r.success).length;

  if (fail === 0) {
    setStatus(`Eksport zakończony: ${ok} PDF${ok !== 1 ? ' zapisanych' : ' zapisany'}`);
  } else {
    setStatus(`Eksport: ${ok} OK, ${fail} błędów`);
    console.error('Błędy eksportu:', results.filter(r => !r.success));
  }
}

async function actionExportPdf(): Promise<void> {
  const doc = tabs.activeDoc;
  if (!doc) return;

  setStatus('Eksportowanie PDF...');
  const html = preview.getPdfHtml();
  const css = await loadPdfCss();
  const result = await window.api.exportPdf(html, css);
  if (result) {
    setStatus(`PDF zapisany: ${result.split('/').pop()}`);
  } else {
    setStatus('Anulowano eksport PDF');
  }
}

function actionToggleTheme(): void {
  isDarkTheme = !isDarkTheme;
  const themeLink = document.getElementById('theme-link') as HTMLLinkElement;
  themeLink.href = isDarkTheme
    ? '../../assets/styles/themes/dark.css'
    : '../../assets/styles/themes/light.css';
  document.body.classList.toggle('dark', isDarkTheme);
  preview.setTheme(isDarkTheme);
  const doc = tabs.activeDoc;
  if (doc) preview.render(doc.content);
  setStatus(isDarkTheme ? 'Motyw ciemny' : 'Motyw jasny');
}

async function closeTabById(id: string): Promise<void> {
  const tab = tabs.allTabs.find(t => t.id === id);
  if (!tab) return;

  if (tab.doc.modified) {
    // Save current editor content if this is the active tab
    if (tabs.activeTab?.id === id) {
      tab.doc.setContent(editor.getContent());
    }
    if (!confirm(`"${tab.doc.fileName}" ma niezapisane zmiany. Zamknąć?`)) return;
  }

  if (tab.doc.filePath) window.api.unwatchFile(tab.doc.filePath);

  const wasActive = tabs.activeTab?.id === id;
  tabs.closeTab(id);

  if (tabs.count === 0) {
    // Create a fresh tab if none left
    tabs.createTab();
  }

  if (wasActive) {
    loadTabIntoEditor(tabs.activeTab!);
  } else {
    renderTabBar();
  }
}

function setStatus(msg: string): void {
  statusMsg.textContent = msg;
}

async function loadPdfCss(): Promise<string> {
  try {
    const response = await fetch('../../assets/styles/preview.css');
    const previewCss = await response.text();
    const response2 = await fetch('../../assets/styles/pdf.css');
    const pdfCss = await response2.text();
    return previewCss + '\n' + pdfCss;
  } catch {
    return '';
  }
}

// --- Menu actions from main process ---
window.api.onMenuAction((action: MenuAction) => {
  switch (action) {
    case 'new': actionNew(); break;
    case 'open': actionOpen(); break;
    case 'save': actionSave(); break;
    case 'save-as': actionSaveAs(); break;
    case 'export-pdf': actionExportPdf(); break;
    case 'export-all': actionExportAll(); break;
    case 'toggle-theme': actionToggleTheme(); break;
  }
});

// --- Toolbar buttons ---
btnOpen.addEventListener('click', actionOpen);
btnSave.addEventListener('click', actionSave);
btnExport.addEventListener('click', actionExportPdf);
btnExportAll.addEventListener('click', actionExportAll);
btnTheme.addEventListener('click', actionToggleTheme);
btnNewTab.addEventListener('click', actionNew);

// --- Splitter drag ---
let isDragging = false;

splitter.addEventListener('mousedown', (e) => {
  isDragging = true;
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const container = document.getElementById('main-container')!;
  const rect = container.getBoundingClientRect();
  const percent = ((e.clientX - rect.left) / rect.width) * 100;
  const clamped = Math.max(20, Math.min(80, percent));
  editorPane.style.width = `${clamped}%`;
});

document.addEventListener('mouseup', () => {
  isDragging = false;
});

// --- Auto-reload: nasłuchuj zmian pliku z zewnątrz ---
window.api.onFileChanged(async (changedPath: string) => {
  const tab = tabs.findByPath(changedPath);
  if (!tab) return;

  // Nie nadpisuj niezapisanych zmian
  if (tab.doc.modified) {
    if (tabs.activeTab?.id === tab.id) {
      setStatus('⚠ Plik zmieniony na dysku (niezapisane zmiany)');
    }
    return;
  }

  const content = await window.api.readFile(changedPath);
  if (content === null) return;

  tab.doc.loadFile(changedPath, content);

  if (tabs.activeTab?.id === tab.id) {
    editor.setContent(content);
    preview.render(content);
    setStatus('Przeładowano z dysku');
  }
});

// --- Init ---
tabs.createTab();
loadTabIntoEditor(tabs.activeTab!);
setStatus('Gotowy — otwórz plik Markdown lub zacznij pisać');
