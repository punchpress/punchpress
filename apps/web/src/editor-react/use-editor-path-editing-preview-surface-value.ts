import { useSyncExternalStore } from "react";
import { useStore } from "zustand";
import shallow from "zustand/shallow";
import { useEditor } from "./use-editor";

export const useEditorPathEditingPreviewSurfaceValue = (selector) => {
  const editor = useEditor();

  useSyncExternalStore(
    (listener) => editor.subscribePathEditingPreview(listener),
    () => editor.getPathEditingPreviewRevision(),
    () => 0
  );

  return useStore(editor.store, (state) => selector(editor, state), shallow);
};
