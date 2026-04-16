import path from "node:path";
import {
  clearRecentDocuments,
  type DesktopOpenedDocument,
  openDocumentAtPath,
  openRecentDocument,
} from "./recent-documents.js";

const SUPPORTED_OPEN_DOCUMENT_EXTENSIONS = new Set([".punch"]);

interface CreateDocumentOpeningControllerOptions {
  emitOpenedDocument: (openedDocument: DesktopOpenedDocument) => void;
  emitRecentDocumentsChanged: () => void;
  ensureMainWindow: () => void;
  focusMainWindow: () => void;
  initialOpenDocumentPaths?: string[];
  installApplicationMenu: () => Promise<void>;
  isAppReady: () => boolean;
  isRendererReady: () => boolean;
}

const normalizeOpenDocumentPath = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0 || trimmedValue.startsWith("-")) {
    return null;
  }

  const resolvedFilePath = path.resolve(trimmedValue);

  return SUPPORTED_OPEN_DOCUMENT_EXTENSIONS.has(
    path.extname(resolvedFilePath).toLowerCase()
  )
    ? resolvedFilePath
    : null;
};

export const extractOpenDocumentPathsFromArgv = (argv: string[]) => {
  const filePaths = argv
    .map(normalizeOpenDocumentPath)
    .filter((filePath): filePath is string => Boolean(filePath));

  return [...new Set(filePaths)];
};

export const createDocumentOpeningController = ({
  emitOpenedDocument,
  emitRecentDocumentsChanged,
  ensureMainWindow,
  focusMainWindow,
  installApplicationMenu,
  initialOpenDocumentPaths = [],
  isAppReady,
  isRendererReady,
}: CreateDocumentOpeningControllerOptions) => {
  const pendingOpenDocumentPaths = [...initialOpenDocumentPaths];
  const pendingOpenedDocuments: DesktopOpenedDocument[] = [];
  let isFlushingPendingOpenDocumentPaths = false;

  const sendOpenedDocument = (openedDocument: DesktopOpenedDocument) => {
    if (!isRendererReady()) {
      pendingOpenedDocuments.push(openedDocument);
      return;
    }

    emitOpenedDocument(openedDocument);
  };

  const notifyRecentDocumentsChanged = () => {
    if (!isRendererReady()) {
      return;
    }

    emitRecentDocumentsChanged();
  };

  const refreshRecentDocuments = async () => {
    await installApplicationMenu();
    notifyRecentDocumentsChanged();
  };

  const flushPendingOpenedDocuments = () => {
    if (!isRendererReady()) {
      return;
    }

    const openedDocumentsToSend = pendingOpenedDocuments.splice(0);

    for (const openedDocument of openedDocumentsToSend) {
      emitOpenedDocument(openedDocument);
    }
  };

  const openDocumentFromPath = async (filePath: string) => {
    const openedDocument = await openDocumentAtPath(filePath);

    await refreshRecentDocuments();

    if (!openedDocument) {
      return;
    }

    sendOpenedDocument(openedDocument);
  };

  const openRecentDocumentFromMenu = async (filePath: string) => {
    const openedDocument = await openRecentDocument(filePath);

    await refreshRecentDocuments();

    if (!openedDocument) {
      return;
    }

    sendOpenedDocument(openedDocument);
  };

  const clearRecentDocumentsFromMenu = async () => {
    await clearRecentDocuments();
    await refreshRecentDocuments();
  };

  const flushPendingOpenDocumentPaths = async () => {
    if (
      !isAppReady() ||
      isFlushingPendingOpenDocumentPaths ||
      pendingOpenDocumentPaths.length === 0
    ) {
      return;
    }

    isFlushingPendingOpenDocumentPaths = true;

    try {
      while (pendingOpenDocumentPaths.length > 0) {
        const filePath = pendingOpenDocumentPaths.shift();

        if (!filePath) {
          continue;
        }

        try {
          await openDocumentFromPath(filePath);
        } catch (error) {
          console.error(`Failed to open document at ${filePath}`, error);
        }
      }
    } finally {
      isFlushingPendingOpenDocumentPaths = false;
      flushPendingOpenedDocuments();
    }
  };

  const enqueueOpenDocumentPath = (filePath: string) => {
    const normalizedFilePath = normalizeOpenDocumentPath(filePath);

    if (!normalizedFilePath) {
      return;
    }

    const existingIndex = pendingOpenDocumentPaths.indexOf(normalizedFilePath);

    if (existingIndex >= 0) {
      pendingOpenDocumentPaths.splice(existingIndex, 1);
    }

    pendingOpenDocumentPaths.push(normalizedFilePath);

    if (!isAppReady()) {
      return;
    }

    ensureMainWindow();
    focusMainWindow();
    flushPendingOpenDocumentPaths().catch((error) => {
      console.error(error);
    });
  };

  return {
    clearRecentDocumentsFromMenu,
    enqueueOpenDocumentPath,
    flushPendingOpenDocumentPaths,
    flushPendingOpenedDocuments,
    notifyRecentDocumentsChanged,
    openRecentDocumentFromMenu,
  };
};
