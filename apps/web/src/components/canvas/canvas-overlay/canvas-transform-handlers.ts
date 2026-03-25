import { getCanvasDragHandlers } from "./canvas-drag-handlers";
import { getCanvasResizeHandlers } from "./canvas-resize-handlers";
import { getCanvasRotationHandlers } from "./canvas-rotation-handlers";

export const getCanvasTransformHandlers = ({
  editor,
  hostElement,
  queueRefresh,
  restoreHover,
  selectedBounds,
  selectedEditCapabilities,
  selectedNode,
  setIsGroupRotationPreviewVisible,
  suppressHover,
  visibleSelectedNodeIds,
}) => {
  return {
    ...getCanvasDragHandlers({
      editor,
      hostElement,
      queueRefresh,
      restoreHover,
      selectedNode,
      visibleSelectedNodeIds,
    }),
    ...getCanvasResizeHandlers({
      editor,
      hostElement,
      queueRefresh,
      restoreHover,
      selectedNode,
      suppressHover,
      visibleSelectedNodeIds,
    }),
    ...getCanvasRotationHandlers({
      editor,
      hostElement,
      queueRefresh,
      restoreHover,
      selectedBounds,
      selectedEditCapabilities,
      selectedNode,
      setIsGroupRotationPreviewVisible,
      suppressHover,
      visibleSelectedNodeIds,
    }),
  };
};
