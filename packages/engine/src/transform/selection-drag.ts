import { duplicateForDrag } from "../document/node-actions";
import { finishEditingIfNeeded } from "../editing/editing-actions";
import { measurePerf } from "../perf/perf-hooks";
import {
  beginMoveSelection,
  commitMoveSelection,
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
  return measurePerf("selection.drag.begin", () => {
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
  });
};

export const updateSelectionDrag = (editor, session, options = {}) => {
  return measurePerf("selection.drag.update", () => {
    if (!session) {
      return [];
    }

    let movedNodeIds: string[] = [];

    if (options.delta || hasAbsoluteMoveInput(options)) {
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
  });
};

export const endSelectionDrag = (editor, session, options = {}) => {
  return measurePerf("selection.drag.end", () => {
    if (!session) {
      return false;
    }

    if (options.delta || hasAbsoluteMoveInput(options)) {
      updateSelectionDrag(editor, session, options);
    }

    if (options.cancel || !session.changed) {
      if (session.isActive) {
        editor.endSelectionDragInteraction();
      } else {
        editor.setHoveringSuppressed(false);
      }

      return editor.revertToMark(session.historyMark);
    }

    commitMoveSelection(editor, session.moveSession);

    if (session.isActive) {
      editor.endSelectionDragInteraction();
    } else {
      editor.setHoveringSuppressed(false);
    }

    return editor.commitHistoryStep(session.historyMark);
  });
};
