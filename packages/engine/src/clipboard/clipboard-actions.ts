import { finishEditingIfNeeded } from "../editing/editing-actions";
import {
  absorbInlineTileSources,
  inlineTileSources,
} from "../raster/raster-tile-transport";
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

  const content = createClipboardContentState(
    editor.getState(),
    editor.selectedNodeIds
  );

  if (!content) {
    return null;
  }

  // Clipboard payloads are self-contained: tile manifests carry their pixel
  // bytes as inline data URLs so pasting into another document or session
  // works without this editor's asset store.
  return {
    ...content,
    nodes: inlineTileSources(editor.rasterAssets, content.nodes),
  };
};

export const pasteClipboardContent = (editor, content) => {
  if (!content) {
    return;
  }

  finishEditingIfNeeded(editor);

  // Absorb inline tile payloads into the asset store before the nodes reach
  // editor state; pasted manifests then resolve refs like any other node.
  const nextContent = {
    ...content,
    nodes: absorbInlineTileSources(editor.rasterAssets, content.nodes || []),
  };
  const offset = getClipboardPasteOffset(
    editor,
    nextContent,
    JSON.stringify(nextContent)
  );

  editor.run(() => {
    editor.getState().pasteClipboardContent(nextContent, offset);
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
