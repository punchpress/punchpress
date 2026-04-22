import {
  type Editor,
  getVectorPathCursorMode,
  isPointerDistanceAtLeast,
  offsetEditablePathPoints,
  setVectorPointHandlesFromAnchorDrag,
  updateVectorPointHandle,
} from "@punchpress/engine";
import type paper from "paper";
import { getCanvasDeepLeafNodeIdAtPoint } from "./canvas-node-hit-target";
import {
  finalizeVectorEndpointDrag,
  getVectorDraggedEndpointPreviewPoint,
  resolveVectorEndpointDragTarget,
} from "./endpoint-close";
import {
  findVectorPathInsertTarget,
  splitVectorContourAtOffset,
} from "./paper-point-insert";
import type { PaperSessionChromeController } from "./paper-session-chrome";
import {
  findPathBodyHit,
  getDragModifierState,
  getInteractiveHit,
} from "./paper-session-interaction";
import { projectPoint } from "./paper-session-render";
import type { PaperSessionSceneController } from "./paper-session-scene";
import {
  getAnchorSelectionsInRectangle,
  isPointSelectionIncluded,
} from "./paper-session-selection";
import type {
  ActivePointDrag,
  PendingPress,
  VectorPaperSessionState,
} from "./paper-session-state";
import type { VectorPathPoint } from "./vector-corner-drag-session";

const ENDPOINT_CLOSE_SNAP_DISTANCE_PX = 14;
const PATH_POINT_DRAG_THRESHOLD_PX = 4;
const SELECTION_MARQUEE_THRESHOLD_PX = 4;

const roundDelta = (value: number) => Math.round(value * 100) / 100;

