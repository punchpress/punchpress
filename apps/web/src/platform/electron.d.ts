export interface DesktopDocumentFileResult {
  contents: string;
  fileHandle: string | null;
  fileName: string;
}

export interface DesktopRecentDocument {
  fileName: string;
  filePath: string;
  lastOpenedAt: string;
}

export interface DesktopSaveFileResult {
  canceled: boolean;
  fileHandle: string | null;
  fileName: string | null;
}

export interface DesktopLocalFont {
  family: string;
  fullName: string;
  id: string;
  postscriptName: string;
  style: string;
}

declare global {
  interface Window {
    electron?: {
      documentCommands?: {
        markReady: () => void;
        onCommand: (
          callback: (command: "export" | "open" | "save" | "save-as") => void
        ) => () => void;
        onOpenDocument: (
          callback: (openedDocument: DesktopDocumentFileResult) => void
        ) => () => void;
      };
      editorCommands?: {
        onCommand: (callback: (command: "redo" | "undo") => void) => () => void;
      };
      documentFiles?: {
        openDocument: () => Promise<DesktopDocumentFileResult | null>;
        openRecentDocument: (
          filePath: string
        ) => Promise<DesktopDocumentFileResult | null>;
        saveDocument: (payload: {
          contents: string;
          defaultFileName: string;
          fileHandle?: string | null;
        }) => Promise<DesktopSaveFileResult>;
        saveSvg: (payload: {
          contents: string;
          defaultFileName: string;
        }) => Promise<DesktopSaveFileResult>;
        getRecentDocuments: () => Promise<DesktopRecentDocument[]>;
      };
      localFonts?: {
        listFonts: () => Promise<DesktopLocalFont[]>;
        readFont: (fontId: string) => Promise<ArrayBuffer | Uint8Array | null>;
      };
      versions?: {
        chrome: string;
        electron: string;
        node: string;
      };
    };
  }
}
