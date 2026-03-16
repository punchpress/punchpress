import type { Editor } from "@punchpress/engine";

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

export type DesktopUpdateStatus =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "downloading"; percent: number; version: string | null }
  | { phase: "ready"; version: string | null };

export interface DesktopLocalFont {
  family: string;
  fullName: string;
  id: string;
  postscriptName: string;
  style: string;
}

declare global {
  interface Window {
    __PUNCHPRESS_EDITOR__?: Editor;
    electron?: {
      documentCommands?: {
        markReady: () => void;
        onCommand: (
          callback: (
            command: "export" | "new" | "open" | "save" | "save-as"
          ) => void
        ) => () => void;
        onOpenDocument: (
          callback: (openedDocument: DesktopDocumentFileResult) => void
        ) => () => void;
        onRecentDocumentsChanged: (callback: () => void) => () => void;
        onBeforeClose: (callback: (requestId: number) => void) => () => void;
        respondBeforeClose: (requestId: number, shouldClose: boolean) => void;
      };
      editorCommands?: {
        onCommand: (callback: (command: "redo" | "undo") => void) => () => void;
      };
      updaterCommands?: {
        getStatus: () => Promise<DesktopUpdateStatus>;
        onStatusChange: (
          callback: (status: DesktopUpdateStatus) => void
        ) => () => void;
        restartToUpdate: () => Promise<void>;
      };
      documentFiles?: {
        openDocument: () => Promise<DesktopDocumentFileResult | null>;
        openRecentDocument: (
          filePath: string
        ) => Promise<DesktopDocumentFileResult | null>;
        saveDocument: (payload: {
          contents: string;
          directoryPath?: string | null;
          defaultFileName: string;
          fileHandle?: string | null;
        }) => Promise<DesktopSaveFileResult>;
        saveSvg: (payload: {
          contents: string;
          defaultFileName: string;
        }) => Promise<DesktopSaveFileResult>;
        getRecentDocuments: () => Promise<DesktopRecentDocument[]>;
        clearRecentDocuments: () => Promise<void>;
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
