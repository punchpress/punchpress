import {
  finalizeEditing,
  finishEditingIfNeeded,
} from "../editing/editing-actions";

export const clearSelection = (editor) => {
  finishEditingIfNeeded(editor);
  editor.getState().clearSelection();
};

export const selectNode = (editor, nodeId) => {
  if (!nodeId) {
    clearSelection(editor);
    return;
  }

  if (editor.editingNodeId && editor.editingNodeId !== nodeId) {
    finalizeEditing(editor);
  }

  editor.getState().selectNode(nodeId);
};

export const selectNodes = (editor, nodeIds) => {
  if (
    editor.editingNodeId &&
    (nodeIds.length !== 1 || nodeIds[0] !== editor.editingNodeId)
  ) {
    finalizeEditing(editor);
  }

  editor.getState().selectNodes(nodeIds);
};

export const toggleNodeSelection = (editor, nodeId) => {
  if (!nodeId) {
    return;
  }

  if (editor.editingNodeId) {
    finalizeEditing(editor);
  }

  editor.getState().toggleNodeSelection(nodeId);
};

export const ensureNodeSelected = (editor, nodeId) => {
  if (!nodeId || isNodeSelected(editor, nodeId)) {
    return;
  }

  selectNode(editor, nodeId);
};

export const isNodeSelected = (editor, nodeId) => {
  return editor.selectedNodeIds.includes(nodeId);
};
