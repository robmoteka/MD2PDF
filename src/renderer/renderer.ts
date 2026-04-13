import { MarkdownEditor } from './editor';
import { MarkdownPreview } from './preview';
import { DocumentState } from './state';
import { MenuAction } from '../shared/types';

// --- State ---
const doc = new DocumentState();
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
const btnTheme = document.getElementById('btn-theme')!;
const splitter = document.getElementById('splitter')!;

// --- Components ---
const editor = new MarkdownEditor(editorPane);
const preview = new MarkdownPreview(previewContent);

// --- Editor → State → Preview ---
editor.onContentChange((content) => {
  doc.setContent(content);

  // Debounce preview rendering
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    preview.render(content);
  }, 200);

  // Update cursor position
  const pos = editor.getCursorPosition();
  cursorPos.textContent = `Ln ${pos.line}, Col ${pos.col}`;
});

// --- State change → UI ---
doc.onChange(() => {
  fileNameEl.textContent = doc.fileName;
  modifiedEl.classList.toggle('hidden', !doc.modified);

  const title = doc.modified ? `● ${doc.fileName} — MD2PDF` : `${doc.fileName} — MD2PDF`;
  window.api.setTitle(title);
});

// --- Actions ---
async function actionNew(): Promise<void> {
  if (doc.modified && !confirm('Masz niezapisane zmiany. Kontynuować?')) return;
  doc.newDocument();
  editor.setContent('');
  preview.render('');
  setStatus('Nowy dokument');
}

async function actionOpen(): Promise<void> {
  if (doc.modified && !confirm('Masz niezapisane zmiany. Kontynuować?')) return;
  const result = await window.api.openFile();
  if (!result) return;
  doc.loadFile(result.filePath, result.content);
  editor.setContent(result.content);
  preview.render(result.content);
  setStatus(`Otwarto: ${doc.fileName}`);
}

async function actionSave(): Promise<void> {
  if (doc.filePath) {
    const saved = await window.api.saveFile(doc.filePath, doc.content);
    if (saved) {
      doc.markSaved();
      setStatus(`Zapisano: ${doc.fileName}`);
    } else {
      setStatus('Błąd zapisu pliku');
    }
  } else {
    await actionSaveAs();
  }
}

async function actionSaveAs(): Promise<void> {
  const filePath = await window.api.saveFileAs(doc.content);
  if (filePath) {
    doc.markSaved(filePath);
    setStatus(`Zapisano jako: ${doc.fileName}`);
  }
}

async function actionExportPdf(): Promise<void> {
  setStatus('Eksportowanie PDF...');
  const html = preview.getRenderedHtml();
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
  // Re-render preview with new Mermaid theme
  preview.render(doc.content);
  setStatus(isDarkTheme ? 'Motyw ciemny' : 'Motyw jasny');
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
    case 'toggle-theme': actionToggleTheme(); break;
  }
});

// --- Toolbar buttons ---
btnOpen.addEventListener('click', actionOpen);
btnSave.addEventListener('click', actionSave);
btnExport.addEventListener('click', actionExportPdf);
btnTheme.addEventListener('click', actionToggleTheme);

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

// --- Init ---
editor.focus();
setStatus('Gotowy — otwórz plik Markdown lub zacznij pisać');
