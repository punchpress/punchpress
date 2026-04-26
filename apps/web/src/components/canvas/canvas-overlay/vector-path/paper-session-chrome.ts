import type { Editor } from "@punchpress/engine";
import type paper from "paper";
import {
  getActiveVectorPathCursorToken,
  getVectorPathCursorToken,
  setActiveCanvasCursorCompanion,
  setActiveCanvasCursorToken,
  setCanvasCursorToken,
} from "../../canvas-cursor-policy";
import {
  applyVectorEndpointDragTargetChrome,
  getVectorEndpointDragCursorCompanion,
} from "./endpoint-drag-feedback";
import {
  createPreviewAnchorItem,
  createPreviewHandleItem,
  createPreviewHandleLine,
  getZeroPoint,
  PREVIEW_DASH_ARRAY,
  projectPoint,
  projectVector,
  refreshSegmentChrome,
  type VectorSegmentChrome,
} from "./paper-session-render";
import {
  getPointSelectionKey,
  isSamePointSelection,
  normalizePointSelections,
} from "./paper-session-selection";
import type {
  HoveredPoint,
  VectorPaperSessionState,
  VectorPaperSessionSyncOptions,
} from "./paper-session-state";
import {
  getPenPreviewEndpoint,
  getPenPreviewHandleIn,
  getPenPreviewHandleOut,
  type PenPreviewState,
  shouldShowPenPreviewGhostAnchor,
  shouldShowPenPreviewHandles,
} from "./pen-preview";
import {
  getHoveredVectorCornerCurveSegment,
  getMaxedVectorCornerCurveSegments,
  getVectorCornerCurveSegmentsForPoints,
} from "./vector-corner-radius-points";
import {
  shouldShowBezierHandlesForPoint,
  shouldShowSelectedAnchorForPoint,
} from "./vector-path-selection-chrome";

const HOVERED_CORNER_CURVE_FALLBACK_STROKE_WIDTH_PX = 12;
const MAXED_CORNER_INNER_STROKE_SCALE = 0.78;
const MAXED_CORNER_OUTER_STROKE_PX = 6;
const SELECTION_MARQUEE_DASH_ARRAY = [6, 4];

const getRenderedStrokeWidthPx = (matrix, strokeWidth = 0) => {
  const projectedXScale = Math.hypot(matrix.a, matrix.b);
  const projectedYScale = Math.hypot(matrix.c, matrix.d);
  const averageScale = (projectedXScale + projectedYScale) / 2;

  if (!Number.isFinite(averageScale) || averageScale <= 0) {
    return HOVERED_CORNER_CURVE_FALLBACK_STROKE_WIDTH_PX;
  }

  if (!(strokeWidth > 0)) {
    return HOVERED_CORNER_CURVE_FALLBACK_STROKE_WIDTH_PX;
  }

  return strokeWidth * averageScale;
};

export interface PaperSessionChromeController {
  applySourceSegmentToPaper: (
    contourIndex: number,
    segmentIndex: number,
    options?: { updateView?: boolean }
  ) => void;
  getLocalPoint: (point: paper.Point) => paper.Point | null;
  hideSelectionMarquee: () => void;
  refreshPathSegmentChrome: (
    contourIndex: number,
    segmentIndex: number,
    segment: paper.Segment
  ) => void;
  setActiveCursorCompanionLabel: (text: string | null) => void;
  setActiveCursorMode: (mode: string | null) => void;
  setEndpointDragTarget: (
    target: VectorPaperSessionState["endpointDragTarget"]
  ) => void;
  setHoverCursorMode: (mode: string | null) => void;
  setHoveredPoint: (hoveredPoint: HoveredPoint) => void;
  setSelectedPoint: (point: VectorPaperSessionState["selectedPoint"]) => void;
  setSelectedPoints: (
    points: VectorPaperSessionState["selectedPoints"],
    primaryPoint?: VectorPaperSessionState["selectedPoint"]
  ) => void;
  syncHoveredChrome: () => void;
  syncNode: (options?: VectorPaperSessionSyncOptions) => void;
  syncPreviewPath: (preview: PenPreviewState | null) => void;
  syncSelectionMarquee: () => void;
}

