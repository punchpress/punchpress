import { useEditorValue } from "../../../../editor-react/use-editor-value";

const getPathPointKey = (point) => {
  return point ? `${point.contourIndex}:${point.segmentIndex}` : "none";
};

const getPathPointsKey = (points) => {
  return points.map((point) => getPathPointKey(point)).join("|") || "none";
};

export const useNodeToolbarState = () => {
  return useEditorValue((editor, state) => {
    if (state.editingNodeId) {
      return null;
    }

    const visibleSelectedNodeIds = state.selectedNodeIds.filter((nodeId) => {
      return (
        editor.isNodeEffectivelyVisible(nodeId) &&
        Boolean(editor.getNodeFrame(nodeId))
      );
    });

    if (visibleSelectedNodeIds.length === 0) {
      return null;
    }

    const selectedNode =
      visibleSelectedNodeIds.length === 1
        ? editor.getNode(visibleSelectedNodeIds[0])
        : null;
    const selectedEditCapabilities = selectedNode
      ? editor.getNodeEditCapabilities(selectedNode.id)
      : null;
    const isPathEditing = Boolean(
      selectedNode?.id && state.pathEditingNodeId === selectedNode.id
    );
    const selectedPathPoint =
      isPathEditing &&
      state.pathEditingPoints.length === 1 &&
      state.pathEditingPoint
        ? state.pathEditingPoint
        : null;
    const selectedPathPoints = isPathEditing ? state.pathEditingPoints : [];
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
      selectedPathPoints,
      selectedNode,
      selectionKey: `${visibleSelectedNodeIds.join(",")}:${isPathEditing ? `path:${pathPointKey}:${primaryPathPointKey}` : "node"}`,
      visibleSelectedNodeIds,
    };
  });
};
