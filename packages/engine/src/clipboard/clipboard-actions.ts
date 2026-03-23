import { finishEditingIfNeeded } from "../editing/editing-actions";
import { createClipboardContentState } from "../state/store/clipboard-state";
import {
  getClipboardPasteOffset,
  getTextPastePoint,
  PASTE_STEP,
  resetPasteSequence,
} from "./clipboard-placement";

const normalizeClipboardText = (text) => {
  if (typeof text !== "string") {
    return "";
  }

  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
};

export const copySelection = (editor) => {
  if (editor.selectedNodeIds.length === 0) {
    return null;
  }

  resetPasteSequence(editor);
  return createClipboardContentState(editor.getState(), editor.selectedNodeIds);
};

export const pasteClipboardContent = (editor, content) => {
  if (!content) {
    return;
  }

  finishEditingIfNeeded(editor);

  const offset = getClipboardPasteOffset(
    editor,
    content,
    JSON.stringify(content)
  );

  editor.run(() => {
    editor.getState().pasteClipboardContent(content, offset);
  });
};

export const duplicateClipboardContent = (
  editor,
  nodeIds,
  {
    insertAfterSourceRoots = true,
    offset = { x: PASTE_STEP, y: PASTE_STEP },
    preserveRootParents = true,
  } = {}
) => {
  const content = createClipboardContentState(editor.getState(), nodeIds);

  if (!content) {
    return;
  }

  editor.run(() => {
    editor.getState().insertClipboardContent(content, {
      insertAfterSourceRoots,
      offset,
      preserveRootParents,
    });
  });
};

export const pasteText = (editor, text) => {
  const nextText = normalizeClipboardText(text);

  if (nextText.length === 0) {
    return;
  }

  finishEditingIfNeeded(editor);

  const point = getTextPastePoint(editor, `text:${nextText}`);

  editor.run(() => {
    editor.getState().pasteText(nextText, editor.getDefaultFont(), point);
  });
};
