import { Editor } from "@punchpress/engine";
import { createContext, useEffect, useState } from "react";
import {
  getInitialLocalFontCatalog,
  readLocalFontBytes,
  requestLocalFontCatalog,
} from "../platform/local-fonts";
import { getStoredLastUsedFont, rememberLastUsedFont } from "./default-font";

export const EditorContext = createContext(null);

export const EditorProvider = ({ children }) => {
  const [editor] = useState(() => {
    const nextEditor = new Editor();
    const storedLastUsedFont = getStoredLastUsedFont();

    if (storedLastUsedFont) {
      nextEditor.setDefaultFont(storedLastUsedFont);
      nextEditor.setLastUsedFont(storedLastUsedFont);
    }

    nextEditor.setFontBytesLoader(readLocalFontBytes);
    nextEditor.setLastUsedFontPersistence(rememberLastUsedFont);
    nextEditor.setLocalFontCatalogLoaders({
      getInitialCatalog: getInitialLocalFontCatalog,
      requestCatalog: requestLocalFontCatalog,
    });

    return nextEditor;
  });

  useEffect(() => {
    editor.mount();

    return () => {
      editor.dispose();
    };
  }, [editor]);

  useEffect(() => {
    if (!(import.meta.env.DEV && typeof window !== "undefined")) {
      return;
    }

    window.__PUNCHPRESS_EDITOR__ = editor;

    return () => {
      if (window.__PUNCHPRESS_EDITOR__ === editor) {
        window.__PUNCHPRESS_EDITOR__ = undefined;
      }
    };
  }, [editor]);

  return (
    <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
  );
};
