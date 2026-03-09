import { createContext, useEffect, useState } from "react";
import { createEditorE2eApi } from "./create-e2e-api";
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

    const testWindow = window as Window & {
      __PUNCHPRESS_E2E__?: ReturnType<typeof createEditorE2eApi>;
    };
    const api = createEditorE2eApi(editor);

    testWindow.__PUNCHPRESS_E2E__ = api;

    return () => {
      if (testWindow.__PUNCHPRESS_E2E__ === api) {
        testWindow.__PUNCHPRESS_E2E__ = undefined;
      }
    };
  }, [editor]);

  return (
    <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
  );
};
