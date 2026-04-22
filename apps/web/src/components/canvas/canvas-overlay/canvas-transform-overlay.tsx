import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import { CanvasMultiNodeTransformOverlay } from "./canvas-multi-node-transform-overlay";
import { CanvasSingleNodeTransformOverlay } from "./canvas-single-node-transform-overlay";

export const CanvasTransformOverlay = () => {
  const overlayState = useEditorSurfaceValue((editor) => {
    return editor.getCanvasTransformOverlayState();
  });

  if (overlayState?.mode === "single" && overlayState.selectedNodeId) {
    return (
      <CanvasSingleNodeTransformOverlay
        isDraggable={overlayState.isDraggable}
        isResizable={overlayState.isResizable}
        isRotatable={overlayState.isRotatable}
        nodeId={overlayState.selectedNodeId}
        selectionGhost={overlayState.selectionGhost || null}
      />
    );
  }

  if (overlayState?.mode === "multi") {
    return (
      <CanvasMultiNodeTransformOverlay
        isDraggable={overlayState.isDraggable}
        isResizable={overlayState.isResizable}
        isRotatable={overlayState.isRotatable}
        nodeIds={overlayState.nodeIds}
        selectedGroupNodeId={overlayState.selectedGroupNodeId}
      />
    );
  }

  return null;
};
