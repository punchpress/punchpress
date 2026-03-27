import { createDefaultNode } from "../nodes/text/model";
import { getTextNodePlacementOrigin } from "../nodes/text/text-placement";

export const addShapeNode = (editor, point, shape) => {
  finishEditingIfNeeded(editor);
  editor.run(() => {
    editor.getState().addShapeNode(point, shape || editor.nextShapeKind);
  });
};

export const addTextNode = (editor, point) => {
  finishEditingIfNeeded(editor);
  const font = editor.getDefaultFont();
  const placementOrigin = point
    ? getTextNodePlacementOrigin(
        createDefaultNode(font),
        point,
        editor.fonts.getLoadedFont(font)
      )
    : point;

  editor.editingHistoryMark = editor.markHistoryStep("add text");
  editor.getState().addTextNode(placementOrigin, font);
};

export const cancelEditing = (editor) => {
  editor.getState().cancelEditing();
  commitEditingHistoryStep(editor);
  editor.getState().setActiveTool("pointer");
};

export const commitEditing = (editor) => {
  editor.getState().commitEditing();
};

export const finalizeEditing = (editor) => {
  commitEditing(editor);
  commitEditingHistoryStep(editor);
  editor.getState().setActiveTool("pointer");
};

export const setActiveTool = (editor, toolId) => {
  if (!editor.tools.has(toolId)) {
    return;
  }

  if (toolId !== "text" && editor.editingNodeId) {
    finalizeEditing(editor);
  }

  editor.getState().setActiveTool(toolId);
};

export const setEditingText = (editor, value) => {
  editor.getState().setEditingText(value);
};

export const startEditing = (editor, node) => {
  if (editor.editingNodeId && editor.editingNodeId !== node.id) {
    finalizeEditing(editor);
  }

  if (!editor.editingHistoryMark) {
    editor.editingHistoryMark = editor.markHistoryStep("edit text");
  }

  editor.getState().startEditing(node);
};

export const finishEditingIfNeeded = (editor) => {
  if (!editor.editingNodeId) {
    return;
  }

  finalizeEditing(editor);
};

const commitEditingHistoryStep = (editor) => {
  if (!editor.editingHistoryMark) {
    return;
  }

  editor.commitHistoryStep(editor.editingHistoryMark);
  editor.editingHistoryMark = null;
};
