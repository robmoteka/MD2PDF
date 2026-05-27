export interface DocumentState {
  filePath: string | null;
  content: string;
  modified: boolean;
}

export interface PdfOptions {
  pageSize: 'A4' | 'A3' | 'Letter';
  landscape: boolean;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

export interface FileResult {
  filePath: string;
  content: string;
}

export interface ExportAllItem {
  html: string;
  css: string;
  baseName: string; // filename without extension, used as output PDF name
}

export interface ExportAllResult {
  baseName: string;
  success: boolean;
  outputPath?: string;
  error?: string;
}

export type MenuAction = 'new' | 'open' | 'save' | 'save-as' | 'export-pdf' | 'export-all' | 'toggle-theme';

// ─── LaneFlow IPC ─────────────────────────────────────────────────────────────

export type LaneflowThemeIpc = 'light' | 'dark';
export type LaneflowDirectionIpc = 'TB' | 'LR';

export interface LaneflowRenderRequest {
  source: string;
  theme: LaneflowThemeIpc;
  direction?: LaneflowDirectionIpc;
}

/** The IPC response is always an HTML snippet: success → rendered SVG div, error → error pre. */
export interface LaneflowRenderResponse {
  html: string;
}
