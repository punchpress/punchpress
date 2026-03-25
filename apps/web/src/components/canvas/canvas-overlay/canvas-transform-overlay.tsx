import { useEditor } from "../../../editor-react/use-editor";
import { CanvasMultiNodeTransformOverlay } from "./canvas-multi-node-transform-overlay";
import { CanvasSingleNodeTransformOverlay } from "./canvas-single-node-transform-overlay";
import { useCanvasTransformState } from "./use-canvas-transform-state";

const getOverlayMode = ({
  activeTool,
  editingNodeId,
  hasGroupSelection,
  hostElement,
  isTextPathPositioning,
  selectedNode,
  visibleSelectedNodeIds,
}) => {
  if (
    !(
      activeTool === "pointer" &&
      !editingNodeId &&
      hostElement &&
      !isTextPathPositioning
    )
  ) {
    return null;
  }

  if (hasGroupSelection && visibleSelectedNodeIds.length > 0) {
    return "multi";
  }

  return selectedNode?.id ? "single" : null;
};

export const CanvasTransformOverlay = () => {
  const editor = useEditor();
  const overlayState = useCanvasTransformState(editor);
  const overlayMode = getOverlayMode(overlayState);

  if (overlayMode === "single" && overlayState.selectedNode?.id) {
    return (
      <CanvasSingleNodeTransformOverlay
        isDraggable={overlayState.isDraggable}
        isResizable={overlayState.isResizable}
        isRotatable={overlayState.isRotatable}
        nodeId={overlayState.selectedNode.id}
      />
    );
  }

  if (overlayMode === "multi") {
    return (
      <CanvasMultiNodeTransformOverlay
        isDraggable={overlayState.isDraggable}
        isResizable={overlayState.isResizable}
        isRotatable={overlayState.isRotatable}
        nodeIds={overlayState.visibleSelectedNodeIds}
        selectedGroupNodeId={
          overlayState.selectedNode?.type === "group"
            ? overlayState.selectedNode.id
            : null
        }
      />
    );
  }

  return null;
};
