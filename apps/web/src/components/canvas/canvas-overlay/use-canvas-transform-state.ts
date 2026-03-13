import { isNodeVisible } from "../../../editor/shapes/warp-text/model";
import { useEditorValue } from "../../../editor/use-editor-value";
import { getHostRectFromCanvasBounds } from "./canvas-overlay-geometry";
import { getTransformFlags } from "./canvas-overlay-interactions";

export const useCanvasTransformState = (
  editor,
  isGroupRotationPreviewVisible
) => {
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const editingNodeId = useEditorValue((_, state) => state.editingNodeId);
  const visibleSelectedNodeIds = useEditorValue((editor, state) => {
    return state.selectedNodeIds.filter((nodeId) => {
      return isNodeVisible(editor.getNode(nodeId));
    });
  });
  const selectedTargets = useEditorValue((editor, state) => {
    return state.selectedNodeIds
      .filter((nodeId) => isNodeVisible(editor.getNode(nodeId)))
      .map((nodeId) => editor.getNodeElement(nodeId))
      .filter(Boolean);
  });

  const visibleSelectedNodeId = visibleSelectedNodeIds.at(-1) || null;
  const selectedNode = useEditorValue((editor) => {
    if (visibleSelectedNodeIds.length !== 1) {
      return null;
    }

    return editor.getNode(visibleSelectedNodeId);
  });
  const selectedGeometry = useEditorValue((editor) => {
    if (visibleSelectedNodeIds.length !== 1) {
      return null;
    }

    return editor.getNodeGeometry(visibleSelectedNodeId);
  });
  const selectedBounds = useEditorValue((editor) => {
    return editor.getSelectionBounds(visibleSelectedNodeIds);
  });
  const selectionFrameKey = useEditorValue((editor) => {
    return editor.getSelectionFrameKey(visibleSelectedNodeIds);
  });

  const hostElement = editor.hostRef;
  const selectedTarget = selectedTargets[0] || null;
  const hasGroupSelection = visibleSelectedNodeIds.length > 1;
  const groupRotationPreviewRect =
    isGroupRotationPreviewVisible && hasGroupSelection
      ? getHostRectFromCanvasBounds(editor, selectedBounds)
      : null;

  const { isDraggable, isResizable, isRotatable } = getTransformFlags({
    activeTool,
    editingNodeId,
    hasGroupSelection,
    selectedBounds,
    selectedGeometry,
    selectedNode,
    selectedTarget,
    selectedTargets,
  });

  return {
    activeTool,
    editingNodeId,
    groupRotationPreviewRect,
    hasGroupSelection,
    hostElement,
    isDraggable,
    isResizable,
    isRotatable,
    selectedBounds,
    selectedGeometry,
    selectedNode,
    selectedTarget,
    selectedTargets,
    selectionFrameKey,
    visibleSelectedNodeIds,
  };
};