interface CreatePaperSessionChromeControllerOptions {
  canvas: HTMLCanvasElement;
  editor: Editor;
  nodeId: string;
  onChange: (
    contours: VectorPaperSessionState["contours"],
    options?: VectorPaperSessionSyncOptions
  ) => void;
  scope: paper.PaperScope;
  state: VectorPaperSessionState;
}

export const createPaperSessionChromeController = ({
  canvas,
  editor,
  nodeId,
  onChange,
  scope,
  state,
}: CreatePaperSessionChromeControllerOptions): PaperSessionChromeController => {
  const setHoverCursorMode = (mode: string | null) => {
    setCanvasCursorToken(canvas, getVectorPathCursorToken(mode));
  };

  const setActiveCursorMode = (mode: string | null) => {
    setActiveCanvasCursorToken(
      editor.hostRef,
      getActiveVectorPathCursorToken(mode)
    );
  };

  const setActiveCursorCompanionLabel = (text: string | null) => {
    setActiveCanvasCursorCompanion(
      editor.hostRef,
      text
        ? {
            kind: "label",
            offsetX: 28,
            offsetY: -28,
            text,
          }
        : null
    );
    editor.notifyInteractionPreviewChanged();
  };

  const ensureSelectionMarquee = () => {
    if (state.selectionMarqueePath) {
      return state.selectionMarqueePath;
    }

    const fillColor = state.styles.hoverHalo.clone();
    fillColor.alpha = 0.12;
    const strokeColor = state.styles.selected.clone();
    strokeColor.alpha = 0.7;

    state.selectionMarqueePath = new scope.Path.Rectangle({
      dashArray: SELECTION_MARQUEE_DASH_ARRAY,
      fillColor,
      insert: true,
      point: getZeroPoint(),
      size: new scope.Size(0, 0),
      strokeColor,
      strokeWidth: 1,
      visible: false,
    });

    return state.selectionMarqueePath;
  };

  const hideSelectionMarquee = () => {
    state.selectionMarquee = null;

    if (!state.selectionMarqueePath) {
      return;
    }

    state.selectionMarqueePath.visible = false;
  };

  const syncSelectionMarquee = () => {
    const marquee = state.selectionMarquee;

    if (!marquee) {
      hideSelectionMarquee();
      return;
    }

    const path = ensureSelectionMarquee();
    const rectangle = new scope.Rectangle(marquee.origin, marquee.current);

    path.removeSegments();
    path.addSegments([
      rectangle.topLeft,
      rectangle.topRight,
      rectangle.bottomRight,
      rectangle.bottomLeft,
    ]);
    path.closed = true;
    path.visible = true;
  };

  const ensureHoveredCurvePath = () => {
    if (state.hoveredCurvePath) {
      return state.hoveredCurvePath;
    }

    const path = new scope.Path({
      fillColor: null,
      insert: true,
      strokeCap: "round",
      strokeColor: state.styles.selected.clone(),
      strokeJoin: "round",
      strokeWidth: HOVERED_CORNER_CURVE_FALLBACK_STROKE_WIDTH_PX,
      visible: false,
    });

    path.strokeColor.alpha = 0.7;
    state.hoveredCurvePath = path;
    return path;
  };

  const clearMaxedCurveHighlights = () => {
    for (const path of state.maxedCurvePaths) {
      path.remove();
    }

    state.maxedCurvePaths = [];
  };

  const clearActiveCurveHighlights = () => {
    for (const path of state.activeCurvePaths) {
      path.remove();
    }

    state.activeCurvePaths = [];
  };

  const getSourceSegmentsForCurveHighlight = (curveSegment) => {
    const contour = state.contours[curveSegment.contourIndex];
    const startSegment =
      curveSegment.startSegment ??
      (typeof curveSegment.startIndex === "number"
        ? contour?.segments?.[curveSegment.startIndex]
        : null);
    const endSegment =
      curveSegment.endSegment ??
      (typeof curveSegment.endIndex === "number"
        ? contour?.segments?.[curveSegment.endIndex]
        : null);

    return startSegment && endSegment
      ? {
          endSegment,
          startSegment,
        }
      : null;
  };

  const createCurveHighlightPath = (curveSegment, strokeColor, strokeWidth) => {
    if (!state.matrix) {
      return null;
    }

    const segments = getSourceSegmentsForCurveHighlight(curveSegment);

    if (!segments) {
      return null;
    }

    const path = new scope.Path({
      fillColor: null,
      insert: true,
      strokeCap: "round",
      strokeColor,
      strokeJoin: "round",
      strokeWidth,
    });

    path.add(
      new scope.Segment(
        projectPoint(state.matrix, segments.startSegment.point),
        projectVector(state.matrix, segments.startSegment.handleIn),
        projectVector(state.matrix, segments.startSegment.handleOut)
      )
    );
    path.add(
      new scope.Segment(
        projectPoint(state.matrix, segments.endSegment.point),
        projectVector(state.matrix, segments.endSegment.handleIn),
        projectVector(state.matrix, segments.endSegment.handleOut)
      )
    );

    return path;
  };

  const syncActiveCurveHighlights = () => {
    clearActiveCurveHighlights();

    if (!(state.activeDragSession && state.matrix)) {
      return;
    }

    const activeSegments = getVectorCornerCurveSegmentsForPoints(
      state.contours,
      state.activeDragSession.adjustedPoints,
      state.cornerCurveSegments
    );
    const strokeColor = state.styles.selected.clone();
    strokeColor.alpha = 0.7;
    const strokeWidth = getRenderedStrokeWidthPx(
      state.matrix,
      state.nodeStrokeWidth
    );

    state.activeCurvePaths = activeSegments.flatMap((curveSegment) => {
      const path = createCurveHighlightPath(
        curveSegment,
        strokeColor.clone(),
        strokeWidth
      );

      return path ? [path] : [];
    });
  };

  const syncMaxedCurveHighlights = () => {
    const maxedSegments = getMaxedVectorCornerCurveSegments(
      state.contours,
      state.selectedPoints,
      state.activeDragSession?.maxRadius ?? null,
      state.activeDragSession,
      state.cornerCurveSegments
    );

    clearMaxedCurveHighlights();

    if (
      !(state.activeDragSession && maxedSegments.length > 0 && state.matrix)
    ) {
      return;
    }

    state.maxedCurvePaths = maxedSegments.flatMap((maxedSegment) => {
      const segments = getSourceSegmentsForCurveHighlight(maxedSegment);

      if (!segments) {
        return [];
      }

      const renderedStrokeWidth = getRenderedStrokeWidthPx(
        state.matrix,
        state.nodeStrokeWidth
      );
      const outerPath = new scope.Path({
        fillColor: null,
        insert: true,
        strokeCap: "round",
        strokeColor: state.styles.warningSoft.clone(),
        strokeJoin: "round",
        strokeWidth: renderedStrokeWidth + MAXED_CORNER_OUTER_STROKE_PX,
      });
      const innerPath = new scope.Path({
        fillColor: null,
        insert: true,
        strokeCap: "round",
        strokeColor: state.styles.warningStrong.clone(),
        strokeJoin: "round",
        strokeWidth: Math.max(
          4,
          renderedStrokeWidth * MAXED_CORNER_INNER_STROKE_SCALE
        ),
      });

      for (const path of [outerPath, innerPath]) {
        path.add(
          new scope.Segment(
            projectPoint(state.matrix, segments.startSegment.point),
            projectVector(state.matrix, segments.startSegment.handleIn),
            projectVector(state.matrix, segments.startSegment.handleOut)
          )
        );
        path.add(
          new scope.Segment(
            projectPoint(state.matrix, segments.endSegment.point),
            projectVector(state.matrix, segments.endSegment.handleIn),
            projectVector(state.matrix, segments.endSegment.handleOut)
          )
        );
      }

      return [outerPath, innerPath];
    });
  };

  const syncHoveredCurveHighlight = () => {
    if (state.activeDragSession) {
      if (state.hoveredCurvePath) {
        state.hoveredCurvePath.visible = false;
      }
      return;
    }

    const hoveredSegment = getHoveredVectorCornerCurveSegment(
      state.contours,
      state.hoveredCornerHandlePoint,
      state.cornerCurveSegments
    );

    if (!(hoveredSegment && state.matrix)) {
      if (state.hoveredCurvePath) {
        state.hoveredCurvePath.visible = false;
      }
      return;
    }

    const segments = getSourceSegmentsForCurveHighlight(hoveredSegment);

    if (!segments) {
      if (state.hoveredCurvePath) {
        state.hoveredCurvePath.visible = false;
      }
      return;
    }

    const path = ensureHoveredCurvePath();
    path.strokeWidth = getRenderedStrokeWidthPx(
      state.matrix,
      state.nodeStrokeWidth
    );
    path.removeSegments();
    path.add(
      new scope.Segment(
        projectPoint(state.matrix, segments.startSegment.point),
        projectVector(state.matrix, segments.startSegment.handleIn),
        projectVector(state.matrix, segments.startSegment.handleOut)
      )
    );
    path.add(
      new scope.Segment(
        projectPoint(state.matrix, segments.endSegment.point),
        projectVector(state.matrix, segments.endSegment.handleIn),
        projectVector(state.matrix, segments.endSegment.handleOut)
      )
    );
    path.visible = true;
  };

  const syncCurveHighlightsAndUpdate = () => {
    syncActiveCurveHighlights();
    syncMaxedCurveHighlights();
    syncHoveredCurveHighlight();
    scope.view.update();
  };

  const highlightHoveredAnchor = (
    chrome: VectorSegmentChrome,
    hoveredPoint: Exclude<HoveredPoint, null>
  ) => {
    const endpointDragTarget = state.endpointDragTarget;
    const isEndpointDragTarget =
      endpointDragTarget?.contourIndex === hoveredPoint.contourIndex &&
      endpointDragTarget?.segmentIndex === hoveredPoint.segmentIndex;

    if (isEndpointDragTarget) {
      applyVectorEndpointDragTargetChrome(chrome, state.styles);
      return;
    }

    chrome.anchorHalo.visible = true;
  };

  const syncHoveredChrome = () => {
    for (const contourChrome of state.chrome) {
      for (const chrome of contourChrome) {
        chrome.anchorHalo.visible = false;
        chrome.handleInHalo.visible = false;
        chrome.handleOutHalo.visible = false;
      }
    }

    const hoveredPoint = state.isPanning
      ? null
      : state.hoveredPoint || state.penHover;

    if (!hoveredPoint) {
      syncCurveHighlightsAndUpdate();
      return;
    }

    const chrome =
      state.chrome[hoveredPoint.contourIndex]?.[hoveredPoint.segmentIndex];

    if (!chrome) {
      syncCurveHighlightsAndUpdate();
      return;
    }

    if (hoveredPoint.role === "anchor") {
      highlightHoveredAnchor(
        chrome,
        hoveredPoint as Exclude<HoveredPoint, null>
      );
      syncCurveHighlightsAndUpdate();
      return;
    }

    if (hoveredPoint.role === "handle-in" && chrome.handleIn.visible) {
      chrome.handleInHalo.visible = true;
      syncCurveHighlightsAndUpdate();
      return;
    }

    if (hoveredPoint.role === "handle-out" && chrome.handleOut.visible) {
      chrome.handleOutHalo.visible = true;
    }

    syncCurveHighlightsAndUpdate();
  };

  const setHoveredPoint = (hoveredPoint: HoveredPoint) => {
    const current = state.hoveredPoint;
    const isSameHoveredPoint =
      current?.contourIndex === hoveredPoint?.contourIndex &&
      current?.segmentIndex === hoveredPoint?.segmentIndex &&
      current?.role === hoveredPoint?.role;

    if (isSameHoveredPoint) {
      return;
    }

    state.hoveredPoint = hoveredPoint;
    syncHoveredChrome();
  };

  const getLocalPoint = (point: paper.Point) => {
    return state.inverseMatrix ? state.inverseMatrix.transform(point) : null;
  };

  const applySourceSegmentToPaper = (
    contourIndex: number,
    segmentIndex: number,
    { updateView = false }: { updateView?: boolean } = {}
  ) => {
    const sourceSegment = state.contours[contourIndex]?.segments[segmentIndex];
    const path = state.paths[contourIndex];
    const segment = path?.segments[segmentIndex];
    const chrome = state.chrome[contourIndex]?.[segmentIndex];

    if (!(sourceSegment && segment && chrome && state.matrix)) {
      return;
    }

    segment.point = projectPoint(state.matrix, sourceSegment.point);
    segment.handleIn = projectVector(state.matrix, sourceSegment.handleIn);
    segment.handleOut = projectVector(state.matrix, sourceSegment.handleOut);

    const pointSelection = {
      contourIndex,
      segmentIndex,
    };

    refreshSegmentChrome(
      segment,
      chrome,
      state.styles,
      shouldShowSelectedAnchorForPoint(
        editor,
        nodeId,
        state.selectedPoints,
        state.selectedPoint,
        pointSelection
      ),
      shouldShowBezierHandlesForPoint(
        editor,
        nodeId,
        state.selectedPoint,
        pointSelection
      )
    );

    if (updateView) {
      syncHoveredChrome();
      scope.view.update();
    }
  };

  const refreshPathSegmentChrome = (
    contourIndex: number,
    segmentIndex: number,
    segment: paper.Segment
  ) => {
    const pointSelection = {
      contourIndex,
      segmentIndex,
    };
    const chrome = state.chrome[contourIndex]?.[segmentIndex];

    if (!chrome) {
      return;
    }

    refreshSegmentChrome(
      segment,
      chrome,
      state.styles,
      shouldShowSelectedAnchorForPoint(
        editor,
        nodeId,
        state.selectedPoints,
        state.selectedPoint,
        pointSelection
      ),
      shouldShowBezierHandlesForPoint(
        editor,
        nodeId,
        state.selectedPoint,
        pointSelection
      )
    );
  };

  const setSelectedPoints = (
    points: VectorPaperSessionState["selectedPoints"],
    primaryPoint: VectorPaperSessionState["selectedPoint"] = null
  ) => {
    const normalizedSelection = normalizePointSelections(points, primaryPoint);
    const previousPoints = state.selectedPoints;
    const previousPrimaryPoint = state.selectedPoint;
    const nextPoints = normalizedSelection.points;
    const nextPrimaryPoint = normalizedSelection.primaryPoint;
    const samePrimaryPoint = isSamePointSelection(
      previousPrimaryPoint,
      nextPrimaryPoint
    );
    const samePoints =
      previousPoints.length === nextPoints.length &&
      previousPoints.every((point, index) =>
        isSamePointSelection(point, nextPoints[index])
      );

    if (samePrimaryPoint && samePoints) {
      return;
    }

    state.selectedPoints = nextPoints;
    state.selectedPoint = nextPrimaryPoint;

    const pointsToRefresh = new Map<
      string,
      { contourIndex: number; segmentIndex: number }
    >();

    for (const point of [...previousPoints, ...nextPoints]) {
      pointsToRefresh.set(getPointSelectionKey(point), point);
    }

    for (const point of pointsToRefresh.values()) {
      applySourceSegmentToPaper(point.contourIndex, point.segmentIndex);
    }

    editor.setPathEditingPoints(nextPoints, nextPrimaryPoint);
    scope.view.update();
  };

  const setSelectedPoint = (
    point: VectorPaperSessionState["selectedPoint"]
  ) => {
    setSelectedPoints(point ? [point] : [], point);
  };

  const setEndpointDragTarget = (
    target: VectorPaperSessionState["endpointDragTarget"]
  ) => {
    const current = state.endpointDragTarget;
    const isSameTarget =
      current?.behavior === target?.behavior &&
      current?.contourIndex === target?.contourIndex &&
      current?.segmentIndex === target?.segmentIndex;

    if (isSameTarget) {
      return;
    }

    state.endpointDragTarget = target;
    setActiveCursorCompanionLabel(
      getVectorEndpointDragCursorCompanion(target)?.text || null
    );

    const pointsToRefresh = new Map<
      string,
      { contourIndex: number; segmentIndex: number }
    >();

    for (const point of [current, target]) {
      if (!point) {
        continue;
      }

      pointsToRefresh.set(getPointSelectionKey(point), point);
    }

    for (const point of pointsToRefresh.values()) {
      applySourceSegmentToPaper(point.contourIndex, point.segmentIndex);
    }

    setHoveredPoint(
      target
        ? {
            contourIndex: target.contourIndex,
            role: "anchor",
            segmentIndex: target.segmentIndex,
          }
        : null
    );
  };

  const ensurePreviewChrome = () => {
    if (!state.previewPath) {
      state.previewPath = new scope.Path({
        dashArray: PREVIEW_DASH_ARRAY,
        fillColor: null,
        insert: true,
        strokeCap: "round",
        strokeJoin: "round",
        strokeWidth: state.styles.indicatorWidthPx,
        visible: false,
      });
      state.previewPath.sendToBack();
    }

    if (!state.previewAnchor) {
      state.previewAnchor = createPreviewAnchorItem(
        scope,
        state.styles,
        getZeroPoint()
      );
    }

    if (!state.previewHandleIn) {
      state.previewHandleIn = createPreviewHandleItem(
        scope,
        state.styles,
        getZeroPoint()
      );
    }

    if (!state.previewHandleOut) {
      state.previewHandleOut = createPreviewHandleItem(
        scope,
        state.styles,
        getZeroPoint()
      );
    }

    if (!state.previewHandleInLine) {
      state.previewHandleInLine = createPreviewHandleLine(
        scope,
        state.styles,
        getZeroPoint()
      );
    }

    if (!state.previewHandleOutLine) {
      state.previewHandleOutLine = createPreviewHandleLine(
        scope,
        state.styles,
        getZeroPoint()
      );
    }
  };

  const stylePreviewChrome = () => {
    if (
      !(
        state.previewPath &&
        state.previewAnchor &&
        state.previewHandleIn &&
        state.previewHandleOut &&
        state.previewHandleInLine &&
        state.previewHandleOutLine
      )
    ) {
      return;
    }

    state.previewPath.strokeColor = state.styles.selected.clone();
    state.previewPath.strokeColor.alpha = 0.75;
    state.previewAnchor.fillColor = state.styles.surface.clone();
    state.previewAnchor.strokeColor = state.styles.selected.clone();
    state.previewAnchor.fillColor.alpha = 0.65;
    state.previewAnchor.strokeColor.alpha = 0.7;
    state.previewHandleIn.fillColor = state.styles.selected.clone();
    state.previewHandleIn.fillColor.alpha = 1;
    state.previewHandleOut.fillColor = state.styles.selected.clone();
    state.previewHandleOut.fillColor.alpha = 1;
    state.previewHandleInLine.strokeColor = state.styles.selected.clone();
    state.previewHandleInLine.strokeColor.alpha = 0.5;
    state.previewHandleOutLine.strokeColor = state.styles.selected.clone();
    state.previewHandleOutLine.strokeColor.alpha = 0.5;
  };

  const hidePreviewChrome = () => {
    if (state.previewPath) {
      state.previewPath.visible = false;
    }

    if (state.previewAnchor) {
      state.previewAnchor.visible = false;
    }

    if (state.previewHandleIn) {
      state.previewHandleIn.visible = false;
    }

    if (state.previewHandleOut) {
      state.previewHandleOut.visible = false;
    }

    if (state.previewHandleInLine) {
      state.previewHandleInLine.visible = false;
    }

    if (state.previewHandleOutLine) {
      state.previewHandleOutLine.visible = false;
    }
  };

  const syncPreviewPath = (preview: PenPreviewState | null) => {
    ensurePreviewChrome();
    stylePreviewChrome();

    if (
      !(
        preview &&
        state.matrix &&
        state.previewPath &&
        state.previewAnchor &&
        state.previewHandleIn &&
        state.previewHandleOut &&
        state.previewHandleInLine &&
        state.previewHandleOutLine
      )
    ) {
      hidePreviewChrome();
      return;
    }

    const contour = state.contours[preview.contourIndex];

    if (!(contour && contour.segments.length > 0 && !contour.closed)) {
      hidePreviewChrome();
      return;
    }

    const lastSegment = contour.segments.at(-1);

    if (!lastSegment) {
      hidePreviewChrome();
      return;
    }

    const endpoint = getPenPreviewEndpoint(contour, preview);

    if (!endpoint) {
      hidePreviewChrome();
      return;
    }

    const handleIn = getPenPreviewHandleIn(contour, preview) || {
      x: 0,
      y: 0,
    };
    const handleOut = getPenPreviewHandleOut(preview) || { x: 0, y: 0 };

    state.previewPath.removeSegments();
    state.previewPath.add(
      new scope.Segment(
        projectPoint(state.matrix, lastSegment.point),
        getZeroPoint(),
        projectVector(state.matrix, lastSegment.handleOut)
      )
    );
    state.previewPath.add(
      new scope.Segment(
        projectPoint(state.matrix, endpoint),
        projectVector(state.matrix, handleIn),
        getZeroPoint()
      )
    );
    state.previewPath.visible = true;

    const previewAnchorPoint = projectPoint(state.matrix, endpoint);
    const previewHandleInPoint = previewAnchorPoint.add(
      projectVector(state.matrix, handleIn)
    );
    const previewHandleOutPoint = previewAnchorPoint.add(
      projectVector(state.matrix, handleOut)
    );
    const shouldShowPreviewHandles = shouldShowPenPreviewHandles(preview);

    state.previewAnchor.position = previewAnchorPoint;
    state.previewAnchor.visible = shouldShowPenPreviewGhostAnchor(preview);
    state.previewHandleIn.position = previewHandleInPoint;
    state.previewHandleIn.visible = shouldShowPreviewHandles;
    state.previewHandleOut.position = previewHandleOutPoint;
    state.previewHandleOut.visible = shouldShowPreviewHandles;
    state.previewHandleInLine.segments[0].point = previewAnchorPoint;
    state.previewHandleInLine.segments[1].point = previewHandleInPoint;
    state.previewHandleInLine.visible = shouldShowPreviewHandles;
    state.previewHandleOutLine.segments[0].point = previewAnchorPoint;
    state.previewHandleOutLine.segments[1].point = previewHandleOutPoint;
    state.previewHandleOutLine.visible = shouldShowPreviewHandles;
  };

  const syncNode = (options: VectorPaperSessionSyncOptions = {}) => {
    onChange(state.contours, options);
  };

  return {
    applySourceSegmentToPaper,
    getLocalPoint,
    hideSelectionMarquee,
    refreshPathSegmentChrome,
    setActiveCursorCompanionLabel,
    setActiveCursorMode,
    setEndpointDragTarget,
    setHoverCursorMode,
    setHoveredPoint,
    setSelectedPoint,
    setSelectedPoints,
    syncHoveredChrome,
    syncNode,
    syncPreviewPath,
    syncSelectionMarquee,
  };
};
