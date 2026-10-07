import { useSyncExternalStore } from "react";
import { useEditor } from "./use-editor";

// Pen hover and segment previews publish through interaction preview, which
// path-editing surfaces do not otherwise follow. Track it only while the Pen
// tool is active so unrelated gestures do not re-render path chrome.
export const useEditorPenPreviewRevision = (isPenToolActive: boolean) => {
  const editor = useEditor();

  useSyncExternalStore(
    (listener) => editor.subscribeInteractionPreview(listener),
    () => (isPenToolActive ? editor.getInteractionPreviewRevision() : 0),
    () => 0
  );
};
