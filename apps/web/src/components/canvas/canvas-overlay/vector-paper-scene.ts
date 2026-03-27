import paper from "paper";
import { updateVectorPointHandle } from "@punchpress/engine";

const ANCHOR_RADIUS_PX = 9;
const GUIDE_STROKE_WIDTH_PX = 1.5;
const HANDLE_LINE_STROKE_WIDTH_PX = 1.25;
const HANDLE_RADIUS_PX = 6;

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
    "var(--editor-accent)",
    "rgb(99 167 255)"
  );

  return {
    accentFill: new scope.Color(accent),
    anchorSelectedFill: new scope.Color("white"),
    borderFill: new scope.Color("white"),
    guide: new scope.Color(accent),
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

const createAnchorItem = (scope, styles, point) => {
  const anchor = new scope.Path.Circle({
    center: point,
    fillColor: styles.accentFill.clone(),
    radius: ANCHOR_RADIUS_PX,
    strokeColor: styles.borderFill.clone(),
    strokeWidth: 2,
  });

  anchor.shadowBlur = 4;
  anchor.shadowColor = styles.shadow;
  anchor.shadowOffset = new scope.Point(0, 1);

  return anchor;
};

const createHandleItem = (scope, styles, point) => {
  return new scope.Path.Circle({
    center: point,
    fillColor: styles.borderFill.clone(),
    radius: HANDLE_RADIUS_PX,
    strokeColor: styles.accentFill.clone(),
    strokeWidth: 2,
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
  chrome.anchor.fillColor = isSelected
    ? styles.anchorSelectedFill.clone()
    : styles.accentFill.clone();
  chrome.anchor.strokeColor = isSelected
    ? styles.accentFill.clone()
    : styles.borderFill.clone();
  chrome.anchor.strokeWidth = isSelected ? 3 : 2;

  const handleInPoint = segment.point.add(segment.handleIn);
  const handleOutPoint = segment.point.add(segment.handleOut);
  const hasHandleIn = segment.handleIn.length > 0.01;
  const hasHandleOut = segment.handleOut.length > 0.01;

  chrome.handleInLine.segments[0].point = segment.point;
  chrome.handleInLine.segments[1].point = handleInPoint;
  chrome.handleInLine.visible = hasHandleIn;
  chrome.handleIn.position = handleInPoint;
  chrome.handleIn.visible = hasHandleIn;

  chrome.handleOutLine.segments[0].point = segment.point;
  chrome.handleOutLine.segments[1].point = handleOutPoint;
  chrome.handleOutLine.visible = hasHandleOut;
  chrome.handleOut.position = handleOutPoint;
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
    historyMark: null,
    inverseMatrix: null,
    isGeometryDragging: false,
    matrix: null,
    nodeDragSession: null,
    paths: [],
    pendingPress: null,
    pendingScene: null,
    selectedPoint: null,
    styles: getSceneStyles(scope),
  };

  const clearScene = () => {
    scope.project.clear();
    state.chrome = [];
    state.paths = [];
    scope.view.update();
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

    refreshSegmentChrome(segment, chrome, state.styles, isSamePointSelection(state.selectedPoint, {
      contourIndex,
      segmentIndex,
    }));

    if (updateView) {
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
      applySourceSegmentToPaper(previousPoint.contourIndex, previousPoint.segmentIndex);
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

  const renderScene = (scene) => {
    const { contours, matrix, metrics, selectedPoint } = scene;
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
    state.selectedPoint = selectedPoint || null;
    state.styles = getSceneStyles(scope);

    contours.forEach((contour, contourIndex) => {
      const path = new scope.Path({
        closed: contour.closed,
        fillColor: null,
        insert: true,
        strokeCap: "round",
        strokeColor: state.styles.guide,
        strokeJoin: "round",
        strokeWidth: GUIDE_STROKE_WIDTH_PX,
      });

      path.data = {
        contourIndex,
        role: "path",
      };

      const contourChrome = [];

      contour.segments.forEach((segment, segmentIndex) => {
        const point = projectPoint(matrix, segment.point);
        const handleIn = projectVector(matrix, segment.handleIn);
        const handleOut = projectVector(matrix, segment.handleOut);

        path.add(new scope.Segment(point, handleIn, handleOut));

        const anchor = createAnchorItem(scope, state.styles, point);
        const handleInLine = createHandleLine(scope, state.styles, point, point);
        const handleOutLine = createHandleLine(scope, state.styles, point, point);
        const handleInItem = createHandleItem(scope, state.styles, point);
        const handleOutItem = createHandleItem(scope, state.styles, point);

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
          handleIn: handleInItem,
          handleInLine,
          handleOut: handleOutItem,
          handleOutLine,
        });
      });

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

    scope.view.update();
  };

  const syncNode = () => {
    onChange(state.contours);
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

    canvas.style.cursor = "grabbing";
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
  };

  const updateCursor = (point) => {
    if (state.nodeDragSession) {
      canvas.style.cursor = "grabbing";
      return;
    }

    const hit = scope.project.hitTest(point, {
      fill: true,
      stroke: true,
      tolerance: 10,
    });
    const role = hit?.item?.data?.role;
    const pathBodyHit = findPathBodyHit(state.paths, point);

    canvas.style.cursor =
      role === "anchor" || role === "handle-in" || role === "handle-out"
        ? "move"
        : pathBodyHit
          ? "grab"
        : "default";
  };

  const updateDraggedGeometry = (role, contourIndex, segmentIndex, point) => {
    if (!state.inverseMatrix) {
      return;
    }

    const localPoint = state.inverseMatrix.transform(point);
    const currentSegment = state.contours[contourIndex]?.segments[segmentIndex];

    if (!currentSegment) {
      return;
    }

    if (role === "anchor") {
      state.contours = mapTargetSegment(
        state.contours,
        { contourIndex, segmentIndex },
        (segment) => {
          return {
            ...segment,
            point: {
              x: localPoint.x,
              y: localPoint.y,
            },
          };
        }
      );
    } else {
      state.contours = updateVectorPointHandle(state.contours, {
        contourIndex,
        handleRole: role === "handle-in" ? "handleIn" : "handleOut",
        segmentIndex,
        value: {
          x: localPoint.x - currentSegment.point.x,
          y: localPoint.y - currentSegment.point.y,
        },
      });
    }

    applySourceSegmentToPaper(contourIndex, segmentIndex, { updateView: true });
    syncNode();
  };

  const tool = new scope.Tool();

  tool.onMouseDown = (event) => {
    const nativeEvent = event.event;
    const hit = scope.project.hitTest(event.point, {
      fill: true,
      stroke: true,
      tolerance: 10,
    });
    const role = hit?.item?.data?.role;

    if (role === "anchor" || role === "handle-in" || role === "handle-out") {
      state.pendingPress = { ...hit.item.data };
      setSelectedPoint({
        contourIndex: hit.item.data.contourIndex,
        segmentIndex: hit.item.data.segmentIndex,
      });
      canvas.style.cursor = "move";
      return;
    }

    if (findPathBodyHit(state.paths, event.point) && nativeEvent) {
      startNodeDrag(nativeEvent);
      return;
    }

    setSelectedPoint(null);

    if (!role) {
      onExitPathEditing();
    }
  };

  tool.onMouseDrag = (event) => {
    if (state.nodeDragSession && event.event) {
      updateNodeDrag(event.event);
      return;
    }

    if (state.pendingPress && !state.activeDrag) {
      state.activeDrag = state.pendingPress;
      state.pendingPress = null;
      state.historyMark = onHistoryStart();
      state.isGeometryDragging = true;
    }

    if (!state.activeDrag) {
      return;
    }

    const { contourIndex, role, segmentIndex } = state.activeDrag;
    updateDraggedGeometry(role, contourIndex, segmentIndex, event.point);
  };

  tool.onMouseMove = (event) => {
    updateCursor(event.point);
  };

  tool.onMouseUp = () => {
    if (state.nodeDragSession) {
      endNodeDrag();
      canvas.style.cursor = "grab";
      return;
    }

    state.pendingPress = null;

    if (!state.activeDrag) {
      return;
    }

    state.activeDrag = null;
    state.isGeometryDragging = false;
    canvas.style.cursor = "default";

    if (state.historyMark) {
      onHistoryCommit(state.historyMark);
      state.historyMark = null;
    }

    if (state.pendingScene) {
      const nextScene = state.pendingScene;
      state.pendingScene = null;
      renderScene(nextScene);
    }
  };

  return {
    destroy: () => {
      clearScene();
      canvas.style.cursor = "default";
    },
    render: (scene) => {
      if (!scene) {
        clearScene();
        return;
      }

      if (state.isGeometryDragging) {
        state.pendingScene = scene;
        return;
      }

      renderScene(scene);
    },
  };
};
