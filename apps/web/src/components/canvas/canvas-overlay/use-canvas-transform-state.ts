import { isContainerNode } from "@punchpress/engine";
import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { getTransformFlags } from "./canvas-overlay-interactions";

const EMPTY_PREVIEW = { x: 0, y: 0 };

export const useCanvasTransformState = (editor) => {
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
  const selectedEditCapabilities = useEditorValue((editor) => {
    if (!(visibleSelectedNodeIds.length === 1 && selectedNode?.id)) {
      return null;
    }

    return editor.getNodeEditCapabilities(visibleSelectedNodeIds[0]);
  });
  const selectedBounds = useEditorSurfaceValue((editor) => {
    return editor.getSelectionBounds(effectiveSelectedNodeIds);
  });
  const selectionFrameKey = useEditorSurfaceValue((editor) => {
    return editor.getSelectionFrameKey(effectiveSelectedNodeIds);
  });
  const selectionPreview = useEditorSurfaceValue((editor) => {
    return (
      editor.getSelectionPreviewDelta(effectiveSelectedNodeIds) || EMPTY_PREVIEW
    );
  });
  const zoom = useEditorValue((editor) => editor.zoom);

  const hasGroupSelection =
    effectiveSelectedNodeIds.length > 1 || isContainerNode(selectedNode);
  const isPathEditingSelection = Boolean(
    !hasGroupSelection &&
      selectedNode?.id &&
      pathEditingNodeId === selectedNode.id
  );

  const { isDraggable, isResizable, isRotatable } = getTransformFlags({
    activeTool,
    editingNodeId,
    hasGroupSelection,
    isPathEditingSelection,
    isTextPathPositioning,
    selectedBounds,
    selectedEditCapabilities,
    selectedNode,
  });

  return {
    activeTool,
    editingNodeId,
    effectiveSelectedNodeIds,
    hasGroupSelection,
    hostElement: editor.hostRef,
    isDraggable,
    isPathEditingSelection,
    isTextPathPositioning,
    isResizable,
    isRotatable,
    selectedBounds,
    selectedEditCapabilities,
    selectedNode,
    selectionPreview,
    selectionFrameKey,
    visibleSelectedNodeIds,
    zoom,
  };
};
