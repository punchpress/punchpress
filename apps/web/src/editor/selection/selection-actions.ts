import {
  finalizeEditing,
  finishEditingIfNeeded,
} from "../editing/editing-actions";

export const clearSelection = (editor) => {
  finishEditingIfNeeded(editor);
  editor.getState().clearSelection();
};

export const select = (editor, nodeId) => {
  if (!nodeId) {
    clearSelection(editor);
    return;
  }

  if (editor.editingNodeId && editor.editingNodeId !== nodeId) {
    finalizeEditing(editor);
  }

  editor.getState().selectNode(nodeId);
};

export const setSelectedNodes = (editor, nodeIds) => {
  if (
    editor.editingNodeId &&
    (nodeIds.length !== 1 || nodeIds[0] !== editor.editingNodeId)
  ) {
    finalizeEditing(editor);
  }

  editor.getState().selectNodes(nodeIds);
};

export const toggleSelection = (editor, nodeId) => {
  if (!nodeId) {
    return;
  }

  if (editor.editingNodeId) {
    finalizeEditing(editor);
  }

  editor.getState().toggleNodeSelection(nodeId);
};

export const deselect = (editor, nodeId) => {
  if (!nodeId) {
    clearSelection(editor);
    return;
  }

  if (!isSelected(editor, nodeId)) {
    return;
  }

  setSelectedNodes(
    editor,
    editor.selectedNodeIds.filter((selectedNodeId) => selectedNodeId !== nodeId)
  );
};

export const ensureSelected = (editor, nodeId) => {
  if (!nodeId || isSelected(editor, nodeId)) {
    return;
  }

  select(editor, nodeId);
};

export const isSelected = (editor, nodeId) => {
  return editor.selectedNodeIds.includes(nodeId);
};
