export interface DesktopDocumentFileResult {
  contents: string;
  fileHandle: string | null;
  fileName: string;
}

export interface DesktopSaveFileResult {
  canceled: boolean;
  fileHandle: string | null;
  fileName: string | null;
}

declare global {
  interface Window {
    electron?: {
      documentCommands?: {
        onCommand: (
          callback: (command: "export" | "open" | "save" | "save-as") => void
        ) => () => void;
      };
      documentFiles?: {
        openDocument: () => Promise<DesktopDocumentFileResult | null>;
        saveDocument: (payload: {
          contents: string;
          defaultFileName: string;
          fileHandle?: string | null;
        }) => Promise<DesktopSaveFileResult>;
        saveSvg: (payload: {
          contents: string;
          defaultFileName: string;
        }) => Promise<DesktopSaveFileResult>;
      };
      versions?: {
        chrome: string;
        electron: string;
        node: string;
      };
    };
  }
}
