import { useSyncExternalStore } from "react";
import { useEditor } from "./use-editor";

export const useEditorPreviewValue = (selector) => {
  const editor = useEditor();

  useSyncExternalStore(
    (listener) => editor.subscribeInteractionPreview(listener),
    () => editor.getInteractionPreviewRevision(),
    () => 0
  );

  return selector(editor);
};
