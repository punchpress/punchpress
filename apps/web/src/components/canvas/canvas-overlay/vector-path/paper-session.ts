import {
  getVectorPathCursorMode,
  isVectorPathPointRole,
  offsetEditablePathPoints,
  updateVectorPointHandle,
} from "@punchpress/engine";
import paper from "paper";
import {
  getActiveVectorPathCursorToken,
  getVectorPathCursorToken,
  setActiveCanvasCursorToken,
  setCanvasCursorToken,
} from "../../canvas-cursor-policy";
import {
  closeVectorContourByDraggingEndpoint,
  getVectorDraggedEndpointPreviewPoint,
  getVectorEndpointCloseTarget,
  shouldSnapVectorEndpointClose,
} from "./endpoint-close";
import { getVectorAnchorHoverHaloRadiusPx } from "./hover-halo";
import {
  createLocalContourPath,
  findVectorPathInsertTarget,
  splitVectorContourAtOffset,
} from "./paper-point-insert";
import {
  findPathBodyHit,
  getDragModifierState,
  getInteractiveHit,
} from "./paper-session-interaction";
import {
  createAnchorItem,
  createHandleItem,
  createHandleLine,
  createHoverHaloItem,
  createPreviewAnchorItem,
  createPreviewHandleItem,
  createPreviewHandleLine,
  GUIDE_STROKE_WIDTH_PX,
  getSceneStyles,
  getZeroPoint,
  HANDLE_HOVER_RADIUS_PX,
  PREVIEW_DASH_ARRAY,
  projectPoint,
  projectVector,
  refreshSegmentChrome,
  type VectorSegmentChrome,
} from "./paper-session-render";
import {
  getAnchorSelectionsInRectangle,
  getPointSelectionKey,
  isPointSelectionIncluded,
  isSamePointSelection,
  normalizePointSelections,
} from "./paper-session-selection";
import {
  getPenPreviewEndpoint,
  getPenPreviewHandleIn,
  getPenPreviewHandleOut,
  type PenPreviewState,
  shouldShowPenPreviewGhostAnchor,
  shouldShowPenPreviewHandles,
} from "./pen-preview";
import type { VectorCornerDragSession } from "./vector-corner-drag-session";
import {
  getHoveredVectorCornerCurveSegment,
  getMaxedVectorCornerCurveSegments,
} from "./vector-corner-radius-points";
import { shouldShowBezierHandlesForPoint } from "./vector-path-selection-chrome";

const ENDPOINT_CLOSE_SNAP_DISTANCE_PX = 14;
const HOVERED_CORNER_CURVE_FALLBACK_STROKE_WIDTH_PX = 12;
const SELECTION_MARQUEE_DASH_ARRAY = [6, 4];
const SELECTION_MARQUEE_THRESHOLD_PX = 4;
const PATH_POINT_DRAG_THRESHOLD_PX = 4;
const MAXED_CORNER_OUTER_STROKE_PX = 6;
const MAXED_CORNER_INNER_STROKE_SCALE = 0.78;
const roundDelta = (value) => Math.round(value * 100) / 100;

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

type HoveredPoint = {
  contourIndex: number;
  role: "anchor" | "handle-in" | "handle-out";
  segmentIndex: number;
} | null;

type PenHoverTarget = {
  contourIndex: number;
  intent: "add" | "close" | "continue" | "delete";
  point: { x: number; y: number };
  role: "anchor" | "segment";
  segmentIndex: number;
} | null;

type PendingPress =
  | {
      additive: boolean;
      origin: paper.Point;
      type: "empty";
    }
  | {
      origin: paper.Point;
      contourIndex: number;
      role: "anchor" | "handle-in" | "handle-out";
      segmentIndex: number;
      type: "point";
    }
  | {
      contourIndex: number;
      curveIndex: number;
      offset: number;
      type: "insert";
    }
  | {
      type: "body";
    };

type EndpointCloseTarget = {
  contourIndex: number;
  point: { x: number; y: number };
  role: "anchor";
  segmentIndex: number;
} | null;

const getCanvasPoint = (editor, clientX, clientY) => {
  const viewer = editor.viewerRef;
  const host = editor.hostRef;

  if (!(viewer && host)) {
    return { x: 0, y: 0 };
  }

  const rect = host.getBoundingClientRect();

  return {
    x: viewer.getScrollLeft() + (clientX - rect.left) / editor.zoom,
    y: viewer.getScrollTop() + (clientY - rect.top) / editor.zoom,
  };
};

