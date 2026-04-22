import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { CanvasHoverPreview } from "./canvas-hover-preview";

// Stage-local overlays scroll and zoom with canvas content.
export const CanvasStageOverlay = () => {
  usePerformanceRenderCounter("render.canvas.stageOverlay");

  return <CanvasHoverPreview />;
};
