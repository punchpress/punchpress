import {
  finalizeEditing,
  finishEditingIfNeeded,
} from "../editing/editing-actions";

const getResolvedNodeIds = (editor, nodeIds) => {
  let shouldExitFocusedGroup = false;

  const resolvedNodeIds = nodeIds
    .map((nodeId) => {
      if (
        editor.focusedGroupId &&
        nodeId &&
        nodeId !== editor.focusedGroupId &&
        !editor.isDescendantOf(nodeId, editor.focusedGroupId)
      ) {
        shouldExitFocusedGroup = true;
      }

      return editor.getSelectionTargetNodeId(nodeId);
    })
    .filter(Boolean)
    .filter((nodeId, index, values) => values.indexOf(nodeId) === index);

  if (shouldExitFocusedGroup) {
    editor.setFocusedGroup(null);
  }

  return resolvedNodeIds;
};

export const clearSelection = (editor) => {
  finishEditingIfNeeded(editor);

  if (editor.focusedGroupId) {
    editor.getState().setFocusedGroupId(null);
  }

  editor.getState().clearSelection();
};

export const clearSelectionPreservingFocus = (editor) => {
  finishEditingIfNeeded(editor);
  editor.getState().clearSelection();
};

export const select = (editor, nodeId) => {
  if (!nodeId) {
    clearSelection(editor);
    return;
  }

  const resolvedNodeId = getResolvedNodeIds(editor, [nodeId])[0] || null;
  if (!resolvedNodeId) {
    return;
  }

  if (editor.editingNodeId && editor.editingNodeId !== resolvedNodeId) {
    finalizeEditing(editor);
  }

  editor.getState().selectNode(resolvedNodeId);
};

export const setSelectedNodes = (editor, nodeIds) => {
  const resolvedNodeIds = getResolvedNodeIds(editor, nodeIds);

  if (
    editor.editingNodeId &&
    (resolvedNodeIds.length !== 1 || resolvedNodeIds[0] !== editor.editingNodeId)
  ) {
    finalizeEditing(editor);
  }

  editor.getState().selectNodes(resolvedNodeIds);
};

export const toggleSelection = (editor, nodeId) => {
  if (!nodeId) {
    return;
  }

  const resolvedNodeId = getResolvedNodeIds(editor, [nodeId])[0] || null;
  if (!resolvedNodeId) {
    return;
  }

  if (editor.editingNodeId) {
    finalizeEditing(editor);
  }

  editor.getState().toggleNodeSelection(resolvedNodeId);
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
  const resolvedNodeId = getResolvedNodeIds(editor, [nodeId])[0] || null;

  if (!resolvedNodeId || isSelected(editor, resolvedNodeId)) {
    return;
  }

  select(editor, resolvedNodeId);
};

export const isSelected = (editor, nodeId) => {
  return editor.selectedNodeIds.includes(nodeId);
};
