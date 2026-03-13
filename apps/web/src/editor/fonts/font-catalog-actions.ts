import {
  getInitialLocalFontCatalog,
  requestLocalFontCatalog,
} from "../../platform/local-fonts";
import { rememberLastUsedFont, resolveDefaultFont } from "../default-font";
import { createLocalFontDescriptor } from "../local-fonts";

export const preloadFonts = (editor, nodes = editor.nodes) => {
  editor.fonts.preload(nodes);
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
  return await editor.loadLocalFontCatalog(() => getInitialLocalFontCatalog());
};

export const requestLocalFonts = async (editor) => {
  editor.getState().setFontCatalogState("loading");
  return await editor.loadLocalFontCatalog(() => requestLocalFontCatalog(), {
    force: true,
  });
};

export const setLastUsedFont = (editor, font) => {
  const descriptor = createLocalFontDescriptor(font);
  editor.lastUsedFont = descriptor;
  editor.defaultFont = descriptor;
  rememberLastUsedFont(descriptor);
};

export const applyLocalFontCatalog = (editor, catalog) => {
  editor.availableFonts = catalog.fonts;

  const preferredFont = resolveDefaultFont(catalog.fonts, editor.lastUsedFont);

  if (preferredFont) {
    editor.defaultFont = createLocalFontDescriptor(preferredFont);
  }

  editor.getState().setFontCatalogState(catalog.state, catalog.error);
  editor.getState().bumpFontRevision();
  preloadFonts(editor);
};