const getCanvasPoint = (editor: Editor, clientX: number, clientY: number) => {
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

const mapTargetSegment = (
  contours: VectorPaperSessionState["contours"],
  target: VectorPathPoint,
  mapper: (
    segment: VectorPaperSessionState["contours"][number]["segments"][number]
  ) => VectorPaperSessionState["contours"][number]["segments"][number]
) => {
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

interface CreatePaperSessionToolControllerOptions {
  chrome: PaperSessionChromeController;
  editor: Editor;
  nodeId: string;
  onExitPathEditing: () => void;
  onHistoryCommit: (historyMark: unknown) => void;
  onHistoryStart: () => unknown;
  scene: PaperSessionSceneController;
  scope: paper.PaperScope;
  state: VectorPaperSessionState;
}

export interface PaperSessionToolController {
  destroy: () => void;
  resetInteractionChrome: () => void;
}

export const createPaperSessionToolController = ({
  chrome,
  editor,
  nodeId,
  onExitPathEditing,
  onHistoryCommit,
  onHistoryStart,
  scene,
  scope,
  state,
}: CreatePaperSessionToolControllerOptions): PaperSessionToolController => {
  const resetInteractionChrome = () => {
    chrome.setActiveCursorCompanionLabel(null);
    chrome.setHoveredPoint(null);
    chrome.setHoverCursorMode(null);
    chrome.setActiveCursorMode(null);
    editor.setHoveredNode(null);
  };

  const startNodeDrag = (nativeEvent: MouseEvent) => {
    state.nodeDragSession = editor.beginSelectionDrag({
      nodeId,
    });
    state.dragCanvasPoint = getCanvasPoint(
      editor,
      nativeEvent.clientX,
      nativeEvent.clientY
    );

    if (!state.nodeDragSession) {
      state.dragCanvasPoint = null;
      return false;
    }

    chrome.setHoverCursorMode(null);
    chrome.setActiveCursorMode("body");
    editor.setHoveredNode(null);
    chrome.setSelectedPoints([], null);
    return true;
  };

  const updateNodeDrag = (nativeEvent: MouseEvent) => {
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
    chrome.setActiveCursorMode(null);
  };

  const getPathInteraction = (point: paper.Point) => {
    const localPoint = chrome.getLocalPoint(point);

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

  const insertPointAtTarget = (
    target: Extract<PendingPress, { type: "insert" }>
  ) => {
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

  const updateCursor = (
    point: paper.Point,
    event: MouseEvent | null = null
  ) => {
    if (state.isPanning) {
      chrome.setHoveredPoint(null);
      chrome.setHoverCursorMode(null);
      chrome.setActiveCursorMode(null);
      editor.setHoveredNode(null);
      return;
    }

    if (state.nodeDragSession || state.activeDrag || state.selectionMarquee) {
      editor.setHoveredNode(null);
      return;
    }

    const hit = getInteractiveHit(scope, point);
    const role = hit?.item?.data?.role;
    const { bodyHit, insertTarget } = getPathInteraction(point);

    if (role === "anchor" || role === "handle-in" || role === "handle-out") {
      chrome.setHoveredPoint({
        contourIndex: hit.item.data.contourIndex,
        role,
        segmentIndex: hit.item.data.segmentIndex,
      });
      editor.setHoveredNode(null);
    } else {
      chrome.setHoveredPoint(null);
      const hoveredNodeId = event?.clientX
        ? getCanvasDeepLeafNodeIdAtPoint(editor, event.clientX, event.clientY)
        : null;
      editor.setHoveredNode(
        hoveredNodeId && hoveredNodeId !== nodeId ? hoveredNodeId : null
      );
    }

    const hoverCursorMode = getVectorPathCursorMode({
      isBodyHit: Boolean(bodyHit),
      isInsertHit: Boolean(insertTarget),
      role,
    });

    chrome.setHoverCursorMode(hoverCursorMode);
  };

  const getDraggedAnchorPoints = (
    role: ActivePointDrag["role"],
    contourIndex: number,
    segmentIndex: number
  ) => {
    if (role !== "anchor") {
      return [];
    }

    if (
      state.selectedPoints.length > 1 &&
      isPointSelectionIncluded(state.selectedPoints, {
        contourIndex,
        segmentIndex,
      })
    ) {
      return state.selectedPoints;
    }

    return [
      {
        contourIndex,
        segmentIndex,
      },
    ];
  };

  const applyConvertAnchorToSmoothDrag = (
    contourIndex: number,
    segmentIndex: number,
    localPoint: paper.Point,
    worldPoint: { x: number; y: number } | null,
    modifiers: ReturnType<typeof getDragModifierState>,
    currentSegment: VectorPaperSessionState["contours"][number]["segments"][number]
  ) => {
    chrome.setEndpointDragTarget(null);
    state.contours = setVectorPointHandlesFromAnchorDrag(state.contours, {
      constrainAngle: modifiers.constrainAngle,
      contourIndex,
      segmentIndex,
      value: {
        x: localPoint.x - currentSegment.point.x,
        y: localPoint.y - currentSegment.point.y,
      },
    });

    chrome.applySourceSegmentToPaper(contourIndex, segmentIndex, {
      updateView: true,
    });
    chrome.syncNode({
      pinnedLocalPoint: {
        x: localPoint.x,
        y: localPoint.y,
      },
      pinnedWorldPoint: worldPoint,
    });
  };

  const updateDraggedGeometry = (
    role: ActivePointDrag["role"],
    contourIndex: number,
    segmentIndex: number,
    point: paper.Point,
    worldPoint: { x: number; y: number } | null,
    modifiers: ReturnType<typeof getDragModifierState>
  ) => {
    const localPoint = chrome.getLocalPoint(point);

    if (!localPoint) {
      return;
    }

    const currentSegment = state.contours[contourIndex]?.segments[segmentIndex];

    if (!currentSegment) {
      return;
    }

    if (role === "anchor" && modifiers.convertAnchorToSmooth) {
      applyConvertAnchorToSmoothDrag(
        contourIndex,
        segmentIndex,
        localPoint,
        worldPoint,
        modifiers,
        currentSegment
      );
      return;
    }

    const selectedAnchorPoints = getDraggedAnchorPoints(
      role,
      contourIndex,
      segmentIndex
    );

    if (selectedAnchorPoints.length > 1) {
      const delta = {
        x: localPoint.x - currentSegment.point.x,
        y: localPoint.y - currentSegment.point.y,
      };

      chrome.setEndpointDragTarget(null);
      state.contours = offsetEditablePathPoints(
        state.contours,
        selectedAnchorPoints,
        delta
      );

      for (const selectedPoint of selectedAnchorPoints) {
        chrome.applySourceSegmentToPaper(
          selectedPoint.contourIndex,
          selectedPoint.segmentIndex
        );
      }

      chrome.syncHoveredChrome();
      chrome.syncNode({
        pinnedLocalPoint: {
          x: localPoint.x,
          y: localPoint.y,
        },
        pinnedWorldPoint: worldPoint,
      });
      return;
    }

    if (role === "anchor") {
      const nextEndpointDragTarget = state.matrix
        ? resolveVectorEndpointDragTarget(
            state.contours,
            {
              contourIndex,
              segmentIndex,
            },
            {
              x: point.x,
              y: point.y,
            },
            {
              projectPoint: (targetPoint) =>
                projectPoint(state.matrix, targetPoint),
              snapDistancePx: ENDPOINT_CLOSE_SNAP_DISTANCE_PX,
            }
          )
        : null;
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
        nextEndpointDragTarget
      );

      chrome.setEndpointDragTarget(nextEndpointDragTarget);
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
      chrome.applySourceSegmentToPaper(contourIndex, segmentIndex, {
        updateView: true,
      });
      chrome.syncNode({
        pinnedLocalPoint: {
          x: localPoint.x,
          y: localPoint.y,
        },
        pinnedWorldPoint: worldPoint,
      });
      return;
    }

    chrome.setEndpointDragTarget(null);
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
    chrome.applySourceSegmentToPaper(contourIndex, segmentIndex, {
      updateView: true,
    });
    chrome.syncNode({
      pinnedLocalPoint: localPoint,
      pinnedWorldPoint: worldPoint,
    });
  };

  const handlePointMouseDown = (
    event: paper.ToolEvent,
    hit: NonNullable<ReturnType<typeof getInteractiveHit>>,
    role: ActivePointDrag["role"],
    isAdditiveSelection: boolean
  ) => {
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
            return !(
              currentPoint.contourIndex === pointSelection.contourIndex &&
              currentPoint.segmentIndex === pointSelection.segmentIndex
            );
          })
        : [...state.selectedPoints, pointSelection];
      const nextPrimaryPoint =
        nextSelectedPoints.length === 1 ? nextSelectedPoints[0] : null;

      chrome.setSelectedPoints(nextSelectedPoints, nextPrimaryPoint);
    } else {
      state.pendingPress = {
        ...hit.item.data,
        origin: event.point.clone(),
        type: "point",
      };
      chrome.setSelectedPoints(
        isPointSelectionIncluded(state.selectedPoints, pointSelection)
          ? state.selectedPoints
          : [pointSelection],
        pointSelection
      );
    }

    chrome.setHoveredPoint({
      contourIndex: hit.item.data.contourIndex,
      role,
      segmentIndex: hit.item.data.segmentIndex,
    });
    chrome.setHoverCursorMode("point");
  };

  const updateSelectionMarqueeDrag = (event: paper.ToolEvent) => {
    if (state.pendingPress?.type !== "empty") {
      return false;
    }

    if (
      !state.selectionMarquee &&
      isPointerDistanceAtLeast(
        state.pendingPress.origin,
        event.point,
        SELECTION_MARQUEE_THRESHOLD_PX
      )
    ) {
      state.selectionMarquee = {
        additive: state.pendingPress.additive,
        current: event.point.clone(),
        origin: state.pendingPress.origin.clone(),
      };
      chrome.syncSelectionMarquee();
      chrome.setHoveredPoint(null);
      chrome.setHoverCursorMode(null);
    }

    if (state.selectionMarquee) {
      state.selectionMarquee.current = event.point.clone();
      chrome.syncSelectionMarquee();
      scope.view.update();
    }

    return true;
  };

  const beginPendingDrag = (event: paper.ToolEvent) => {
    if (
      state.pendingPress?.type === "body" ||
      state.pendingPress?.type === "insert"
    ) {
      state.pendingPress = null;

      if (event.event) {
        startNodeDrag(event.event as MouseEvent);
      }
    }

    if (
      !(
        state.pendingPress?.type === "point" &&
        !state.activeDrag &&
        isPointerDistanceAtLeast(
          state.pendingPress.origin,
          event.point,
          PATH_POINT_DRAG_THRESHOLD_PX
        )
      )
    ) {
      return;
    }

    state.activeDrag = state.pendingPress;
    state.pendingPress = null;
    state.historyMark = onHistoryStart();
    state.isGeometryDragging = true;
    chrome.setEndpointDragTarget(null);
    chrome.setHoveredPoint(null);
    chrome.setHoverCursorMode(null);
    chrome.setActiveCursorMode("point");
    editor.setHoveredNode(null);
  };

  const finalizeSelectionMarquee = (event: paper.ToolEvent) => {
    if (!state.selectionMarquee) {
      return false;
    }

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

    chrome.setSelectedPoints(nextSelectedPoints, nextPrimaryPoint);
    chrome.hideSelectionMarquee();
    updateCursor(event.point, (event.event as MouseEvent) || null);
    return true;
  };

  const handleEmptyCanvasRelease = (event: paper.ToolEvent) => {
    const hoveredNodeId = event.event
      ? getCanvasDeepLeafNodeIdAtPoint(
          editor,
          (event.event as MouseEvent).clientX,
          (event.event as MouseEvent).clientY
        )
      : null;

    if (!(hoveredNodeId && hoveredNodeId !== nodeId)) {
      onExitPathEditing();
      return;
    }

    if (editor.canStartPathEditing(hoveredNodeId)) {
      editor.startPathEditing(hoveredNodeId);
      return;
    }

    editor.select(hoveredNodeId);
  };

  const finalizePendingPress = (
    pendingPress: PendingPress | null,
    event: paper.ToolEvent
  ) => {
    if (state.activeDrag) {
      return false;
    }

    if (pendingPress?.type === "insert") {
      insertPointAtTarget(pendingPress);
    } else if (pendingPress?.type === "empty" && !pendingPress.additive) {
      handleEmptyCanvasRelease(event);
    }

    updateCursor(event.point, (event.event as MouseEvent) || null);
    return true;
  };

  const finalizeActivePointDrag = () => {
    if (
      !(
        state.activeDrag?.role === "anchor" &&
        state.endpointDragTarget &&
        state.activeDrag.type === "point"
      )
    ) {
      return;
    }

    const finalizeResult = finalizeVectorEndpointDrag(
      state.contours,
      {
        contourIndex: state.activeDrag.contourIndex,
        segmentIndex: state.activeDrag.segmentIndex,
      },
      state.endpointDragTarget
    );

    if (!finalizeResult) {
      return;
    }

    const didChangeTopology = finalizeResult.contours !== state.contours;

    state.contours = finalizeResult.contours;
    chrome.setSelectedPoints(
      finalizeResult.selectedPoints,
      finalizeResult.primaryPoint
    );

    if (didChangeTopology) {
      chrome.syncNode();
    }
  };

  const tool = new scope.Tool();

  tool.onMouseDown = (event) => {
    const hit = getInteractiveHit(scope, event.point);
    const role = hit?.item?.data?.role;
    const { bodyHit, insertTarget } = getPathInteraction(event.point);
    const isAdditiveSelection = Boolean((event.event as MouseEvent)?.shiftKey);

    if (
      hit &&
      (role === "anchor" || role === "handle-in" || role === "handle-out")
    ) {
      handlePointMouseDown(event, hit, role, isAdditiveSelection);
      return;
    }

    if (insertTarget) {
      state.pendingPress = {
        ...insertTarget,
        type: "insert",
      };
      chrome.setHoverCursorMode("insert");
      return;
    }

    if (bodyHit) {
      state.pendingPress = {
        type: "body",
      };
      chrome.setSelectedPoint(null);
      chrome.setHoverCursorMode("body");
      return;
    }

    state.pendingPress = {
      additive: isAdditiveSelection,
      origin: event.point.clone(),
      type: "empty",
    };
    chrome.setHoveredPoint(null);
  };

  tool.onMouseDrag = (event) => {
    if (state.nodeDragSession && event.event) {
      updateNodeDrag(event.event as MouseEvent);
      return;
    }

    if (updateSelectionMarqueeDrag(event)) {
      return;
    }

    beginPendingDrag(event);

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
        ? getCanvasPoint(
            editor,
            (event.event as MouseEvent).clientX,
            (event.event as MouseEvent).clientY
          )
        : null,
      getDragModifierState(event.event as MouseEvent | null, role)
    );
  };

  tool.onMouseMove = (event) => {
    if (state.selectionMarquee) {
      return;
    }

    updateCursor(event.point, (event.event as MouseEvent) || null);
  };

  tool.onMouseUp = (event) => {
    const pendingPress = state.pendingPress;

    if (state.nodeDragSession) {
      endNodeDrag();
      updateCursor(event.point, (event.event as MouseEvent) || null);
      return;
    }

    state.pendingPress = null;

    if (finalizeSelectionMarquee(event)) {
      return;
    }

    if (finalizePendingPress(pendingPress, event)) {
      return;
    }

    finalizeActivePointDrag();

    state.activeDrag = null;
    state.isGeometryDragging = false;
    chrome.setEndpointDragTarget(null);
    chrome.setActiveCursorMode(null);

    if (state.historyMark) {
      onHistoryCommit(state.historyMark);
      state.historyMark = null;
    }

    scene.flushPendingScene();
    updateCursor(event.point, (event.event as MouseEvent) || null);
  };

  return {
    destroy: () => {
      resetInteractionChrome();
      tool.onMouseDown = null;
      tool.onMouseDrag = null;
      tool.onMouseMove = null;
      tool.onMouseUp = null;
      tool.remove?.();
    },
    resetInteractionChrome,
  };
};
