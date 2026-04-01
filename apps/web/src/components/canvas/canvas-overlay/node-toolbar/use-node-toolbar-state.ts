import { useEditorValue } from "../../../../editor-react/use-editor-value";

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
    const selectedPointType =
      selectedNode?.id && selectedPathPoint
        ? editor.getPathPointType(selectedNode.id, selectedPathPoint)
        : null;
    const pathPointKey = selectedPathPoint
      ? `${selectedPathPoint.contourIndex}:${selectedPathPoint.segmentIndex}`
      : "none";

    return {
      canEditPath: Boolean(selectedEditCapabilities?.canEditPath),
      hasPathEditingMode: Boolean(
        selectedEditCapabilities?.requiresPathEditing
      ),
      isPathEditing,
      selectedPathPoint,
      selectedPointType,
      selectedNode,
      selectionKey: `${visibleSelectedNodeIds.join(",")}:${isPathEditing ? `path:${pathPointKey}` : "node"}`,
      visibleSelectedNodeIds,
    };
  });
};
