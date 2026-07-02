import {
  createLocalFontDescriptor,
  type LocalFontCatalogResult,
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
  editor.availableFonts = catalog.fonts;

  const preferredFont = resolveDefaultFont(catalog.fonts, editor.lastUsedFont);

  if (preferredFont) {
    editor.defaultFont = createLocalFontDescriptor(preferredFont);
  }

  editor.getState().setFontCatalogState(catalog.state, catalog.error);
  editor.getState().bumpFontRevision();
  preloadDefaultFont(editor);
  preloadFonts(editor);
};
