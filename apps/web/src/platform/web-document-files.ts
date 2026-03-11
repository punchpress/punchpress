import { fileOpen, fileSave } from "browser-fs-access";
import {
  DEFAULT_DOCUMENT_BASE_NAME,
  PUNCH_DOCUMENT_EXTENSION,
  PUNCH_DOCUMENT_MIME_TYPE,
  PUNCH_SVG_EXTENSION,
  PUNCH_SVG_MIME_TYPE,
} from "../document/constants";

export type PunchDocumentHandle = FileSystemFileHandle | string | null;
export interface PunchFileSaveResult {
  canceled: boolean;
  fileHandle: PunchDocumentHandle;
  fileName: string | null;
}

const PATH_SEPARATOR_PATTERN = /[/\\]/;

const stripExtension = (value: string, extension: string) => {
  return value.toLowerCase().endsWith(extension)
    ? value.slice(0, -extension.length)
    : value;
};

export const getDocumentBaseName = (value?: string) => {
  const normalized = (value || DEFAULT_DOCUMENT_BASE_NAME).trim();
  const withoutPunchExtension = stripExtension(
    normalized,
    PUNCH_DOCUMENT_EXTENSION
  );

  return (
    stripExtension(withoutPunchExtension, PUNCH_SVG_EXTENSION).trim() ||
    DEFAULT_DOCUMENT_BASE_NAME
  );
};

const getHandleFileName = (handle: PunchDocumentHandle) => {
  if (!handle) {
    return null;
  }

  if (typeof handle === "string") {
    const segments = handle.split(PATH_SEPARATOR_PATTERN);
    return segments.at(-1) || null;
  }

  return handle.name || null;
};

const getDesktopDocumentFiles = () => {
  return window.electron?.documentFiles || null;
};

const isUserAbortError = (error: unknown) => {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
};

export const openPunchDocumentFile = async () => {
  const desktopDocumentFiles = getDesktopDocumentFiles();

  if (desktopDocumentFiles) {
    return desktopDocumentFiles.openDocument();
  }

  try {
    const file = await fileOpen({
      description: "PunchPress document",
      excludeAcceptAllOption: true,
      extensions: [PUNCH_DOCUMENT_EXTENSION],
      mimeTypes: [PUNCH_DOCUMENT_MIME_TYPE],
    });

    return {
      contents: await file.text(),
      fileHandle: file.handle || null,
      fileName: file.name,
    };
  } catch (error) {
    if (isUserAbortError(error)) {
      return null;
    }

    throw error;
  }
};

export const savePunchDocumentFile = async (
  contents: string,
  baseName = DEFAULT_DOCUMENT_BASE_NAME,
  existingHandle: PunchDocumentHandle = null,
  forceDialog = false
): Promise<PunchFileSaveResult> => {
  const desktopDocumentFiles = getDesktopDocumentFiles();
  const defaultFileName = `${getDocumentBaseName(baseName)}${PUNCH_DOCUMENT_EXTENSION}`;
  const nextHandle = forceDialog ? null : existingHandle;

  if (desktopDocumentFiles) {
    const result = await desktopDocumentFiles.saveDocument({
      contents,
      defaultFileName,
      fileHandle: typeof nextHandle === "string" ? nextHandle : null,
    });

    return {
      canceled: result.canceled,
      fileHandle: result.canceled ? nextHandle : result.fileHandle,
      fileName: result.fileName || getHandleFileName(nextHandle),
    };
  }

  try {
    const fileHandle = await fileSave(
      new Blob([contents], { type: PUNCH_DOCUMENT_MIME_TYPE }),
      {
        description: "PunchPress document",
        excludeAcceptAllOption: true,
        extensions: [PUNCH_DOCUMENT_EXTENSION],
        fileName: defaultFileName,
        mimeTypes: [PUNCH_DOCUMENT_MIME_TYPE],
      },
      typeof nextHandle === "string" ? null : nextHandle
    );

    return {
      canceled: false,
      fileHandle: fileHandle || nextHandle,
      fileName:
        fileHandle?.name || getHandleFileName(nextHandle) || defaultFileName,
    };
  } catch (error) {
    if (isUserAbortError(error)) {
      return {
        canceled: true,
        fileHandle: nextHandle,
        fileName: getHandleFileName(nextHandle),
      };
    }

    throw error;
  }
};

export const savePunchSvgFile = async (
  contents: string,
  baseName = DEFAULT_DOCUMENT_BASE_NAME
): Promise<PunchFileSaveResult> => {
  const desktopDocumentFiles = getDesktopDocumentFiles();
  const defaultFileName = `${getDocumentBaseName(baseName)}${PUNCH_SVG_EXTENSION}`;

  if (desktopDocumentFiles) {
    const result = await desktopDocumentFiles.saveSvg({
      contents,
      defaultFileName,
    });

    return {
      canceled: result.canceled,
      fileHandle: result.fileHandle,
      fileName: result.fileName,
    };
  }

  try {
    const fileHandle = await fileSave(
      new Blob([contents], { type: PUNCH_SVG_MIME_TYPE }),
      {
        description: "SVG export",
        excludeAcceptAllOption: true,
        extensions: [PUNCH_SVG_EXTENSION],
        fileName: defaultFileName,
        mimeTypes: [PUNCH_SVG_MIME_TYPE],
      }
    );

    return {
      canceled: false,
      fileHandle,
      fileName: fileHandle?.name || defaultFileName,
    };
  } catch (error) {
    if (isUserAbortError(error)) {
      return {
        canceled: true,
        fileHandle: null,
        fileName: null,
      };
    }

    throw error;
  }
};
