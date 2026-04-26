import { useEffect, useState } from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { CanvasSelectionForeground } from "./selection/selection-foreground";
import { CanvasSelectionMarquee } from "./selection/selection-marquee";
import { CanvasTextPathGuides } from "./text/path-guides";
import { CanvasSelectionToolbar } from "./toolbar/selection-toolbar";
import { CanvasVectorEditor } from "./vector-path/editor";

// Host-anchored overlay stack. Stage-local previews live in CanvasStageOverlays.
export const CanvasHostOverlays = () => {
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
      <CanvasSelectionMarquee />
      <CanvasSelectionToolbar />
      <CanvasTextPathGuides viewportRevision={viewportRevision} />
      <CanvasVectorEditor viewportRevision={viewportRevision} />
      <CanvasSelectionForeground viewportRevision={viewportRevision} />
    </>
  );
};
