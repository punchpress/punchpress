import paper from "paper";

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
    accent,
    border: "rgb(255 255 255)",
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
    fillColor: styles.accent,
    radius: ANCHOR_RADIUS_PX,
    strokeColor: styles.border,
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
    fillColor: styles.border,
    radius: HANDLE_RADIUS_PX,
    strokeColor: styles.accent,
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

const refreshSegmentChrome = (segment, chrome) => {
  chrome.anchor.position = segment.point;

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

const serializeContours = (paths, inverseMatrix) => {
  return paths.map((path) => {
    return {
      closed: path.closed,
      segments: path.segments.map((segment) => {
        const point = inverseMatrix.transform(segment.point);
        const handleInPoint = inverseMatrix.transform(
          segment.point.add(segment.handleIn)
        );
        const handleOutPoint = inverseMatrix.transform(
          segment.point.add(segment.handleOut)
        );

        return {
          handleIn: {
            x: handleInPoint.x - point.x,
            y: handleInPoint.y - point.y,
          },
          handleOut: {
            x: handleOutPoint.x - point.x,
            y: handleOutPoint.y - point.y,
          },
          point: {
            x: point.x,
            y: point.y,
          },
        };
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
    dragCanvasPoint: null,
    historyMark: null,
    inverseMatrix: null,
    isGeometryDragging: false,
    nodeDragSession: null,
    paths: [],
    pendingScene: null,
    styles: getSceneStyles(scope),
  };

  const clearScene = () => {
    scope.project.clear();
    state.chrome = [];
    state.paths = [];
    scope.view.update();
  };

  const renderScene = (scene) => {
    const { contours, matrix, metrics } = scene;
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

    state.inverseMatrix = inverseMatrix;
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
        refreshSegmentChrome(segment, state.chrome[contourIndex][segmentIndex]);
      });
    });

    scope.view.update();
  };

  const syncNode = () => {
    if (!state.inverseMatrix) {
      return;
    }

    onChange(serializeContours(state.paths, state.inverseMatrix));
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
      state.activeDrag = { ...hit.item.data };
      state.historyMark = onHistoryStart();
      state.isGeometryDragging = true;
      canvas.style.cursor = "move";
      return;
    }

    if (findPathBodyHit(state.paths, event.point) && nativeEvent) {
      startNodeDrag(nativeEvent);
      return;
    }

    if (!(role === "anchor" || role === "handle-in" || role === "handle-out")) {
      if (!role) {
        onExitPathEditing();
      }

      return;
    }
  };

  tool.onMouseDrag = (event) => {
    if (state.nodeDragSession && event.event) {
      updateNodeDrag(event.event);
      return;
    }

    if (!state.activeDrag) {
      return;
    }

    const { contourIndex, role, segmentIndex } = state.activeDrag;
    const path = state.paths[contourIndex];
    const segment = path?.segments[segmentIndex];
    const chrome = state.chrome[contourIndex]?.[segmentIndex];

    if (!(segment && chrome)) {
      return;
    }

    if (role === "anchor") {
      segment.point = event.point;
    } else if (role === "handle-in") {
      segment.handleIn = event.point.subtract(segment.point);
    } else if (role === "handle-out") {
      segment.handleOut = event.point.subtract(segment.point);
    }

    refreshSegmentChrome(segment, chrome);
    scope.view.update();
    syncNode();
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
