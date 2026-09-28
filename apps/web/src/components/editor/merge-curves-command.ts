import type { Editor } from "@punchpress/engine";

export interface PendingMergeCurves {
  editor: Editor;
  nodeIds: string[];
}

export const confirmMergeCurves = (
  editor: Editor,
  pending: PendingMergeCurves | null
) => {
  if (!pending || pending.editor !== editor) {
    return false;
  }

  return editor.mergeCurves(pending.nodeIds);
};
