import { measurePerf } from "@punchpress/engine";
import { useStore } from "zustand";
import shallow from "zustand/shallow";
import { useEditor } from "./use-editor";

export const useEditorValue = (selector, perfLabel = null) => {
  const editor = useEditor();

  return useStore(
    editor.store,
    (state) => {
      if (!perfLabel) {
        return selector(editor, state);
      }

      return measurePerf(perfLabel, () => selector(editor, state));
    },
    shallow
  );
};
