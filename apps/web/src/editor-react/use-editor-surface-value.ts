import { useSyncExternalStore } from "react";
import { useStore } from "zustand";
import shallow from "zustand/shallow";
import { useEditor } from "./use-editor";

export const useEditorSurfaceValue = (selector) => {
  const editor = useEditor();

  useSyncExternalStore(
    (listener) => editor.subscribeInteractionPreview(listener),
    () => editor.getInteractionPreviewRevision(),
    () => 0
  );

  return useStore(editor.store, (state) => selector(editor, state), shallow);
};
