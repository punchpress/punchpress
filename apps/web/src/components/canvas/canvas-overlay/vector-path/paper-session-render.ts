import paper from "paper";
import {
  CANVAS_THEME_VARS,
  resolveCanvasThemeColor,
  resolveCanvasThemeLengthPx,
} from "../visuals/theme";
import { getVectorBezierHandleAppearance } from "./handle-appearance";
import {
  getVectorHoverHaloFillAlpha,
  getVectorHoverHaloStrokeWidthPx,
} from "./hover-halo";
import { getPenPreviewHandleAppearance } from "./pen-preview";

const ANCHOR_RADIUS_PX = 6;
const ANCHOR_SELECTED_STROKE_WIDTH_FALLBACK_PX = 1.5;
const ANCHOR_STROKE_WIDTH_FALLBACK_PX = 2;
const GUIDE_STROKE_WIDTH_FALLBACK_PX = 1.5;
const HANDLE_LINE_STROKE_WIDTH_FALLBACK_PX = 1.25;
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

export interface VectorPaperSceneStyles {
  anchorSelectedWidthPx: number;
  anchorWidthPx: number;
  handleLineWidthPx: number;
  hoverHalo: paper.Color;
  indicatorWidthPx: number;
  selected: paper.Color;
  shadow: paper.Color;
  surface: paper.Color;
  warning: paper.Color;
  warningSoft: paper.Color;
  warningStrong: paper.Color;
}

export const getSceneStyles = (scope): VectorPaperSceneStyles => {
  const canvas = scope.view.element;
  const selected = resolveCanvasThemeColor(
    canvas,
    CANVAS_THEME_VARS.selected,
    "rgb(22 93 252)"
  );
  const surface = resolveCanvasThemeColor(
    canvas,
    CANVAS_THEME_VARS.surface,
    "rgb(255 255 255)"
  );
  const warning = resolveCanvasThemeColor(
    canvas,
    CANVAS_THEME_VARS.warning,
    "rgb(239 68 68)"
  );
  const warningSoft = new scope.Color(
    resolveCanvasThemeColor(
      canvas,
      CANVAS_THEME_VARS.warningSoft,
      "rgb(255 122 147)"
    )
  );
  warningSoft.alpha = 0.42;

  const warningStrong = new scope.Color(
    resolveCanvasThemeColor(
      canvas,
      CANVAS_THEME_VARS.warningStrong,
      "rgb(255 69 104)"
    )
  );
  warningStrong.alpha = 0.98;

  return {
    anchorSelectedWidthPx: resolveCanvasThemeLengthPx(
      canvas,
      CANVAS_THEME_VARS.anchorSelectedWidth,
      ANCHOR_SELECTED_STROKE_WIDTH_FALLBACK_PX
    ),
    anchorWidthPx: resolveCanvasThemeLengthPx(
      canvas,
      CANVAS_THEME_VARS.anchorWidth,
      ANCHOR_STROKE_WIDTH_FALLBACK_PX
    ),
    handleLineWidthPx: resolveCanvasThemeLengthPx(
      canvas,
      CANVAS_THEME_VARS.handleLineWidth,
      HANDLE_LINE_STROKE_WIDTH_FALLBACK_PX
    ),
    hoverHalo: new scope.Color(
      resolveCanvasThemeColor(
        canvas,
        CANVAS_THEME_VARS.selectedStrong,
        "rgb(110 165 255)"
      )
    ),
    indicatorWidthPx: resolveCanvasThemeLengthPx(
      canvas,
      CANVAS_THEME_VARS.indicatorWidth,
      GUIDE_STROKE_WIDTH_FALLBACK_PX
    ),
    selected: new scope.Color(selected),
    surface: new scope.Color(surface),
    warning: new scope.Color(warning),
    warningSoft,
    warningStrong,
    shadow: new scope.Color(0, 0, 0, 0.18),
  };
};

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
    fillColor: styles.surface.clone(),
    radius: ANCHOR_RADIUS_PX,
    strokeColor: styles.selected.clone(),
    strokeWidth: styles.anchorWidthPx,
  });

  anchor.shadowBlur = 4;
  anchor.shadowColor = styles.shadow;
  anchor.shadowOffset = new scope.Point(0, 1);

  return anchor;
};

const applyHandleItemAppearance = (handle, styles) => {
  handle.fillColor = styles.selected.clone();
  handle.fillColor.alpha = 1;
  handle.strokeColor = null;
  handle.strokeWidth = 0;
};

export const createHandleItem = (scope, styles, point) => {
  const bezierHandleAppearance = getVectorBezierHandleAppearance();

  return new scope.Path.Circle({
    center: point,
    fillColor: styles.selected.clone(),
    radius: bezierHandleAppearance.radiusPx,
    strokeColor: null,
    strokeWidth: 0,
  });
};

export const createPreviewAnchorItem = (scope, styles, point) => {
  const anchor = new scope.Path.Circle({
    center: point,
    fillColor: styles.surface.clone(),
    radius: ANCHOR_RADIUS_PX,
    strokeColor: styles.selected.clone(),
    strokeWidth: styles.anchorWidthPx,
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
    fillColor: styles.selected.clone(),
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
    strokeColor: styles.selected.clone(),
    strokeWidth: styles.handleLineWidthPx,
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
    ? styles.selected.clone()
    : styles.surface.clone();
  chrome.anchor.strokeColor = isSelected
    ? styles.surface.clone()
    : styles.selected.clone();
  chrome.anchor.strokeWidth = isSelected
    ? styles.anchorSelectedWidthPx
    : styles.anchorWidthPx;
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

  if (isSelected) {
    if (hasHandleIn) {
      chrome.handleInLine.bringToFront();
      chrome.handleIn.bringToFront();
      chrome.handleInHalo.bringToFront();
    }

    if (hasHandleOut) {
      chrome.handleOutLine.bringToFront();
      chrome.handleOut.bringToFront();
      chrome.handleOutHalo.bringToFront();
    }

    chrome.anchorHalo.bringToFront();
    chrome.anchor.bringToFront();
  }
};
