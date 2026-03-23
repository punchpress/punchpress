import { useEditorValue } from "../../../editor-react/use-editor-value";
import { getHostRectFromCanvasBounds } from "./canvas-overlay-geometry";
import { getTransformFlags } from "./canvas-overlay-interactions";

export const useCanvasTransformState = (
  editor,
  isGroupRotationPreviewVisible
) => {
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const editingNodeId = useEditorValue((_, state) => state.editingNodeId);
  const pathEditingNodeId = useEditorValue(
    (_, state) => state.pathEditingNodeId
  );
  const isTextPathPositioning = useEditorValue(
    (_, state) => state.isTextPathPositioning
  );
  const visibleSelectedNodeIds = useEditorValue((editor, state) => {
    return state.selectedNodeIds.filter((nodeId) => {
      return (
        editor.isNodeEffectivelyVisible(nodeId) &&
        Boolean(editor.getNodeFrame(nodeId))
      );
    });
  });
  const effectiveSelectedNodeIds = useEditorValue((editor, state) => {
    return editor
      .getEffectiveSelectionNodeIds(state.selectedNodeIds)
      .filter((nodeId) => editor.isNodeEffectivelyVisible(nodeId));
  });
  const selectedNode = useEditorValue((editor) => {
    if (visibleSelectedNodeIds.length !== 1) {
      return null;
    }

    return editor.getNode(visibleSelectedNodeIds[0]);
  });
  const selectedGeometry = useEditorValue((editor) => {
    if (
      !(visibleSelectedNodeIds.length === 1 && selectedNode?.type === "text")
    ) {
      return null;
    }

    return editor.getNodeGeometry(visibleSelectedNodeIds[0]);
  });
  const selectedBounds = useEditorValue((editor) => {
    return editor.getSelectionBounds(effectiveSelectedNodeIds);
  });
  const selectedTargets = effectiveSelectedNodeIds
    .filter((nodeId) => editor.isNodeEffectivelyVisible(nodeId))
    .map((nodeId) => {
      if (pathEditingNodeId === nodeId && isTextPathPositioning) {
        return null;
      }

      if (pathEditingNodeId === nodeId) {
        return editor.getNodeTransformElement(nodeId);
      }

      return (
        editor.getNodeTransformElement(nodeId) || editor.getNodeElement(nodeId)
      );
    })
    .filter(Boolean);
  const selectionFrameKey = editor.getSelectionFrameKey(
    effectiveSelectedNodeIds
  );

  const visibleSelectedNodeId = visibleSelectedNodeIds.at(-1) || null;
  const selectedTarget = selectedTargets[0] || null;
  const hasGroupSelection =
    effectiveSelectedNodeIds.length > 1 || selectedNode?.type === "group";
  const isPathEditingSelection = Boolean(
    !hasGroupSelection &&
      selectedNode?.id &&
      pathEditingNodeId === selectedNode.id
  );
  const groupRotationPreviewRect =
    isGroupRotationPreviewVisible && hasGroupSelection
      ? getHostRectFromCanvasBounds(editor, selectedBounds)
      : null;

  const { isDraggable, isResizable, isRotatable } = getTransformFlags({
    activeTool,
    editingNodeId,
    hasGroupSelection,
    isPathEditingSelection,
    selectedBounds,
    selectedGeometry,
    selectedNode,
    selectedTarget,
    selectedTargets,
  });

  return {
    activeTool,
    editingNodeId,
    effectiveSelectedNodeIds,
    groupRotationPreviewRect,
    hasGroupSelection,
    hostElement: editor.hostRef,
    isDraggable,
    isPathEditingSelection,
    isResizable,
    isRotatable,
    selectedBounds,
    selectedGeometry,
    selectedNode,
    selectedTarget,
    selectedTargets,
    selectionFrameKey,
    visibleSelectedNodeId,
    visibleSelectedNodeIds,
  };
};
