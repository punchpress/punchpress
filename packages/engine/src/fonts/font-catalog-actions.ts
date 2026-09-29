import {
  createLocalFontOption,
  createLocalFontDescriptor,
  getLocalFontId,
  type LocalFontCatalogResult,
  type LocalFontDescriptor,
  type LocalFontOption,
} from "@punchpress/punch-schema";
import { resolveDefaultFont } from "./resolve-default-font";

export const preloadFonts = (editor, nodes = editor.nodes) => {
  editor.fonts.preload(nodes);
};

const preloadDefaultFont = (editor) => {
  if (editor.availableFonts.length === 0) {
    return;
  }

  editor.fonts.preloadFont(editor.getDefaultFont());
};

type FontInput = LocalFontDescriptor | LocalFontOption;

const mergeFontOptions = (
  ...fontLists: ReadonlyArray<ReadonlyArray<FontInput>>
) => {
  const fontsById = new Map<string, LocalFontOption>();

  for (const fonts of fontLists) {
    for (const font of fonts || []) {
      const option = createLocalFontOption(font);

      if (!fontsById.has(option.id)) {
        fontsById.set(option.id, option);
      }
    }
  }

  return [...fontsById.values()];
};

export const preloadFontOptions = (editor, fonts) => {
  for (const font of fonts) {
    editor.fonts.preloadFont(font);
  }
};

export const getFontPreviewState = (editor, font) => {
  return editor.fonts.getLoadState(font);
};

export const getFontPreviewFamily = (editor, font) => {
  return editor.fonts.getEditableFontFamily(font);
};

export const getDefaultFont = (editor) => {
  return createLocalFontDescriptor(editor.defaultFont);
};

export const getFontAvailability = (editor, font) => {
  const fontId = getLocalFontId(font);
  const isBundledFont = (editor.bundledFonts || []).some(
    (bundledFont) => bundledFont.id === fontId
  );

  if (isBundledFont) {
    return editor.fonts.getLoadState(font) === "error"
      ? "load-error"
      : "available";
  }

  const state = editor.fontCatalogState;

  if (state !== "ready") {
    return state;
  }

  if (!editor.availableFonts.some((availableFont) => availableFont.id === fontId)) {
    return "missing";
  }

  return editor.fonts.getLoadState(font) === "error"
    ? "load-error"
    : "available";
};

export const getTextFallbackPreview = (editor, node, geometry) => {
  if (node.type !== "text" || geometry?.ready) {
    return null;
  }

  return {
    baselineOffset: -node.fontSize * 0.18,
    fontFamily: editor.fonts.getEditableFontFamily(node.font),
    fontSize: node.fontSize,
    text: node.text,
    width: geometry?.bbox?.width ?? 0,
  };
};

export const initializeLocalFonts = async (editor) => {
  if (!editor.getInitialLocalFontCatalog) {
    return null;
  }

  return await editor.loadLocalFontCatalog(() =>
    editor.getInitialLocalFontCatalog()
  );
};

export const requestLocalFonts = async (editor) => {
  if (!editor.requestLocalFontCatalog) {
    return null;
  }

  editor.getState().setFontCatalogState("loading");
  return await editor.loadLocalFontCatalog(
    () => editor.requestLocalFontCatalog(),
    {
      force: true,
    }
  );
};

export const setLastUsedFont = (editor, font) => {
  const descriptor = createLocalFontDescriptor(font);
  editor.lastUsedFont = descriptor;
  editor.defaultFont = descriptor;
  editor.persistLastUsedFont?.(descriptor);
};

export const setBundledFonts = (
  editor,
  fonts: readonly FontInput[] = []
) => {
  editor.bundledFonts = mergeFontOptions(fonts);
  editor.availableFonts = mergeFontOptions(
    editor.bundledFonts,
    editor.availableFonts
  );

  const preferredFont = resolveDefaultFont(
    editor.availableFonts,
    editor.lastUsedFont
  );

  if (preferredFont) {
    editor.defaultFont = createLocalFontDescriptor(preferredFont);
  }

  editor.getState().bumpFontRevision();
  preloadDefaultFont(editor);
  preloadFonts(editor);
};

export const loadLocalFontCatalog = (editor, loadCatalog, { force = false } = {}) => {
  if (!force && editor.localFontCatalogPromise) {
    return editor.localFontCatalogPromise;
  }

  editor.localFontCatalogPromise = loadCatalog()
    .then((catalog) => {
      editor.applyLocalFontCatalog(catalog);
      return catalog;
    })
    .catch((error) => {
      editor.localFontCatalogPromise = null;
      throw error;
    });

  return editor.localFontCatalogPromise;
};

export const applyLocalFontCatalog = (
  editor,
  catalog: LocalFontCatalogResult
) => {
  editor.availableFonts = mergeFontOptions(editor.bundledFonts, catalog.fonts);

  const preferredFont = resolveDefaultFont(
    editor.availableFonts,
    editor.lastUsedFont
  );

  if (preferredFont) {
    editor.defaultFont = createLocalFontDescriptor(preferredFont);
  }

  editor.getState().setFontCatalogState(catalog.state, catalog.error);
  editor.getState().bumpFontRevision();
  preloadDefaultFont(editor);
  preloadFonts(editor);
};
