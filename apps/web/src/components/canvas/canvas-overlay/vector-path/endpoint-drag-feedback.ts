import type { CanvasCursorCompanion } from "../../canvas-cursor-policy";
import type { VectorEndpointDragTarget } from "./endpoint-close";
import type {
  VectorPaperSceneStyles,
  VectorSegmentChrome,
} from "./paper-session-render";

export const getVectorEndpointDragCursorCompanion = (
  target: VectorEndpointDragTarget | null
): CanvasCursorCompanion | null => {
  if (!target) {
    return null;
  }

  return {
    kind: "label",
    offsetX: 28,
    offsetY: -28,
    text: target.behavior === "close-contour" ? "Close Path" : "Snap to Point",
  };
};

export const applyVectorEndpointDragTargetChrome = (
  chrome: VectorSegmentChrome,
  styles: VectorPaperSceneStyles
) => {
  const haloFillColor = styles.hoverHalo.clone();

  haloFillColor.alpha = 0.32;
  chrome.anchorHalo.fillColor = haloFillColor;
  chrome.anchorHalo.visible = true;
  chrome.anchor.strokeColor = styles.accentFill.clone();
  chrome.anchor.fillColor = styles.backgroundFill.clone();
  chrome.anchor.strokeWidth = 2.5;
  chrome.anchorHalo.bringToFront();
  chrome.anchor.bringToFront();
};
