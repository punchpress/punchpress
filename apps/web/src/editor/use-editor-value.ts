import { useStore } from "zustand";
import shallow from "zustand/shallow";
import { useEditor } from "./use-editor";

export const useEditorValue = (selector) => {
  const editor = useEditor();

  return useStore(editor.store, (state) => selector(editor, state), shallow);
};
