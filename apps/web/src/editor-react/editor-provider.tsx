import { useEffect, useState } from "react";
import { createConfiguredEditor } from "./create-configured-editor";
import { EditorContext } from "./editor-context";
import { useEditorClipboardEvents } from "./use-editor-clipboard-events";

export const EditorProvider = ({ children }) => {
  const [editor] = useState(createConfiguredEditor);

  useEditorClipboardEvents(editor);

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
