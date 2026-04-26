import type paper from "paper";
import { getVectorAnchorHoverHaloRadiusPx } from "./hover-halo";
import { createLocalContourPath } from "./paper-point-insert";
import type { PaperSessionChromeController } from "./paper-session-chrome";
import {
  createAnchorItem,
  createHandleItem,
  createHandleLine,
  createHoverHaloItem,
  getSceneStyles,
  HANDLE_HOVER_RADIUS_PX,
  projectPoint,
  projectVector,
  type VectorSegmentChrome,
} from "./paper-session-render";
import type {
  VectorPaperSessionScene,
  VectorPaperSessionState,
} from "./paper-session-state";

interface CreatePaperSessionSceneControllerOptions {
  chrome: PaperSessionChromeController;
  scope: paper.PaperScope;
  state: VectorPaperSessionState;
}

export interface PaperSessionSceneController {
  clearScene: () => void;
  flushPendingScene: () => void;
  render: (scene: VectorPaperSessionScene | null) => void;
}

export const createPaperSessionSceneController = ({
  chrome,
  scope,
  state,
}: CreatePaperSessionSceneControllerOptions): PaperSessionSceneController => {
  const syncCanvasMetrics = (scene: VectorPaperSessionScene) => {
    const canvasElement = scope.view.element;

    canvasElement.width = scene.metrics.width;
    canvasElement.height = scene.metrics.height;
    canvasElement.style.width = `${scene.metrics.width}px`;
    canvasElement.style.height = `${scene.metrics.height}px`;
    scope.view.viewSize = new scope.Size(
      scene.metrics.width,
      scene.metrics.height
    );
  };

  const applySceneFrame = (scene: VectorPaperSessionScene) => {
    const paperMatrix = new scope.Matrix(
      scene.matrix.a,
      scene.matrix.b,
      scene.matrix.c,
      scene.matrix.d,
      scene.matrix.e,
      scene.matrix.f
    );
    const inverseMatrix = paperMatrix.inverted();

    if (!inverseMatrix) {
      return false;
    }

    state.contours = scene.contours;
    state.activeDragSession = scene.activeDragSession || null;
    state.cornerCurveSegments = scene.cornerCurveSegments || [];
    state.hoveredCornerHandlePoint = scene.hoveredCornerHandlePoint || null;
    state.interactionPolicy = scene.interactionPolicy || {
      canInsertPoint: true,
    };
    state.inverseMatrix = inverseMatrix;
    state.isPanning = Boolean(scene.isPanning);
    state.matrix = scene.matrix;
    state.nodeStrokeWidth = scene.nodeStrokeWidth || 0;
    state.penHover = scene.penHover || null;
    state.selectedPoints = scene.selectedPoints || [];
    state.selectedPoint = scene.selectedPoint || null;
    state.styles = getSceneStyles(scope);
    return true;
  };

  const clearScene = () => {
    scope.project.clear();
    state.activeCurvePaths = [];
    state.chrome = [];
    state.cornerCurveSegments = [];
    state.localPaths = [];
    state.maxedCurvePaths = [];
    state.paths = [];
    state.pendingScene = null;
    state.penHover = null;
    state.previewAnchor = null;
    state.previewHandleIn = null;
    state.previewHandleInLine = null;
    state.previewHandleOut = null;
    state.previewHandleOutLine = null;
    state.previewPath = null;
    state.selectionMarquee = null;
    state.selectionMarqueePath = null;
    state.hoveredCornerHandlePoint = null;
    state.hoveredCurvePath = null;
    scope.view.update();
  };

  const createContourChrome = (
    contourIndex: number,
    point: paper.Point,
    segmentIndex: number
  ) => {
    const anchorHalo = createHoverHaloItem(
      scope,
      state.styles,
      point,
      getVectorAnchorHoverHaloRadiusPx()
    );
    const anchor = createAnchorItem(scope, state.styles, point);
    const handleInLine = createHandleLine(scope, state.styles, point, point);
    const handleOutLine = createHandleLine(scope, state.styles, point, point);
    const handleInHalo = createHoverHaloItem(
      scope,
      state.styles,
      point,
      HANDLE_HOVER_RADIUS_PX
    );
    const handleIn = createHandleItem(scope, state.styles, point);
    const handleOutHalo = createHoverHaloItem(
      scope,
      state.styles,
      point,
      HANDLE_HOVER_RADIUS_PX
    );
    const handleOut = createHandleItem(scope, state.styles, point);

    anchorHalo.insertBelow(anchor);
    handleInHalo.insertBelow(handleIn);
    handleOutHalo.insertBelow(handleOut);

    anchor.data = {
      contourIndex,
      role: "anchor",
      segmentIndex,
    };
    handleIn.data = {
      contourIndex,
      role: "handle-in",
      segmentIndex,
    };
    handleOut.data = {
      contourIndex,
      role: "handle-out",
      segmentIndex,
    };

    return {
      anchor,
      anchorHalo,
      handleIn,
      handleInHalo,
      handleInLine,
      handleOut,
      handleOutHalo,
      handleOutLine,
    } satisfies VectorSegmentChrome;
  };

  const renderScene = (scene: VectorPaperSessionScene) => {
    syncCanvasMetrics(scene);
    clearScene();

    if (!applySceneFrame(scene)) {
      return;
    }

    scene.contours.forEach((contour, contourIndex) => {
      const localPath = createLocalContourPath(scope, contour);
      const path = new scope.Path({
        closed: contour.closed,
        fillColor: null,
        insert: true,
        strokeCap: "round",
        strokeColor: state.styles.selected,
        strokeJoin: "round",
        strokeWidth: state.styles.indicatorWidthPx,
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
        const point = projectPoint(scene.matrix, segment.point);

        path.add(
          new scope.Segment(
            point,
            projectVector(scene.matrix, segment.handleIn),
            projectVector(scene.matrix, segment.handleOut)
          )
        );
        contourChrome.push(
          createContourChrome(contourIndex, point, segmentIndex)
        );
      });

      path.sendToBack();
      state.localPaths.push(localPath);
      state.paths.push(path);
      state.chrome.push(contourChrome);
    });

    state.paths.forEach((path, contourIndex) => {
      path.segments.forEach((segment, segmentIndex) => {
        chrome.refreshPathSegmentChrome(contourIndex, segmentIndex, segment);
      });
    });

    chrome.syncPreviewPath(scene.penPreview || null);
    chrome.syncHoveredChrome();
    scope.view.update();
  };

  const syncActiveSceneFrame = (scene: VectorPaperSessionScene) => {
    syncCanvasMetrics(scene);

    if (!applySceneFrame(scene)) {
      return;
    }

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

        chrome.refreshPathSegmentChrome(contourIndex, segmentIndex, segment);
      });
    });

    chrome.syncPreviewPath(scene.penPreview || null);
    chrome.syncHoveredChrome();
    chrome.syncSelectionMarquee();
    scope.view.update();
  };

  const flushPendingScene = () => {
    if (!state.pendingScene) {
      return;
    }

    const nextScene = state.pendingScene;
    state.pendingScene = null;
    renderScene(nextScene);
  };

  const render = (scene: VectorPaperSessionScene | null) => {
    if (!scene) {
      clearScene();
      return;
    }

    if (state.isGeometryDragging || state.selectionMarquee) {
      state.pendingScene = scene;
      syncActiveSceneFrame(scene);
      return;
    }

    renderScene(scene);
  };

  return {
    clearScene,
    flushPendingScene,
    render,
  };
};
