import {
  beginSelectionDragInteractionState,
  beginSelectionRotationInteractionState,
  beginTextPathPositioningInteractionState,
  endSelectionDragInteractionState,
  endSelectionRotationInteractionState,
  endTextPathPositioningInteractionState,
  enterPathEditingInteractionState,
  exitPathEditingInteractionState,
} from "../state/store/interaction-state";

const applyInteractionState = (editor, patch) => {
  editor.getState().applyInteractionState(patch);
};

const selectDirectNode = (editor, nodeId) => {
  if (!nodeId) {
    return;
  }

  if (
    editor.focusedGroupId &&
    nodeId !== editor.focusedGroupId &&
    !editor.isDescendantOf(nodeId, editor.focusedGroupId)
  ) {
    editor.setFocusedGroup(null);
  }

  editor.getState().selectNode(nodeId);
};

export const startPathEditing = (editor, nodeId = editor.selectedNodeId) => {
  const targetNodeId = editor.getPathEditingEntryNodeId(nodeId);

  if (!editor.canStartPathEditing(targetNodeId) || editor.editingNodeId) {
    return false;
  }

  if (!editor.isSelected(targetNodeId)) {
    selectDirectNode(editor, targetNodeId);
  }

  applyInteractionState(editor, enterPathEditingInteractionState(targetNodeId));
  return true;
};

export const stopPathEditing = (editor) => {
  const pathEditingNodeId = editor.pathEditingNodeId;

  if (!pathEditingNodeId) {
    return false;
  }

  const selectionOwnerNodeId =
    editor.getPathEditingVisualOwnerNodeId(pathEditingNodeId);
  const shouldRestoreSelectionOwner =
    editor.selectedNodeIds.length === 1 &&
    editor.selectedNodeId === pathEditingNodeId &&
    selectionOwnerNodeId &&
    selectionOwnerNodeId !== pathEditingNodeId;

  editor.currentTool.onPathEditingStopped?.();
  applyInteractionState(editor, exitPathEditingInteractionState());

  if (shouldRestoreSelectionOwner) {
    editor.select(selectionOwnerNodeId);
  }

  return true;
};

export const beginSelectionDragInteraction = (editor) => {
  applyInteractionState(editor, beginSelectionDragInteractionState());
};

export const endSelectionDragInteraction = (editor) => {
  applyInteractionState(editor, endSelectionDragInteractionState());
};

export const beginSelectionRotationInteraction = (editor) => {
  applyInteractionState(editor, beginSelectionRotationInteractionState());
};

export const endSelectionRotationInteraction = (editor) => {
  applyInteractionState(editor, endSelectionRotationInteractionState());
};

export const beginTextPathPositioningInteraction = (editor) => {
  applyInteractionState(editor, beginTextPathPositioningInteractionState());
};

export const endTextPathPositioningInteraction = (editor) => {
  applyInteractionState(editor, endTextPathPositioningInteractionState());
};
