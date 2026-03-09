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

  return (
    <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
  );
};
