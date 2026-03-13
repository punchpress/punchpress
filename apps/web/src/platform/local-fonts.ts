import {
  createLocalFontOption,
  getLocalFontId,
  type LocalFontCatalogResult,
  type LocalFontDescriptor,
  type LocalFontOption,
} from "../editor/local-fonts";

interface BrowserLocalFontData {
  blob: () => Promise<Blob>;
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
}

interface QueryLocalFontsOptions {
  postscriptNames?: string[];
}

declare global {
  interface Window {
    queryLocalFonts?: (
      options?: QueryLocalFontsOptions
    ) => Promise<BrowserLocalFontData[]>;
  }
}

const toFontOptions = (fonts: Partial<LocalFontDescriptor>[]) => {
  const dedupedFonts = new Map<string, LocalFontOption>();

  for (const font of fonts) {
    const option = createLocalFontOption(font);
    dedupedFonts.set(option.id, option);
  }

  return [...dedupedFonts.values()].sort((left, right) => {
    return left.fullName.localeCompare(right.fullName);
  });
};

const getPermissionErrorMessage = (error: unknown) => {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Local font access was denied.";
    }

    if (error.name === "SecurityError") {
      return "Local font access is blocked in this browser context.";
    }
  }

  return error instanceof Error ? error.message : "Unable to load local fonts.";
};

const isPermissionError = (error: unknown) => {
  return error instanceof DOMException
    ? error.name === "NotAllowedError" || error.name === "SecurityError"
    : false;
};

const listDesktopFonts = async (): Promise<LocalFontCatalogResult> => {
  const fonts = await window.electron?.localFonts?.listFonts();

  return {
    error: "",
    fonts: toFontOptions(fonts || []),
    state: "ready",
  };
};

const listBrowserFonts = async (): Promise<LocalFontCatalogResult> => {
  if (typeof window.queryLocalFonts !== "function") {
    return {
      error: "This browser does not support local font access.",
      fonts: [],
      state: "unsupported",
    };
  }

  try {
    const fonts = await window.queryLocalFonts();

    return {
      error: "",
      fonts: toFontOptions(fonts),
      state: "ready",
    };
  } catch (error) {
    return {
      error: getPermissionErrorMessage(error),
      fonts: [],
      state: isPermissionError(error) ? "permission-denied" : "error",
    };
  }
};

export const getInitialLocalFontCatalog =
  (): Promise<LocalFontCatalogResult> => {
    if (window.electron?.localFonts) {
      return listDesktopFonts();
    }

    if (typeof window.queryLocalFonts === "function") {
      return Promise.resolve({
        error: "",
        fonts: [],
        state: "action-required",
      });
    }

    return Promise.resolve({
      error: "This browser does not support local font access.",
      fonts: [],
      state: "unsupported",
    });
  };

export const requestLocalFontCatalog = (): Promise<LocalFontCatalogResult> => {
  if (window.electron?.localFonts) {
    return listDesktopFonts();
  }

  return listBrowserFonts();
};

const toArrayBuffer = (value: ArrayBuffer | Uint8Array) => {
  if (value instanceof ArrayBuffer) {
    return value;
  }

  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength
  );
};

const readBrowserFontBytes = async (font: LocalFontDescriptor) => {
  if (typeof window.queryLocalFonts !== "function") {
    return null;
  }

  const matches = await window.queryLocalFonts(
    font.postscriptName
      ? {
          postscriptNames: [font.postscriptName],
        }
      : undefined
  );
  const matchingFont =
    matches.find((candidate) => {
      return getLocalFontId(candidate) === getLocalFontId(font);
    }) || null;

  if (!matchingFont) {
    return null;
  }

  return (await matchingFont.blob()).arrayBuffer();
};

export const readLocalFontBytes = async (font: LocalFontDescriptor) => {
  if (window.electron?.localFonts) {
    const bytes = await window.electron.localFonts.readFont(
      getLocalFontId(font)
    );
    return bytes ? toArrayBuffer(bytes) : null;
  }

  return readBrowserFontBytes(font);
};
