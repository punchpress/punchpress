import { useSyncExternalStore } from "react";
import { useStore } from "zustand";
import shallow from "zustand/shallow";
import { useEditor } from "./use-editor";

export const useEditorSelectionDragSurfaceValue = (selector) => {
  const editor = useEditor();

  useSyncExternalStore(
    (listener) => editor.subscribeSelectionDragPreview(listener),
    () => editor.getSelectionDragPreviewRevision(),
    () => 0
  );

  return useStore(editor.store, (state) => selector(editor, state), shallow);
};
