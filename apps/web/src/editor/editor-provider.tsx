import { createContext, useEffect, useState } from "react";
import { Editor } from "./editor";

export const EditorContext = createContext(null);

export const EditorProvider = ({ children }) => {
  const [editor] = useState(() => new Editor());

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
