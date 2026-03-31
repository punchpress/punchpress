import {
  getVectorPathCursorMode,
  isVectorPathPointRole,
  updateVectorPointHandle,
} from "@punchpress/engine";
import paper from "paper";
import {
  getActiveVectorPathCursorToken,
  getVectorPathCursorToken,
  setActiveCanvasCursorToken,
  setCanvasCursorToken,
} from "../canvas-cursor-policy";
import {
  closeVectorContourByDraggingEndpoint,
  getVectorDraggedEndpointPreviewPoint,
  getVectorEndpointCloseTarget,
  shouldSnapVectorEndpointClose,
} from "./vector-endpoint-close";
import { getVectorBezierHandleAppearance } from "./vector-handle-appearance";
import {
  getVectorAnchorHoverHaloRadiusPx,
  getVectorHoverHaloFillAlpha,
  getVectorHoverHaloStrokeWidthPx,
} from "./vector-hover-halo";
import {
  createLocalContourPath,
  findVectorPathInsertTarget,
  splitVectorContourAtOffset,
} from "./vector-paper-point-insert";
import {
  getPenPreviewEndpoint,
  getPenPreviewHandleAppearance,
  getPenPreviewHandleIn,
  getPenPreviewHandleOut,
  type PenPreviewState,
  shouldShowPenPreviewGhostAnchor,
  shouldShowPenPreviewHandles,
} from "./vector-pen-preview";

const ANCHOR_RADIUS_PX = 6;
const ENDPOINT_CLOSE_SNAP_DISTANCE_PX = 14;
const GUIDE_STROKE_WIDTH_PX = 1.5;
const HANDLE_LINE_STROKE_WIDTH_PX = 1.25;
const HANDLE_RADIUS_PX = 6;
const PREVIEW_DASH_ARRAY = [8, 6];
const SELECTED_ANCHOR_SCALE = 1.2;
const HIT_TEST_OPTIONS = {
  fill: true,
  stroke: true,
  tolerance: 10,
};

interface VectorSegmentChrome {
  anchor: paper.Path.Circle;
  anchorHalo: paper.Path.Circle;
  handleIn: paper.Path.Circle;
  handleInHalo: paper.Path.Circle;
  handleInLine: paper.Path;
  handleOut: paper.Path.Circle;
  handleOutHalo: paper.Path.Circle;
  handleOutLine: paper.Path;
}

type HoveredPoint = {
  contourIndex: number;
  role: "anchor" | "handle-in" | "handle-out";
  segmentIndex: number;
} | null;

type PenHoverTarget = {
  contourIndex: number;
  intent: "add" | "close" | "continue" | "delete";
  role: "anchor" | "segment";
  segmentIndex: number;
} | null;

