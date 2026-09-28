import { Editor } from "@punchpress/engine";
import {
  getInitialLocalFontCatalog,
  readLocalFontBytes,
  requestLocalFontCatalog,
} from "../platform/local-fonts";
import { createCanvas2dRasterRuntime } from "../platform/raster/canvas2d-raster-runtime";
import { getStoredLastUsedFont, rememberLastUsedFont } from "./default-font";

export const createConfiguredEditor = () => {
  const editor = new Editor({
    rasterSurface: createCanvas2dRasterRuntime(),
  });
  const storedLastUsedFont = getStoredLastUsedFont();

  if (storedLastUsedFont) {
    editor.setDefaultFont(storedLastUsedFont);
    editor.setLastUsedFont(storedLastUsedFont);
  }

  editor.setFontBytesLoader(readLocalFontBytes);
  editor.setLastUsedFontPersistence(rememberLastUsedFont);
  editor.setLocalFontCatalogLoaders({
    getInitialCatalog: getInitialLocalFontCatalog,
    requestCatalog: requestLocalFontCatalog,
  });

  return editor;
};
