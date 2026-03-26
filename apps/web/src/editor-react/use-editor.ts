import { useContext } from "react";
import { EditorContext } from "./editor-context";

export const useEditor = () => {
  const editor = useContext(EditorContext);

  if (!editor) {
    throw new Error("useEditor must be used within EditorProvider");
  }

  return editor;
};
