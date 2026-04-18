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

export const useNodeToolbarState = () => {
  return useEditorValue((editor, state) => {
    if (state.editingNodeId) {
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
    const selectedPathPoints = isPathEditing ? state.pathEditingPoints : [];
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
      selectionBooleanOperations,
      canEditPath: Boolean(selectedEditCapabilities?.canEditPath),
      hasPathEditingMode: Boolean(
        selectedEditCapabilities?.requiresPathEditing
      ),
      isPathEditing,
      selectedPathPoint,
      selectedPathPointCornerControlKind,
      selectedPathPoints,
      selectedNode: editableNode,
      selectionKey: `${visibleSelectedNodeIds.join(",")}:${isPathEditing ? `path:${pathPointKey}:${primaryPathPointKey}:${selectedPathPointCornerControlKind || "none"}` : "node"}`,
      visibleSelectedNodeIds,
    };
  });
};