type PendingPress =
  | {
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

const roundDelta = (value) => Math.round(value * 100) / 100;

const resolveCssColor = (canvas, value, fallback) => {
  const probe = document.createElement("div");
  probe.style.color = value;
  canvas.parentElement?.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || fallback;
};

const getSceneStyles = (scope) => {
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

  return {
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

const projectPoint = (matrix, point) => {
  return new paper.Point(
    matrix.a * point.x + matrix.c * point.y + matrix.e,
    matrix.b * point.x + matrix.d * point.y + matrix.f
  );
};

const projectVector = (matrix, point) => {
  return new paper.Point(
    matrix.a * point.x + matrix.c * point.y,
    matrix.b * point.x + matrix.d * point.y
  );
};

const getZeroPoint = () => new paper.Point(0, 0);

const createAnchorItem = (scope, styles, point) => {
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

const createHandleItem = (scope, styles, point) => {
  const bezierHandleAppearance = getVectorBezierHandleAppearance();
  return new scope.Path.Circle({
    center: point,
    fillColor: styles.accentFill.clone(),
    radius: bezierHandleAppearance.radiusPx,
    strokeColor: null,
    strokeWidth: 0,
  });
};

const createPreviewAnchorItem = (scope, styles, point) => {
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

const createPreviewHandleItem = (scope, styles, point) => {
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

const createPreviewHandleLine = (scope, styles, point) => {
  const line = createHandleLine(scope, styles, point, point);
  line.visible = false;
  line.strokeColor.alpha = 0.5;
  return line;
};

const createHoverHaloItem = (scope, styles, point, radius) => {
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

const createHandleLine = (scope, styles, from, to) => {
  const line = new scope.Path({
    segments: [from, to],
    strokeCap: "round",
    strokeColor: styles.guide.clone(),
    strokeWidth: HANDLE_LINE_STROKE_WIDTH_PX,
  });

  line.strokeColor.alpha = 0.6;

  return line;
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

const applyHandleItemAppearance = (handle, styles) => {
  handle.fillColor = styles.accentFill.clone();
  handle.fillColor.alpha = 1;
  handle.strokeColor = null;
  handle.strokeWidth = 0;
};

const isSamePointSelection = (a, b) => {
  return Boolean(
    a &&
      b &&
      a.contourIndex === b.contourIndex &&
      a.segmentIndex === b.segmentIndex
  );
};

const refreshSegmentChrome = (segment, chrome, styles, isSelected) => {
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
  const hasHandleIn = isSelected && segment.handleIn.length > 0.01;
  const hasHandleOut = isSelected && segment.handleOut.length > 0.01;

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

const findPathBodyHit = (paths, point) => {
  const directPathHit = paths.find((path) => path.hitTest(point));

  if (directPathHit) {
    return directPathHit;
  }

  return paths.find((path) => path.closed && path.contains(point)) || null;
};

const getInteractiveHit = (scope, point) => {
  const hits = scope.project.hitTestAll(point, HIT_TEST_OPTIONS);

  return (
    hits.find((hit) => isVectorPathPointRole(hit?.item?.data?.role)) ||
    hits.find((hit) => hit?.item?.data?.role === "path") ||
    null
  );
};

const getDragModifierState = (nativeEvent, role) => {
  const isHandle = role === "handle-in" || role === "handle-out";

  return {
    constrainAngle: Boolean(isHandle && nativeEvent?.shiftKey),
    preserveSmoothCoupling: !(isHandle && nativeEvent?.altKey),
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
    previewPath: null as paper.Path | null,
    selectedPoint: null,
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
    state.previewPath = null;
    state.penHover = null;
    scope.view.update();
  };

  const setHoverCursorMode = (mode) => {
    setCanvasCursorToken(canvas, getVectorPathCursorToken(mode));
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
      scope.view.update();
      return;
    }

    const chrome =
      state.chrome[hoveredPoint.contourIndex]?.[hoveredPoint.segmentIndex];

    if (!chrome) {
      scope.view.update();
      return;
    }

    if (hoveredPoint.role === "anchor") {
      chrome.anchorHalo.visible = true;
      scope.view.update();
      return;
    }

    if (hoveredPoint.role === "handle-in" && chrome.handleIn.visible) {
      chrome.handleInHalo.visible = true;
      scope.view.update();
      return;
    }

    if (hoveredPoint.role === "handle-out" && chrome.handleOut.visible) {
      chrome.handleOutHalo.visible = true;
    }

    scope.view.update();
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

    refreshSegmentChrome(
      segment,
      chrome,
      state.styles,
      isSamePointSelection(state.selectedPoint, {
        contourIndex,
        segmentIndex,
      })
    );

    if (updateView) {
      syncHoveredChrome();
      scope.view.update();
    }
  };

  const setSelectedPoint = (point) => {
    const previousPoint = state.selectedPoint;

    if (isSamePointSelection(previousPoint, point)) {
      return;
    }

    state.selectedPoint = point
      ? {
          contourIndex: point.contourIndex,
          segmentIndex: point.segmentIndex,
        }
      : null;

    if (previousPoint) {
      applySourceSegmentToPaper(
        previousPoint.contourIndex,
        previousPoint.segmentIndex
      );
    }

    if (state.selectedPoint) {
      applySourceSegmentToPaper(
        state.selectedPoint.contourIndex,
        state.selectedPoint.segmentIndex
      );
    }

    editor.setPathEditingPoint(state.selectedPoint);
    scope.view.update();
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
    const { contours, matrix, metrics, penHover, penPreview, selectedPoint } =
      scene;
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
    state.inverseMatrix = inverseMatrix;
    state.matrix = matrix;
    state.penHover = penHover || null;
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
          HANDLE_RADIUS_PX + 3
        );
        const handleInItem = createHandleItem(scope, state.styles, point);
        const handleOutHalo = createHoverHaloItem(
          scope,
          state.styles,
          point,
          HANDLE_RADIUS_PX + 3
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
        refreshSegmentChrome(
          segment,
          state.chrome[contourIndex][segmentIndex],
          state.styles,
          isSamePointSelection(state.selectedPoint, {
            contourIndex,
            segmentIndex,
          })
        );
      });
    });

    syncPreviewPath(penPreview);
    syncHoveredChrome();
    scope.view.update();
  };

  const syncActiveSceneFrame = (scene) => {
    const { matrix, metrics, penHover, penPreview, selectedPoint } = scene;
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
    state.matrix = matrix;
    state.penHover = penHover || null;
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

        refreshSegmentChrome(
          segment,
          state.chrome[contourIndex][segmentIndex],
          state.styles,
          isSamePointSelection(state.selectedPoint, {
            contourIndex,
            segmentIndex,
          })
        );
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
    setSelectedPoint(null);
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
      insertTarget: findVectorPathInsertTarget(state.localPaths, localPoint),
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

    return editor.insertVectorPoint(insertion, nodeId);
  };

  const updateCursor = (point) => {
    if (state.nodeDragSession || state.activeDrag) {
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

    if (role === "anchor" || role === "handle-in" || role === "handle-out") {
      const pointSelection = {
        contourIndex: hit.item.data.contourIndex,
        segmentIndex: hit.item.data.segmentIndex,
      };

      state.pendingPress = {
        ...hit.item.data,
        type: "point",
      } satisfies PendingPress;
      setSelectedPoint(pointSelection);
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
    setSelectedPoint(null);
    setHoveredPoint(null);

    if (!role) {
      onExitPathEditing();
    }
  };

  tool.onMouseDrag = (event) => {
    if (state.nodeDragSession && event.event) {
      updateNodeDrag(event.event);
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

    if (state.pendingPress?.type === "point" && !state.activeDrag) {
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

    if (!state.activeDrag) {
      if (pendingPress?.type === "insert") {
        insertPointAtTarget(pendingPress);
      }

      updateCursor(event.point);
      return;
    }

    if (
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
