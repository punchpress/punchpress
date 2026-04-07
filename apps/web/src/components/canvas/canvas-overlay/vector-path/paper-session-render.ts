import paper from "paper";
import { getVectorBezierHandleAppearance } from "./handle-appearance";
import {
  getVectorHoverHaloFillAlpha,
  getVectorHoverHaloStrokeWidthPx,
} from "./hover-halo";
import { getPenPreviewHandleAppearance } from "./pen-preview";

const ANCHOR_RADIUS_PX = 6;
export const GUIDE_STROKE_WIDTH_PX = 1.5;
const HANDLE_LINE_STROKE_WIDTH_PX = 1.25;
const HANDLE_RADIUS_PX = 6;
export const HANDLE_HOVER_RADIUS_PX = HANDLE_RADIUS_PX + 5;
export const PREVIEW_DASH_ARRAY = [8, 6];
const SELECTED_ANCHOR_SCALE = 1.2;

export interface VectorSegmentChrome {
  anchor: paper.Path.Circle;
  anchorHalo: paper.Path.Circle;
  handleIn: paper.Path.Circle;
  handleInHalo: paper.Path.Circle;
  handleInLine: paper.Path;
  handleOut: paper.Path.Circle;
  handleOutHalo: paper.Path.Circle;
  handleOutLine: paper.Path;
}

const resolveCssColor = (canvas, value, fallback) => {
  const probe = document.createElement("div");
  probe.style.color = value;
  canvas.parentElement?.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || fallback;
};

export const getSceneStyles = (scope) => {
  const canvas = scope.view.element;
  const accent = resolveCssColor(
    canvas,
    "var(--canvas-handle-accent)",
    "#165DFC"
  );
  const background = resolveCssColor(
    canvas,
    "var(--background)",
    "rgb(255 255 255)"
  );
  const destructive = resolveCssColor(
    canvas,
    "var(--destructive)",
    "rgb(239 68 68)"
  );

  return {
    destructiveFill: new scope.Color(destructive),
    destructiveHalo: (() => {
      const color = new scope.Color(
        resolveCssColor(
          canvas,
          "color-mix(in srgb, white 18%, var(--destructive) 82%)",
          "rgb(255 122 147)"
        )
      );
      color.alpha = 0.42;
      return color;
    })(),
    destructiveHighlight: (() => {
      const color = new scope.Color(
        resolveCssColor(
          canvas,
          "color-mix(in srgb, white 6%, var(--destructive) 94%)",
          "rgb(255 69 104)"
        )
      );
      color.alpha = 0.98;
      return color;
    })(),
    backgroundFill: new scope.Color(background),
    accentFill: new scope.Color(accent),
    guide: new scope.Color(accent),
    hoverHalo: (() => {
      const color = new scope.Color(
        resolveCssColor(
          canvas,
          "color-mix(in srgb, white 18%, var(--editor-accent) 82%)",
          "rgb(110 165 255)"
        )
      );
      color.alpha = 0.28;
      return color;
    })(),
    shadow: new scope.Color(0, 0, 0, 0.18),
  };
};

export type VectorPaperSceneStyles = ReturnType<typeof getSceneStyles>;

export const projectPoint = (matrix, point) => {
  return new paper.Point(
    point.x * matrix.a + point.y * matrix.c + matrix.e,
    point.x * matrix.b + point.y * matrix.d + matrix.f
  );
};

export const projectVector = (matrix, point) => {
  return new paper.Point(
    point.x * matrix.a + point.y * matrix.c,
    point.x * matrix.b + point.y * matrix.d
  );
};

export const getZeroPoint = () => new paper.Point(0, 0);

export const createAnchorItem = (scope, styles, point) => {
  const anchor = new scope.Path.Circle({
    center: point,
    fillColor: styles.backgroundFill.clone(),
    radius: ANCHOR_RADIUS_PX,
    strokeColor: styles.accentFill.clone(),
    strokeWidth: 2,
  });

  anchor.shadowBlur = 4;
  anchor.shadowColor = styles.shadow;
  anchor.shadowOffset = new scope.Point(0, 1);

  return anchor;
};

const applyHandleItemAppearance = (handle, styles) => {
  handle.fillColor = styles.accentFill.clone();
  handle.fillColor.alpha = 1;
  handle.strokeColor = null;
  handle.strokeWidth = 0;
};

