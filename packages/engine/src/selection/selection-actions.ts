import {
  finalizeEditing,
  finishEditingIfNeeded,
} from "../editing/editing-actions";
import { measurePerf } from "../perf/perf-hooks";
import { PERF_SPANS } from "../perf/perf-labels";

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
  return measurePerf(PERF_SPANS.selectionClearApply, () => {
    measurePerf(PERF_SPANS.selectionClearFinishEditing, () =>
      finishEditingIfNeeded(editor)
    );

    if (editor.focusedGroupId) {
      measurePerf(PERF_SPANS.selectionClearFocusedGroup, () =>
        editor.getState().setFocusedGroupId(null)
      );
    }

    measurePerf(PERF_SPANS.selectionClearStore, () =>
      editor.getState().clearSelection()
    );
  });
};

export const clearSelectionPreservingFocus = (editor) => {
  return measurePerf(PERF_SPANS.selectionClearApply, () => {
    measurePerf(PERF_SPANS.selectionClearFinishEditing, () =>
      finishEditingIfNeeded(editor)
    );
    measurePerf(PERF_SPANS.selectionClearStore, () =>
      editor.getState().clearSelection()
    );
  });
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
  return measurePerf(PERF_SPANS.selectionSelectApply, () => {
    const resolvedNodeIds = measurePerf(PERF_SPANS.selectionTargetsResolve, () =>
      getResolvedNodeIds(editor, nodeIds)
    );

    if (
      editor.editingNodeId &&
      (resolvedNodeIds.length !== 1 ||
        resolvedNodeIds[0] !== editor.editingNodeId)
    ) {
      measurePerf(PERF_SPANS.selectionFinalizeEditing, () =>
        finalizeEditing(editor)
      );
    }

    measurePerf(PERF_SPANS.selectionStoreSelect, () =>
      editor.getState().selectNodes(resolvedNodeIds)
    );
  });
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