const mapTargetSegment = (contours, target, mapper) => {
  return contours.map((contour, contourIndex) => {
    if (contourIndex !== target.contourIndex) {
      return contour;
    }

    return {
      ...contour,
      segments: contour.segments.map((segment, segmentIndex) => {
        if (segmentIndex !== target.segmentIndex) {
          return segment;
        }

        return mapper(segment);
      }),
    };
  });
};

export const createVectorPaperSession = ({
  canvas,
  editor,
  nodeId,
  onChange,
  onExitPathEditing,
  onHistoryCommit,
  onHistoryStart,
}) => {
  const scope = new paper.PaperScope();
  scope.setup(canvas);

  const state = {
    activeDrag: null,
    activeDragSession: null as VectorCornerDragSession | null,
    chrome: [],
    contours: [],
    dragCanvasPoint: null,
    endpointCloseTarget: null as EndpointCloseTarget,
    historyMark: null,
    inverseMatrix: null,
    isGeometryDragging: false,
    localPaths: [],
    matrix: null,
    nodeDragSession: null,
    previewAnchor: null as paper.Path.Circle | null,
    previewHandleIn: null as paper.Path.Circle | null,
    previewHandleInLine: null as paper.Path | null,
    previewHandleOut: null as paper.Path.Circle | null,
    previewHandleOutLine: null as paper.Path | null,
    paths: [],
    pendingPress: null,
    pendingScene: null,
    penHover: null as PenHoverTarget,
    hoveredPoint: null as HoveredPoint,
    hoveredCornerHandlePoint: null,
    hoveredCurvePath: null as paper.Path | null,
    maxedCurvePaths: [] as paper.Path[],
    nodeStrokeWidth: 0,
    previewPath: null as paper.Path | null,
    interactionPolicy: {
      canInsertPoint: true,
    },
    selectedPoints: [],
    selectedPoint: null,
    selectionMarquee: null as {
      additive: boolean;
      current: paper.Point;
      origin: paper.Point;
    } | null,
    selectionMarqueePath: null as paper.Path.Rectangle | null,
    styles: getSceneStyles(scope),
  };

  const clearScene = () => {
    scope.project.clear();
    state.chrome = [];
    state.localPaths = [];
    state.paths = [];
    state.previewAnchor = null;
    state.previewHandleIn = null;
    state.previewHandleInLine = null;
    state.previewHandleOut = null;
    state.previewHandleOutLine = null;
    state.hoveredCornerHandlePoint = null;
    state.hoveredCurvePath = null;
    state.maxedCurvePaths = [];
    state.previewPath = null;
    state.penHover = null;
    state.selectionMarquee = null;
    state.selectionMarqueePath = null;
    scope.view.update();
  };

  const setHoverCursorMode = (mode) => {
    setCanvasCursorToken(canvas, getVectorPathCursorToken(mode));
  };

  const ensureSelectionMarquee = () => {
    if (state.selectionMarqueePath) {
      return state.selectionMarqueePath;
    }

    const fillColor = state.styles.hoverHalo.clone();
    fillColor.alpha = 0.12;
    const strokeColor = state.styles.guide.clone();
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
      strokeColor: state.styles.accentFill.clone(),
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

  const syncMaxedCurveHighlights = () => {
    const maxedSegments = getMaxedVectorCornerCurveSegments(
      state.contours,
      state.selectedPoints,
      state.activeDragSession?.maxRadius ?? null,
      state.activeDragSession
    );

    clearMaxedCurveHighlights();

    if (!(state.activeDragSession && maxedSegments.length > 0 && state.matrix)) {
      return;
    }

    state.maxedCurvePaths = maxedSegments.flatMap((maxedSegment) => {
      const contour = state.contours[maxedSegment.contourIndex];
      const startSegment = contour?.segments?.[maxedSegment.startIndex];
      const endSegment = contour?.segments?.[maxedSegment.endIndex];

      if (!(startSegment && endSegment)) {
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
        strokeColor: state.styles.destructiveHalo.clone(),
        strokeJoin: "round",
        strokeWidth: renderedStrokeWidth + MAXED_CORNER_OUTER_STROKE_PX,
      });
      const innerPath = new scope.Path({
        fillColor: null,
        insert: true,
        strokeCap: "round",
        strokeColor: state.styles.destructiveHighlight.clone(),
        strokeJoin: "round",
        strokeWidth: Math.max(
          4,
          renderedStrokeWidth * MAXED_CORNER_INNER_STROKE_SCALE
        ),
      });

      outerPath.add(
        new scope.Segment(
          projectPoint(state.matrix, startSegment.point),
          projectVector(state.matrix, startSegment.handleIn),
          projectVector(state.matrix, startSegment.handleOut)
        )
      );
      outerPath.add(
        new scope.Segment(
          projectPoint(state.matrix, endSegment.point),
          projectVector(state.matrix, endSegment.handleIn),
          projectVector(state.matrix, endSegment.handleOut)
        )
      );
      innerPath.add(
        new scope.Segment(
          projectPoint(state.matrix, startSegment.point),
          projectVector(state.matrix, startSegment.handleIn),
          projectVector(state.matrix, startSegment.handleOut)
        )
      );
      innerPath.add(
        new scope.Segment(
          projectPoint(state.matrix, endSegment.point),
          projectVector(state.matrix, endSegment.handleIn),
          projectVector(state.matrix, endSegment.handleOut)
        )
      );

      return [outerPath, innerPath];
    });
  };

  const syncHoveredCurveHighlight = () => {
    const hoveredSegment = getHoveredVectorCornerCurveSegment(
      state.contours,
      state.hoveredCornerHandlePoint
    );

    if (!(hoveredSegment && state.matrix)) {
      if (state.hoveredCurvePath) {
        state.hoveredCurvePath.visible = false;
      }
      return;
    }

    const contour = state.contours[hoveredSegment.contourIndex];
    const startSegment = contour?.segments?.[hoveredSegment.startIndex];
    const endSegment = contour?.segments?.[hoveredSegment.endIndex];

    if (!(startSegment && endSegment)) {
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
        projectPoint(state.matrix, startSegment.point),
        projectVector(state.matrix, startSegment.handleIn),
        projectVector(state.matrix, startSegment.handleOut)
      )
    );
    path.add(
      new scope.Segment(
        projectPoint(state.matrix, endSegment.point),
        projectVector(state.matrix, endSegment.handleIn),
        projectVector(state.matrix, endSegment.handleOut)
      )
    );
    path.visible = true;
  };

  const syncCurveHighlightsAndUpdate = () => {
    syncMaxedCurveHighlights();
    syncHoveredCurveHighlight();
    scope.view.update();
  };

  const syncHoveredChrome = () => {
    for (const contourChrome of state.chrome) {
      for (const chrome of contourChrome) {
        chrome.anchorHalo.visible = false;
        chrome.handleInHalo.visible = false;
        chrome.handleOutHalo.visible = false;
      }
    }

    const hoveredPoint = state.hoveredPoint || state.penHover;

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
      chrome.anchorHalo.visible = true;
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

  const setActiveCursorMode = (mode) => {
    setActiveCanvasCursorToken(
      editor.hostRef,
      getActiveVectorPathCursorToken(mode)
    );
  };

  const getLocalPoint = (point) => {
    return state.inverseMatrix ? state.inverseMatrix.transform(point) : null;
  };

  const applySourceSegmentToPaper = (
    contourIndex,
    segmentIndex,
    { updateView = false } = {}
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
      isPointSelectionIncluded(state.selectedPoints, pointSelection),
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

  const refreshPathSegmentChrome = (contourIndex, segmentIndex, segment) => {
    const pointSelection = {
      contourIndex,
      segmentIndex,
    };

    refreshSegmentChrome(
      segment,
      state.chrome[contourIndex][segmentIndex],
      state.styles,
      isPointSelectionIncluded(state.selectedPoints, pointSelection),
      shouldShowBezierHandlesForPoint(
        editor,
        nodeId,
        state.selectedPoint,
        pointSelection
      )
    );
  };

  const setSelectedPoints = (points, primaryPoint = null) => {
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

    const pointsToRefresh = new Map();

    for (const point of [...previousPoints, ...nextPoints]) {
      pointsToRefresh.set(getPointSelectionKey(point), point);
    }

    for (const point of pointsToRefresh.values()) {
      applySourceSegmentToPaper(point.contourIndex, point.segmentIndex);
    }

    editor.setPathEditingPoints(nextPoints, nextPrimaryPoint);
    scope.view.update();
  };

  const setSelectedPoint = (point) => {
    setSelectedPoints(point ? [point] : [], point);
  };

  const setEndpointCloseTarget = (target: EndpointCloseTarget) => {
    const current = state.endpointCloseTarget;
    const isSameTarget =
      current?.contourIndex === target?.contourIndex &&
      current?.segmentIndex === target?.segmentIndex;

    if (isSameTarget) {
      return;
    }

    state.endpointCloseTarget = target;
    setHoveredPoint(target);
  };

  const ensurePreviewChrome = () => {
    if (!state.previewPath) {
      state.previewPath = new scope.Path({
        dashArray: PREVIEW_DASH_ARRAY,
        fillColor: null,
        insert: true,
        strokeCap: "round",
        strokeJoin: "round",
        strokeWidth: GUIDE_STROKE_WIDTH_PX,
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
    state.previewPath.strokeColor = state.styles.guide.clone();
    state.previewPath.strokeColor.alpha = 0.75;
    state.previewAnchor.fillColor = state.styles.backgroundFill.clone();
    state.previewAnchor.strokeColor = state.styles.accentFill.clone();
    state.previewAnchor.fillColor.alpha = 0.65;
    state.previewAnchor.strokeColor.alpha = 0.7;
    state.previewHandleIn.fillColor = state.styles.accentFill.clone();
    state.previewHandleIn.fillColor.alpha = 1;
    state.previewHandleOut.fillColor = state.styles.accentFill.clone();
    state.previewHandleOut.fillColor.alpha = 1;
    state.previewHandleInLine.strokeColor = state.styles.guide.clone();
    state.previewHandleInLine.strokeColor.alpha = 0.5;
    state.previewHandleOutLine.strokeColor = state.styles.guide.clone();
    state.previewHandleOutLine.strokeColor.alpha = 0.5;
  };

  const hidePreviewChrome = () => {
    state.previewPath.visible = false;
    state.previewAnchor.visible = false;
    state.previewHandleIn.visible = false;
    state.previewHandleOut.visible = false;
    state.previewHandleInLine.visible = false;
    state.previewHandleOutLine.visible = false;
  };

  const syncPreviewPath = (preview: PenPreviewState | null) => {
    ensurePreviewChrome();
    stylePreviewChrome();

    if (!(preview && state.matrix)) {
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

  const renderScene = (scene) => {
    const {
      activeDragSession,
      contours,
      hoveredCornerHandlePoint,
      interactionPolicy,
      matrix,
      metrics,
      nodeStrokeWidth,
      penHover,
      penPreview,
      selectedPoints,
      selectedPoint,
    } = scene;
    const canvasElement = scope.view.element;

    canvasElement.width = metrics.width;
    canvasElement.height = metrics.height;
    canvasElement.style.width = `${metrics.width}px`;
    canvasElement.style.height = `${metrics.height}px`;
    scope.view.viewSize = new scope.Size(metrics.width, metrics.height);
    clearScene();

    const paperMatrix = new scope.Matrix(
      matrix.a,
      matrix.b,
      matrix.c,
      matrix.d,
      matrix.e,
      matrix.f
    );
    const inverseMatrix = paperMatrix.inverted();

    if (!inverseMatrix) {
      return;
    }

    state.contours = contours;
    state.activeDragSession = activeDragSession || null;
    state.hoveredCornerHandlePoint = hoveredCornerHandlePoint || null;
    state.interactionPolicy = interactionPolicy || {
      canInsertPoint: true,
    };
    state.inverseMatrix = inverseMatrix;
    state.matrix = matrix;
    state.nodeStrokeWidth = nodeStrokeWidth || 0;
    state.penHover = penHover || null;
    state.selectedPoints = selectedPoints || [];
    state.selectedPoint = selectedPoint || null;
    state.styles = getSceneStyles(scope);

    contours.forEach((contour, contourIndex) => {
      const localPath = createLocalContourPath(scope, contour);
      const path = new scope.Path({
        closed: contour.closed,
        fillColor: null,
        insert: true,
        strokeCap: "round",
        strokeColor: state.styles.guide,
        strokeJoin: "round",
        strokeWidth: GUIDE_STROKE_WIDTH_PX,
      });

      localPath.data = {
        contourIndex,
        role: "path",
      };
      path.data = {
        contourIndex,
        role: "path",
      };

      const contourChrome: VectorSegmentChrome[] = [];

      contour.segments.forEach((segment, segmentIndex) => {
        const point = projectPoint(matrix, segment.point);
        const handleIn = projectVector(matrix, segment.handleIn);
        const handleOut = projectVector(matrix, segment.handleOut);

        path.add(new scope.Segment(point, handleIn, handleOut));

        const anchorHalo = createHoverHaloItem(
          scope,
          state.styles,
          point,
          getVectorAnchorHoverHaloRadiusPx()
        );
        const anchor = createAnchorItem(scope, state.styles, point);
        const handleInLine = createHandleLine(
          scope,
          state.styles,
          point,
          point
        );
        const handleOutLine = createHandleLine(
          scope,
          state.styles,
          point,
          point
        );
        const handleInHalo = createHoverHaloItem(
          scope,
          state.styles,
          point,
          HANDLE_HOVER_RADIUS_PX
        );
        const handleInItem = createHandleItem(scope, state.styles, point);
        const handleOutHalo = createHoverHaloItem(
          scope,
          state.styles,
          point,
          HANDLE_HOVER_RADIUS_PX
        );
        const handleOutItem = createHandleItem(scope, state.styles, point);

        anchorHalo.insertBelow(anchor);
        handleInHalo.insertBelow(handleInItem);
        handleOutHalo.insertBelow(handleOutItem);

        anchor.data = {
          contourIndex,
          role: "anchor",
          segmentIndex,
        };
        handleInItem.data = {
          contourIndex,
          role: "handle-in",
          segmentIndex,
        };
        handleOutItem.data = {
          contourIndex,
          role: "handle-out",
          segmentIndex,
        };

        contourChrome.push({
          anchor,
          anchorHalo,
          handleIn: handleInItem,
          handleInHalo,
          handleInLine,
          handleOut: handleOutItem,
          handleOutHalo,
          handleOutLine,
        });
      });

      state.localPaths.push(localPath);
      state.paths.push(path);
      state.chrome.push(contourChrome);
    });

    state.paths.forEach((path, contourIndex) => {
      path.segments.forEach((segment, segmentIndex) => {
        refreshPathSegmentChrome(contourIndex, segmentIndex, segment);
      });
    });

    syncPreviewPath(penPreview);
    syncHoveredChrome();
    scope.view.update();
  };

  const syncActiveSceneFrame = (scene) => {
    const {
      activeDragSession,
      interactionPolicy,
      matrix,
      metrics,
      nodeStrokeWidth,
      penHover,
      penPreview,
      hoveredCornerHandlePoint,
      selectedPoints,
      selectedPoint,
    } = scene;
    const canvasElement = scope.view.element;

    canvasElement.width = metrics.width;
    canvasElement.height = metrics.height;
    canvasElement.style.width = `${metrics.width}px`;
    canvasElement.style.height = `${metrics.height}px`;
    scope.view.viewSize = new scope.Size(metrics.width, metrics.height);

    const paperMatrix = new scope.Matrix(
      matrix.a,
      matrix.b,
      matrix.c,
      matrix.d,
      matrix.e,
      matrix.f
    );
    const inverseMatrix = paperMatrix.inverted();

    if (!inverseMatrix) {
      return;
    }

    state.inverseMatrix = inverseMatrix;
    state.interactionPolicy = interactionPolicy || {
      canInsertPoint: true,
    };
    state.activeDragSession = activeDragSession || null;
    state.matrix = matrix;
    state.nodeStrokeWidth = nodeStrokeWidth || 0;
    state.hoveredCornerHandlePoint = hoveredCornerHandlePoint || null;
    state.penHover = penHover || null;
    state.selectedPoints = selectedPoints || [];
    state.selectedPoint = selectedPoint || null;
    state.styles = getSceneStyles(scope);

    state.paths.forEach((path, contourIndex) => {
      path.segments.forEach((segment, segmentIndex) => {
        const sourceSegment =
          state.contours[contourIndex]?.segments[segmentIndex];

        if (!sourceSegment) {
          return;
        }

        segment.point = projectPoint(state.matrix, sourceSegment.point);
        segment.handleIn = projectVector(state.matrix, sourceSegment.handleIn);
        segment.handleOut = projectVector(
          state.matrix,
          sourceSegment.handleOut
        );

        refreshPathSegmentChrome(contourIndex, segmentIndex, segment);
      });
    });

    syncPreviewPath(penPreview);
    syncHoveredChrome();
    scope.view.update();
  };

  const syncNode = (
    options: {
      pinnedLocalPoint?: { x: number; y: number } | null;
      pinnedWorldPoint?: { x: number; y: number } | null;
    } = {}
  ) => {
    onChange(state.contours, options);
  };

  const startNodeDrag = (nativeEvent) => {
    state.nodeDragSession = editor.beginSelectionDrag({ nodeId });
    state.dragCanvasPoint = getCanvasPoint(
      editor,
      nativeEvent.clientX,
      nativeEvent.clientY
    );

    if (!state.nodeDragSession) {
      state.dragCanvasPoint = null;
      return false;
    }

    setHoverCursorMode(null);
    setActiveCursorMode("body");
    setSelectedPoints([], null);
    return true;
  };

  const updateNodeDrag = (nativeEvent) => {
    if (!(state.nodeDragSession && state.dragCanvasPoint)) {
      return;
    }

    const nextCanvasPoint = getCanvasPoint(
      editor,
      nativeEvent.clientX,
      nativeEvent.clientY
    );

    editor.updateSelectionDrag(state.nodeDragSession, {
      delta: {
        x: roundDelta(nextCanvasPoint.x - state.dragCanvasPoint.x),
        y: roundDelta(nextCanvasPoint.y - state.dragCanvasPoint.y),
      },
      queueRefresh: true,
    });

    state.dragCanvasPoint = nextCanvasPoint;
  };

  const endNodeDrag = () => {
    if (!state.nodeDragSession) {
      return;
    }

    editor.endSelectionDrag(state.nodeDragSession);
    state.nodeDragSession = null;
    state.dragCanvasPoint = null;
    setActiveCursorMode(null);
  };

  const getPathInteraction = (point) => {
    const localPoint = getLocalPoint(point);

    if (!localPoint) {
      return {
        bodyHit: null,
        insertTarget: null,
      };
    }

    return {
      bodyHit: findPathBodyHit(state.localPaths, localPoint),
      insertTarget: state.interactionPolicy.canInsertPoint
        ? findVectorPathInsertTarget(state.localPaths, localPoint)
        : null,
    };
  };

  const insertPointAtTarget = (target) => {
    const contour = state.contours[target.contourIndex];

    if (!contour) {
      return false;
    }

    const insertion = splitVectorContourAtOffset(scope, contour, target);

    if (!insertion) {
      return false;
    }

    return editor.insertPathPoint(insertion, nodeId);
  };

  const updateCursor = (point) => {
    if (state.nodeDragSession || state.activeDrag || state.selectionMarquee) {
      return;
    }

    const hit = getInteractiveHit(scope, point);
    const role = hit?.item?.data?.role;
    const { bodyHit, insertTarget } = getPathInteraction(point);

    if (isVectorPathPointRole(role)) {
      setHoveredPoint({
        contourIndex: hit.item.data.contourIndex,
        role,
        segmentIndex: hit.item.data.segmentIndex,
      });
    } else {
      setHoveredPoint(null);
    }

    setHoverCursorMode(
      getVectorPathCursorMode({
        isBodyHit: Boolean(bodyHit),
        isInsertHit: Boolean(insertTarget),
        role,
      })
    );
  };

  const updateDraggedGeometry = (
    role,
    contourIndex,
    segmentIndex,
    point,
    worldPoint,
    modifiers
  ) => {
    if (!state.inverseMatrix) {
      return;
    }

    const localPoint = state.inverseMatrix.transform(point);
    const currentSegment = state.contours[contourIndex]?.segments[segmentIndex];

    if (!currentSegment) {
      return;
    }

    const pinnedLocalPoint = localPoint;

    if (role === "anchor") {
      const selectedAnchorPoints =
        state.selectedPoints.length > 1 &&
        isPointSelectionIncluded(state.selectedPoints, {
          contourIndex,
          segmentIndex,
        })
          ? state.selectedPoints
          : [
              {
                contourIndex,
                segmentIndex,
              },
            ];

      if (selectedAnchorPoints.length > 1) {
        const delta = {
          x: localPoint.x - currentSegment.point.x,
          y: localPoint.y - currentSegment.point.y,
        };

        setEndpointCloseTarget(null);
        state.contours = offsetEditablePathPoints(
          state.contours,
          selectedAnchorPoints,
          delta
        );

        for (const selectedPoint of selectedAnchorPoints) {
          applySourceSegmentToPaper(
            selectedPoint.contourIndex,
            selectedPoint.segmentIndex
          );
        }

        syncHoveredChrome();
        syncNode({
          pinnedLocalPoint: {
            x: localPoint.x,
            y: localPoint.y,
          },
          pinnedWorldPoint: worldPoint,
        });
        return;
      }

      const endpointCloseTarget = getVectorEndpointCloseTarget(state.contours, {
        contourIndex,
        segmentIndex,
      });

      if (endpointCloseTarget && state.matrix) {
        const projectedTargetPoint = projectPoint(
          state.matrix,
          endpointCloseTarget.point
        );

        if (
          shouldSnapVectorEndpointClose(
            {
              x: projectedTargetPoint.x,
              y: projectedTargetPoint.y,
            },
            {
              x: point.x,
              y: point.y,
            },
            ENDPOINT_CLOSE_SNAP_DISTANCE_PX
          )
        ) {
          setEndpointCloseTarget({
            ...endpointCloseTarget,
            role: "anchor",
          });
        } else {
          setEndpointCloseTarget(null);
        }
      } else {
        setEndpointCloseTarget(null);
      }

      const previewPoint = getVectorDraggedEndpointPreviewPoint(
        state.contours,
        {
          contourIndex,
          segmentIndex,
        },
        {
          x: localPoint.x,
          y: localPoint.y,
        },
        state.endpointCloseTarget
      );

      state.contours = mapTargetSegment(
        state.contours,
        { contourIndex, segmentIndex },
        (segment) => {
          return {
            ...segment,
            point: {
              x: previewPoint.x,
              y: previewPoint.y,
            },
          };
        }
      );
    } else {
      setEndpointCloseTarget(null);
      state.contours = updateVectorPointHandle(state.contours, {
        constrainAngle: modifiers.constrainAngle,
        contourIndex,
        handleRole: role === "handle-in" ? "handleIn" : "handleOut",
        preserveSmoothCoupling: modifiers.preserveSmoothCoupling,
        segmentIndex,
        value: {
          x: localPoint.x - currentSegment.point.x,
          y: localPoint.y - currentSegment.point.y,
        },
      });
    }

    applySourceSegmentToPaper(contourIndex, segmentIndex, { updateView: true });
    syncNode({
      pinnedLocalPoint:
        role === "anchor"
          ? {
              x: localPoint.x,
              y: localPoint.y,
            }
          : pinnedLocalPoint,
      pinnedWorldPoint: worldPoint,
    });
  };

  const tool = new scope.Tool();

  tool.onMouseDown = (event) => {
    const hit = getInteractiveHit(scope, event.point);
    const role = hit?.item?.data?.role;
    const { bodyHit, insertTarget } = getPathInteraction(event.point);
    const isAdditiveSelection = Boolean(event.event?.shiftKey);

    if (role === "anchor" || role === "handle-in" || role === "handle-out") {
      const pointSelection = {
        contourIndex: hit.item.data.contourIndex,
        segmentIndex: hit.item.data.segmentIndex,
      };

      if (role === "anchor" && isAdditiveSelection) {
        const nextSelectedPoints = isPointSelectionIncluded(
          state.selectedPoints,
          pointSelection
        )
          ? state.selectedPoints.filter((currentPoint) => {
              return !isSamePointSelection(currentPoint, pointSelection);
            })
          : [...state.selectedPoints, pointSelection];
        const nextPrimaryPoint =
          nextSelectedPoints.length === 1 ? nextSelectedPoints[0] : null;

        setSelectedPoints(nextSelectedPoints, nextPrimaryPoint);
        setHoveredPoint({
          contourIndex: hit.item.data.contourIndex,
          role,
          segmentIndex: hit.item.data.segmentIndex,
        });
        setHoverCursorMode("point");
        return;
      }

      state.pendingPress = {
        ...hit.item.data,
        origin: event.point.clone(),
        type: "point",
      } satisfies PendingPress;
      setSelectedPoints(
        isPointSelectionIncluded(state.selectedPoints, pointSelection)
          ? state.selectedPoints
          : [pointSelection],
        pointSelection
      );
      setHoveredPoint({
        contourIndex: hit.item.data.contourIndex,
        role,
        segmentIndex: hit.item.data.segmentIndex,
      });
      setHoverCursorMode("point");
      return;
    }

    if (insertTarget) {
      state.pendingPress = {
        ...insertTarget,
        type: "insert",
      } satisfies PendingPress;
      setHoverCursorMode("insert");
      return;
    }

    if (bodyHit) {
      state.pendingPress = {
        type: "body",
      } satisfies PendingPress;
      setSelectedPoint(null);
      setHoverCursorMode("body");
      return;
    }

    state.pendingPress = null;
    setHoveredPoint(null);
    state.pendingPress = {
      additive: isAdditiveSelection,
      origin: event.point.clone(),
      type: "empty",
    } satisfies PendingPress;
  };

  tool.onMouseDrag = (event) => {
    if (state.nodeDragSession && event.event) {
      updateNodeDrag(event.event);
      return;
    }

    if (state.pendingPress?.type === "empty") {
      if (
        !state.selectionMarquee &&
        event.point.getDistance(state.pendingPress.origin) >=
          SELECTION_MARQUEE_THRESHOLD_PX
      ) {
        state.selectionMarquee = {
          additive: state.pendingPress.additive,
          current: event.point.clone(),
          origin: state.pendingPress.origin.clone(),
        };
        syncSelectionMarquee();
        setHoveredPoint(null);
        setHoverCursorMode(null);
      }

      if (state.selectionMarquee) {
        state.selectionMarquee.current = event.point.clone();
        syncSelectionMarquee();
        scope.view.update();
      }

      return;
    }

    if (
      state.pendingPress?.type === "body" ||
      state.pendingPress?.type === "insert"
    ) {
      state.pendingPress = null;

      if (event.event) {
        startNodeDrag(event.event);
      }
    }

    if (
      state.pendingPress?.type === "point" &&
      !state.activeDrag &&
      event.point.getDistance(state.pendingPress.origin) >=
        PATH_POINT_DRAG_THRESHOLD_PX
    ) {
      state.activeDrag = state.pendingPress;
      state.pendingPress = null;
      state.historyMark = onHistoryStart();
      state.isGeometryDragging = true;
      setEndpointCloseTarget(null);
      setHoveredPoint(null);
      setHoverCursorMode(null);
      setActiveCursorMode("point");
    }

    if (!state.activeDrag) {
      return;
    }

    const { contourIndex, role, segmentIndex } = state.activeDrag;
    updateDraggedGeometry(
      role,
      contourIndex,
      segmentIndex,
      event.point,
      event.event
        ? getCanvasPoint(editor, event.event.clientX, event.event.clientY)
        : null,
      getDragModifierState(event.event, role)
    );
  };

  tool.onMouseMove = (event) => {
    if (state.selectionMarquee) {
      return;
    }

    updateCursor(event.point);
  };

  tool.onMouseUp = (event) => {
    const pendingPress = state.pendingPress;

    if (state.nodeDragSession) {
      endNodeDrag();
      updateCursor(event.point);
      return;
    }

    state.pendingPress = null;

    if (state.selectionMarquee) {
      const selectedPointsInBox = getAnchorSelectionsInRectangle(
        state.contours,
        state.matrix,
        state.selectionMarquee.origin,
        state.selectionMarquee.current
      );
      const nextSelectedPoints = state.selectionMarquee.additive
        ? [...state.selectedPoints, ...selectedPointsInBox]
        : selectedPointsInBox;
      const nextPrimaryPoint =
        nextSelectedPoints.length === 1 ? nextSelectedPoints[0] : null;

      setSelectedPoints(nextSelectedPoints, nextPrimaryPoint);
      hideSelectionMarquee();
      updateCursor(event.point);
      return;
    }

    if (!state.activeDrag) {
      if (pendingPress?.type === "insert") {
        insertPointAtTarget(pendingPress);
      } else if (pendingPress?.type === "empty" && !pendingPress.additive) {
        onExitPathEditing();
      }

      updateCursor(event.point);
      return;
    }

    if (
      state.activeDrag.type === "point" &&
      state.activeDrag.role === "anchor" &&
      state.endpointCloseTarget &&
      state.endpointCloseTarget.contourIndex === state.activeDrag.contourIndex
    ) {
      const closeResult = closeVectorContourByDraggingEndpoint(state.contours, {
        contourIndex: state.activeDrag.contourIndex,
        draggedSegmentIndex: state.activeDrag.segmentIndex,
        targetSegmentIndex: state.endpointCloseTarget.segmentIndex,
      });

      state.contours = closeResult.contours;
      setSelectedPoint(closeResult.selectedPoint);
      syncNode();
    }

    state.activeDrag = null;
    state.isGeometryDragging = false;
    setEndpointCloseTarget(null);
    setActiveCursorMode(null);

    if (state.historyMark) {
      onHistoryCommit(state.historyMark);
      state.historyMark = null;
    }

    if (state.pendingScene) {
      const nextScene = state.pendingScene;
      state.pendingScene = null;
      renderScene(nextScene);
    }

    updateCursor(event.point);
  };

  return {
    destroy: () => {
      clearScene();
      setHoveredPoint(null);
      setHoverCursorMode(null);
      setActiveCursorMode(null);
      tool.onMouseDown = null;
      tool.onMouseDrag = null;
      tool.onMouseMove = null;
      tool.onMouseUp = null;
      tool.remove?.();
    },
    render: (scene) => {
      if (!scene) {
        clearScene();
        setHoveredPoint(null);
        setHoverCursorMode(null);
        return;
      }

      if (state.isGeometryDragging) {
        state.pendingScene = scene;
        syncActiveSceneFrame(scene);
        return;
      }

      renderScene(scene);
    },
  };
};