export const createHandleItem = (scope, styles, point) => {
  const bezierHandleAppearance = getVectorBezierHandleAppearance();

  return new scope.Path.Circle({
    center: point,
    fillColor: styles.accentFill.clone(),
    radius: bezierHandleAppearance.radiusPx,
    strokeColor: null,
    strokeWidth: 0,
  });
};

export const createPreviewAnchorItem = (scope, styles, point) => {
  const anchor = new scope.Path.Circle({
    center: point,
    fillColor: styles.backgroundFill.clone(),
    radius: ANCHOR_RADIUS_PX,
    strokeColor: styles.accentFill.clone(),
    strokeWidth: 2,
    visible: false,
  });

  anchor.fillColor.alpha = 0.65;
  anchor.strokeColor.alpha = 0.7;

  return anchor;
};

export const createPreviewHandleItem = (scope, styles, point) => {
  const previewHandleAppearance = getPenPreviewHandleAppearance();
  const handle = new scope.Path.Circle({
    center: point,
    fillColor: styles.accentFill.clone(),
    radius: previewHandleAppearance.radiusPx,
    strokeColor: null,
    visible: false,
  });

  handle.visible = false;
  handle.fillColor.alpha =
    previewHandleAppearance.fillMode === "solid" ? 1 : 0.65;
  return handle;
};

export const createHandleLine = (scope, styles, from, to) => {
  const line = new scope.Path({
    segments: [from, to],
    strokeCap: "round",
    strokeColor: styles.guide.clone(),
    strokeWidth: HANDLE_LINE_STROKE_WIDTH_PX,
  });

  line.strokeColor.alpha = 0.6;

  return line;
};

export const createPreviewHandleLine = (scope, styles, point) => {
  const line = createHandleLine(scope, styles, point, point);

  line.visible = false;
  line.strokeColor.alpha = 0.5;
  return line;
};

export const createHoverHaloItem = (scope, styles, point, radius) => {
  const fillColor = styles.hoverHalo.clone();
  fillColor.alpha = getVectorHoverHaloFillAlpha();

  return new scope.Path.Circle({
    center: point,
    fillColor,
    radius,
    strokeColor: null,
    strokeWidth: getVectorHoverHaloStrokeWidthPx(),
    visible: false,
  });
};

const setItemScale = (item: paper.Item, nextScale: number) => {
  const currentScale =
    typeof item.data.currentScale === "number" ? item.data.currentScale : 1;

  if (currentScale === nextScale) {
    return;
  }

  item.scale(nextScale / currentScale);
  item.data.currentScale = nextScale;
};

export const refreshSegmentChrome = (
  segment,
  chrome,
  styles,
  isSelected,
  showBezierHandles = false
) => {
  chrome.anchor.position = segment.point;
  chrome.anchorHalo.position = segment.point;
  setItemScale(chrome.anchor, isSelected ? SELECTED_ANCHOR_SCALE : 1);
  chrome.anchor.fillColor = isSelected
    ? styles.accentFill.clone()
    : styles.backgroundFill.clone();
  chrome.anchor.strokeColor = isSelected
    ? styles.backgroundFill.clone()
    : styles.accentFill.clone();
  chrome.anchor.strokeWidth = isSelected ? 1.5 : 2;
  chrome.anchorHalo.visible = false;

  const handleInPoint = segment.point.add(segment.handleIn);
  const handleOutPoint = segment.point.add(segment.handleOut);
  const hasHandleIn = showBezierHandles && segment.handleIn.length > 0.01;
  const hasHandleOut = showBezierHandles && segment.handleOut.length > 0.01;

  chrome.handleInLine.segments[0].point = segment.point;
  chrome.handleInLine.segments[1].point = handleInPoint;
  chrome.handleInLine.visible = hasHandleIn;
  chrome.handleInHalo.position = handleInPoint;
  chrome.handleInHalo.visible = false;
  chrome.handleIn.position = handleInPoint;
  applyHandleItemAppearance(chrome.handleIn, styles);
  chrome.handleIn.visible = hasHandleIn;

  chrome.handleOutLine.segments[0].point = segment.point;
  chrome.handleOutLine.segments[1].point = handleOutPoint;
  chrome.handleOutLine.visible = hasHandleOut;
  chrome.handleOutHalo.position = handleOutPoint;
  chrome.handleOutHalo.visible = false;
  chrome.handleOut.position = handleOutPoint;
  applyHandleItemAppearance(chrome.handleOut, styles);
  chrome.handleOut.visible = hasHandleOut;
};
