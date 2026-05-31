import { useSyncExternalStore } from "react";
import { useEditor } from "./use-editor";

export const useEditorSelectionDragPreviewValue = (selector) => {
  const editor = useEditor();

  useSyncExternalStore(
    (listener) => editor.subscribeSelectionDragPreview(listener),
    () => editor.getSelectionDragPreviewRevision(),
    () => 0
  );

  return selector(editor);
};
