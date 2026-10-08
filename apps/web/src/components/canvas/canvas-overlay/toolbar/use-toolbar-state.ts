import { useMemo } from "react";
import { useEditorValue } from "../../../../editor-react/use-editor-value";

const getPathPointKey = (point) => {
  return point ? `${point.contourIndex}:${point.segmentIndex}` : "none";
};

const getPathPointsKey = (points) => {
  return points.map((point) => getPathPointKey(point)).join("|") || "none";
};

const getSelectedPathPointCornerControlKind = (
  editor,
  editableNode,
  selectedPathPoint
) => {
  if (!(editableNode?.id && selectedPathPoint)) {
    return null;
  }

  return (
    editor.getPathPointCornerControl(editableNode.id, selectedPathPoint)
      ?.kind || null
  );
};

const getVisibleSelectedNodeIds = (editor, state) => {
  return state.selectedNodeIds.filter((nodeId) => {
    return (
      editor.isNodeEffectivelyVisible(nodeId) &&
      Boolean(editor.getNodeFrame(nodeId))
    );
  });
};

const getEditableToolbarNodeState = (editor, visibleSelectedNodeIds) => {
  if (visibleSelectedNodeIds.length !== 1) {
    return {
      editableNode: null,
      selectedEditCapabilities: null,
    };
  }

  const selectedNode = editor.getNode(visibleSelectedNodeIds[0]);
  const pathEditingTargetNodeId = selectedNode
    ? editor.getPathEditingEntryNodeId(selectedNode.id)
    : null;
  const editableNode =
    pathEditingTargetNodeId && pathEditingTargetNodeId !== selectedNode?.id
      ? editor.getNode(pathEditingTargetNodeId)
      : selectedNode;

  return {
    editableNode,
    selectedEditCapabilities: pathEditingTargetNodeId
      ? editor.getNodeEditCapabilities(pathEditingTargetNodeId)
      : null,
  };
};

const NO_PATH_POINTS: unknown[] = [];

// The selector returns primitives (and live path-editing references) so a
// property edit on the selected node does not re-render the toolbar; the
// structured state the actions read is rebuilt only when those change.
export const useSelectionToolbarState = () => {
  const toolbarValues = useEditorValue(selectSelectionToolbarValues);

  return useMemo(() => {
    if (!toolbarValues) {
      return null;
    }

    const {
      canExclude,
      canIntersect,
      canSubtract,
      canUnite,
      selectedNodeId,
      selectedNodeType,
      visibleSelectedNodeKey,
      ...values
    } = toolbarValues;

    return {
      ...values,
      selectedNode: selectedNodeId
        ? { id: selectedNodeId, type: selectedNodeType }
        : null,
      selectionBooleanOperations: {
        exclude: canExclude,
        intersect: canIntersect,
        subtract: canSubtract,
        unite: canUnite,
      },
      visibleSelectedNodeIds: visibleSelectedNodeKey.split("\0"),
    };
  }, [toolbarValues]);
};

const selectSelectionToolbarValues = (editor, state) => {
  if (state.editingNodeId || state.rasterCropSession) {
    return null;
  }

  const visibleSelectedNodeIds = getVisibleSelectedNodeIds(editor, state);

  if (visibleSelectedNodeIds.length === 0) {
    return null;
  }

  const { editableNode, selectedEditCapabilities } =
    getEditableToolbarNodeState(editor, visibleSelectedNodeIds);
  const isPathEditing = Boolean(
    editableNode?.id && state.pathEditingNodeId === editableNode.id
  );
  const selectedPathPoint =
    isPathEditing &&
    state.pathEditingPoints.length === 1 &&
    state.pathEditingPoint
      ? state.pathEditingPoint
      : null;
  const selectedPathPoints = isPathEditing
    ? state.pathEditingPoints
    : NO_PATH_POINTS;
  const selectedPathPointCornerControlKind =
    getSelectedPathPointCornerControlKind(
      editor,
      editableNode,
      selectedPathPoint
    );
  const pathPointKey = isPathEditing
    ? getPathPointsKey(selectedPathPoints)
    : getPathPointKey(selectedPathPoint);
  const primaryPathPointKey = getPathPointKey(selectedPathPoint);
  const selectionBooleanOperations = editor.getSelectionBooleanOperations(
    visibleSelectedNodeIds
  );

  return {
    canBoolean: selectionBooleanOperations.hasAny,
    canEditPath: Boolean(selectedEditCapabilities?.canEditPath),
    canExclude: selectionBooleanOperations.exclude,
    canIntersect: selectionBooleanOperations.intersect,
    canSubtract: selectionBooleanOperations.subtract,
    canUnite: selectionBooleanOperations.unite,
    hasPathEditingMode: Boolean(selectedEditCapabilities?.requiresPathEditing),
    isPathEditing,
    // Path actions query live contours, so path edits still re-render.
    pathEditingNode: isPathEditing ? editableNode : null,
    selectedNodeId: editableNode?.id || null,
    selectedNodeType: editableNode?.type || null,
    selectedPathPoint,
    selectedPathPointCornerControlKind,
    selectedPathPoints,
    selectionKey: `${visibleSelectedNodeIds.join(",")}:${isPathEditing ? `path:${pathPointKey}:${primaryPathPointKey}:${selectedPathPointCornerControlKind || "none"}` : "node"}`,
    visibleSelectedNodeKey: visibleSelectedNodeIds.join("\0"),
  };
};
