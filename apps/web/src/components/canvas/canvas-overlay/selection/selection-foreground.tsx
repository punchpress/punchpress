import { useEditorSurfaceValue } from "../../../../editor-react/use-editor-surface-value";
import { CanvasShapeIndicator } from "../visuals/shape-indicator";
import { CanvasMultiSelectionForeground } from "./multi-selection-foreground";
import { CanvasSingleSelectionForeground } from "./single-selection-foreground";

export const CanvasSelectionForeground = ({ viewportRevision }) => {
  const overlayState = useEditorSurfaceValue((editor) => {
    return editor.getCanvasTransformOverlayState();
  });

  if (overlayState?.mode === "single" && overlayState.selectedNodeId) {
    return (
      <>
        <CanvasSingleSelectionForeground
          isDraggable={overlayState.isDraggable}
          isResizable={overlayState.isResizable}
          isRotatable={overlayState.isRotatable}
          nodeId={overlayState.selectedNodeId}
          selectionGhost={overlayState.selectionGhost || null}
        />
        <CanvasShapeIndicator viewportRevision={viewportRevision} />
      </>
    );
  }

  if (overlayState?.mode === "multi") {
    return (
      <>
        <CanvasMultiSelectionForeground
          isDraggable={overlayState.isDraggable}
          isResizable={overlayState.isResizable}
          isRotatable={overlayState.isRotatable}
          nodeIds={overlayState.nodeIds}
          selectedGroupNodeId={overlayState.selectedGroupNodeId}
        />
        <CanvasShapeIndicator viewportRevision={viewportRevision} />
      </>
    );
  }

  return <CanvasShapeIndicator viewportRevision={viewportRevision} />;
};
