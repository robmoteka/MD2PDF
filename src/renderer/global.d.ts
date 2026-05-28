import { FileResult, ExportAllItem, ExportAllResult, PdfOptions, MenuAction, LaneflowRenderRequest, LaneflowRenderResponse } from '../shared/types';

declare global {
  interface Window {
    api: {
      openFile: () => Promise<FileResult[]>;
      saveFile: (filePath: string, content: string) => Promise<string | null>;
      saveFileAs: (content: string) => Promise<string | null>;
      exportPdf: (html: string, css: string, options: PdfOptions) => Promise<string | null>;
      exportAllPdf: (items: ExportAllItem[], options: PdfOptions) => Promise<ExportAllResult[] | null>;
      setTitle: (title: string) => Promise<void>;
      onMenuAction: (callback: (action: MenuAction) => void) => void;
      // File watching (auto-reload)
      readFile: (filePath: string) => Promise<string | null>;
      watchFile: (filePath: string) => Promise<void>;
      unwatchFile: (filePath: string) => Promise<void>;
      onFileChanged: (callback: (filePath: string) => void) => void;
      // LaneFlow diagram rendering (delegated to main process / Node)
      renderLaneflow: (req: LaneflowRenderRequest) => Promise<LaneflowRenderResponse>;
    };
  }
}

export {};
