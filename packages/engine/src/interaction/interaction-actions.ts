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

export const startPathEditing = (editor, nodeId = editor.selectedNodeId) => {
  if (!editor.canStartPathEditing(nodeId) || editor.editingNodeId) {
    return false;
  }

  if (!editor.isSelected(nodeId)) {
    editor.select(nodeId);
  }

  applyInteractionState(editor, enterPathEditingInteractionState(nodeId));
  return true;
};

export const stopPathEditing = (editor) => {
  if (!editor.pathEditingNodeId) {
    return false;
  }

  applyInteractionState(editor, exitPathEditingInteractionState());
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
