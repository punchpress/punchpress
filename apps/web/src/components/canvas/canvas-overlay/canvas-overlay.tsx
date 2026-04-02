import { useEffect, useState } from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { CanvasEditingSelection } from "./canvas-editing-selection";
import { CanvasSelectionOverlay } from "./canvas-selection-overlay";
import { CanvasTextPathOverlay } from "./canvas-text-path-overlay";
import { CanvasTransformOverlay } from "./canvas-transform-overlay";
import { CanvasVectorPathOverlay } from "./vector-path/vector-path-overlay";
import { CanvasNodeToolbar } from "./node-toolbar/canvas-node-toolbar";

export const CanvasOverlay = () => {
  usePerformanceRenderCounter("render.canvas.overlay");
  const editor = useEditor();
  const [viewportRevision, setViewportRevision] = useState(0);

  useEffect(() => {
    const handleViewportChange = () => {
      setViewportRevision((value) => value + 1);
    };
    editor.onViewportChange = handleViewportChange;

    return () => {
      if (editor.onViewportChange === handleViewportChange) {
        editor.onViewportChange = null;
      }
    };
  }, [editor]);

  return (
    <>
      <CanvasSelectionOverlay />
      <CanvasNodeToolbar />
      <CanvasTextPathOverlay viewportRevision={viewportRevision} />
      <CanvasVectorPathOverlay viewportRevision={viewportRevision} />
      <CanvasTransformOverlay viewportRevision={viewportRevision} />
      <CanvasEditingSelection viewportRevision={viewportRevision} />
    </>
  );
};
