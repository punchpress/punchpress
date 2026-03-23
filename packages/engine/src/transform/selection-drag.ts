import { duplicateForDrag } from "../document/node-actions";
import { finishEditingIfNeeded } from "../editing/editing-actions";
import {
  beginMoveSelection,
  moveSelectionBy,
  updateMoveSelection,
} from "./move-selection";

const hasAbsoluteMoveInput = ({ dragEvents, left, top } = {}) => {
  return Boolean(
    dragEvents?.length > 0 || (Number.isFinite(left) && Number.isFinite(top))
  );
};

export const beginSelectionDrag = (
  editor,
  { duplicate = false, nodeId, nodeIds } = {}
) => {
  finishEditingIfNeeded(editor);

  const historyMark = editor.markHistoryStep(
    duplicate ? "duplicate selection" : "move selection"
  );

  if (!historyMark) {
    return null;
  }

  if (duplicate) {
    duplicateForDrag(editor, nodeId);
  }

  const moveSession = beginMoveSelection(
    editor,
    duplicate ? undefined : { nodeId, nodeIds }
  );

  if (!moveSession) {
    editor.revertToMark(historyMark);
    return null;
  }

  editor.setHoveringSuppressed(true);

  return {
    changed: duplicate,
    historyMark,
    moveSession,
  };
};

export const updateSelectionDrag = (editor, session, options = {}) => {
  if (!session) {
    return [];
  }

  let movedNodeIds: string[] = [];

  if (options.delta) {
    movedNodeIds = moveSelectionBy(editor, {
      queueRefresh: options.queueRefresh,
      x: options.delta.x,
      y: options.delta.y,
    });
  } else if (hasAbsoluteMoveInput(options)) {
    movedNodeIds = updateMoveSelection(editor, session.moveSession, options);
  }

  if (movedNodeIds.length > 0) {
    session.changed = true;

    if (!session.isActive) {
      editor.beginSelectionDragInteraction();
      session.isActive = true;
    }
  }

  return movedNodeIds;
};

export const endSelectionDrag = (editor, session, options = {}) => {
  if (!session) {
    return false;
  }

  if (options.delta || hasAbsoluteMoveInput(options)) {
    updateSelectionDrag(editor, session, options);
  }

  if (session.isActive) {
    editor.endSelectionDragInteraction();
  } else {
    editor.setHoveringSuppressed(false);
  }

  if (options.cancel || !session.changed) {
    return editor.revertToMark(session.historyMark);
  }

  return editor.commitHistoryStep(session.historyMark);
};
