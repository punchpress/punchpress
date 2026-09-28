import { PERF_COUNTERS } from "@punchpress/engine";
import { useEffect, useState } from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { CanvasSelectionForeground } from "./selection/selection-foreground";
import { CanvasSelectionMarquee } from "./selection/selection-marquee";
import { CanvasTextPathGuides } from "./text/path-guides";
import { CanvasSelectionToolbar } from "./toolbar/selection-toolbar";
import {
  CanvasMultiVectorEditor,
  CanvasVectorEditor,
} from "./vector-path/editor";

// Host-anchored overlay stack. Stage-local previews live in CanvasStageOverlays.
export const CanvasHostOverlays = () => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderCanvasOverlay);
  const editor = useEditor();
  const isRasterCropping = useEditorValue((_, state) =>
    Boolean(state.rasterCropSession)
  );
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

  if (isRasterCropping) {
    return null;
  }

  return (
    <>
      <CanvasSelectionMarquee />
      <CanvasSelectionToolbar />
      <CanvasTextPathGuides viewportRevision={viewportRevision} />
      <CanvasMultiVectorEditor viewportRevision={viewportRevision} />
      <CanvasVectorEditor viewportRevision={viewportRevision} />
      <CanvasSelectionForeground viewportRevision={viewportRevision} />
    </>
  );
};
