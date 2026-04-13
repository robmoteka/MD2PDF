import { FileResult, MenuAction } from '../shared/types';

declare global {
  interface Window {
    api: {
      openFile: () => Promise<FileResult | null>;
      saveFile: (filePath: string, content: string) => Promise<string | null>;
      saveFileAs: (content: string) => Promise<string | null>;
      exportPdf: (html: string, css: string) => Promise<string | null>;
      setTitle: (title: string) => Promise<void>;
      onMenuAction: (callback: (action: MenuAction) => void) => void;
    };
  }
}

export {};
