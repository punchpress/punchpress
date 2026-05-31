import { PERF_COUNTERS } from "@punchpress/engine";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { CanvasHoverPreview } from "./visuals/hover-preview";

// Stage-local overlays scroll and zoom with canvas content.
export const CanvasStageOverlays = () => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderCanvasStageOverlay);

  return <CanvasHoverPreview />;
};
