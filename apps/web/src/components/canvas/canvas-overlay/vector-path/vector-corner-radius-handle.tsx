import { isPointerDistanceAtLeast } from "@punchpress/engine";
import {
  getActiveVectorPathCursorToken,
  getVectorPathCursorToken,
  setActiveCanvasCursorToken,
} from "../../canvas-cursor-policy";
import {
  CORNER_RADIUS_HANDLE_DOT_ACTIVE_CLASS,
  CORNER_RADIUS_HANDLE_DOT_CLASS,
  CORNER_RADIUS_HANDLE_DOT_WARNING_CLASS,
  FANCY_CANVAS_HANDLE_BUTTON_CLASS,
  FANCY_CANVAS_HANDLE_WARNING_BUTTON_CLASS,
} from "../canvas-handle-icon-styles";
import { getVectorCornerRadiusDragContours } from "./corner-radius-drag";
import {
  getVectorCornerRadiusFromWidgetDragDelta,
  getVectorCornerWidgetDisplayGeometry,
  getVectorCornerWidgetGeometry,
} from "./corner-widget-geometry";
import { createVectorCornerDragSession } from "./vector-corner-drag-session";
import {
  getVisibleVectorCornerHandles,
  shouldAdjustSelectedCornerPoints,
} from "./vector-corner-radius-points";

const CORNER_RADIUS_MAX_EPSILON = 0.01;
const CORNER_RADIUS_HANDLE_DRAG_THRESHOLD_PX = 4;

const roundDelta = (value: number) => Math.round(value * 100) / 100;
const getEventClientPoint = (event) => ({
  x: event.clientX,
  y: event.clientY,
});
const isSamePathPoint = (a, b) => {
  return Boolean(
    a &&
      b &&
      a.contourIndex === b.contourIndex &&
      a.segmentIndex === b.segmentIndex
  );
};

const getCanvasPoint = (editor, clientX: number, clientY: number) => {
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

export const VectorCornerRadiusHandle = ({
  isWarningActive = false,
  activeDragSession = null,
  contours,
  editor,
  hoveredPoint,
  isSelected = false,
  matrix,
  nodeId,
  onDragStateChange,
  onHoverChange,
  dragScope,
  selectedPoints,
  selectedPoint,
}) => {
  if (!(contours && matrix && nodeId && selectedPoint)) {
    return null;
  }

  if (!editor.canRoundPathPoint(nodeId, selectedPoint)) {
    return null;
  }

  const currentRadius = editor.getPathPointCornerRadius(nodeId, selectedPoint);
  const baseGeometry = getVectorCornerWidgetGeometry({
    contours,
    currentRadius,
    matrix,
    point: selectedPoint,
  });
  const geometry =
    dragScope === "active" && activeDragSession?.displayGeometry
      ? getVectorCornerWidgetDisplayGeometry(
          activeDragSession.displayGeometry,
          activeDragSession.displayRadius ?? currentRadius,
          activeDragSession.maxRadius
        )
      : baseGeometry;

  if (!geometry) {
    return null;
  }

  const cursorToken = getVectorPathCursorToken("point");
  const activeCursorToken =
    getActiveVectorPathCursorToken("point") || cursorToken;
  const pathPoint = {
    contourIndex: selectedPoint.contourIndex,
    segmentIndex: selectedPoint.segmentIndex,
  };
  const isHovered = isSamePathPoint(hoveredPoint, pathPoint);
  const adjustsSelectedPoints = shouldAdjustSelectedCornerPoints(
    dragScope,
    selectedPoints
  );
  const cornerControl = editor.getPathPointCornerControl(nodeId, pathPoint);
  const dragSession = createVectorCornerDragSession({
    contours,
    displayGeometry: baseGeometry,
    displayRadius: currentRadius,
    maxRadius: adjustsSelectedPoints
      ? editor.getPathCornerRadiusStableMax(nodeId)
      : (cornerControl?.maxRadius ?? 0),
    point: pathPoint,
  });

  const startHandleInteraction = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (
      event.currentTarget instanceof Element &&
      typeof event.pointerId === "number" &&
      "setPointerCapture" in event.currentTarget
    ) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const dragStartSession = editor.getEditablePathSession(nodeId);
    let didChange = false;
    let didStartDrag = false;
    let historyMark: ReturnType<typeof editor.markHistoryStep> | null = null;
    const dragStartClientPoint = getEventClientPoint(event);
    const dragStartPoint = getCanvasPoint(editor, event.clientX, event.clientY);
    const dragStartGeometry = geometry;
    const dragStartRadius = currentRadius;
    const dragStartContours = dragStartSession?.contours || contours;
    let isAtMax = false;
    const beginDragInteraction = () => {
      if (didStartDrag) {
        return true;
      }

      historyMark = editor.markHistoryStep("edit vector path");

      if (!historyMark) {
        return false;
      }

      didStartDrag = true;
      onDragStateChange?.(dragSession);
      setActiveCanvasCursorToken(editor.hostRef, activeCursorToken);
      return true;
    };
    const shouldStartDrag = (moveEvent) => {
      return (
        didStartDrag ||
        isPointerDistanceAtLeast(
          dragStartClientPoint,
          getEventClientPoint(moveEvent),
          CORNER_RADIUS_HANDLE_DRAG_THRESHOLD_PX
        )
      );
    };
    const updateActiveDragState = (nextCornerRadius) => {
      const appliedRadius = editor.getPathPointCornerRadius(nodeId, pathPoint);
      const nextIsAtMax =
        dragStartGeometry.maxRadius - appliedRadius <=
        CORNER_RADIUS_MAX_EPSILON;

      if (nextIsAtMax !== isAtMax) {
        isAtMax = nextIsAtMax;
      }

      onDragStateChange?.(
        dragSession
          ? {
              ...dragSession,
              displayRadius: nextCornerRadius,
              isAtMax,
            }
          : null
      );
    };
    const applyDragMove = (moveEvent) => {
      const nextCornerRadius = roundDelta(
        getVectorCornerRadiusFromWidgetDragDelta(
          dragStartGeometry,
          dragStartPoint,
          getCanvasPoint(editor, moveEvent.clientX, moveEvent.clientY),
          dragStartRadius
        )
      );

      if (
        Math.abs(
          nextCornerRadius - editor.getPathPointCornerRadius(nodeId, pathPoint)
        ) <= 0.01
      ) {
        return;
      }

      const nextContours = getVectorCornerRadiusDragContours({
        contours: dragStartContours,
        dragScope,
        point: pathPoint,
        radius: nextCornerRadius,
        selectedPoints,
      });

      if (!nextContours) {
        return;
      }

      const didSetCornerRadius = editor.updateEditablePath(
        nodeId,
        nextContours
      );

      if (didSetCornerRadius) {
        didChange = true;
      }

      updateActiveDragState(nextCornerRadius);
    };

    const handlePointerMove = (moveEvent) => {
      const nextSession = editor.getEditablePathSession(nodeId);

      if (nextSession?.backend !== "vector-path") {
        return;
      }

      if (!shouldStartDrag(moveEvent)) {
        return;
      }

      if (!beginDragInteraction()) {
        return;
      }

      applyDragMove(moveEvent);
    };

    const handlePointerEnd = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("pointerup", handlePointerEnd);
      onDragStateChange?.(null);
      setActiveCanvasCursorToken(editor.hostRef, null);

      if (didChange && historyMark) {
        editor.commitHistoryStep(historyMark);
        return;
      }

      if (historyMark) {
        editor.revertToMark(historyMark);
      }

      if (!editor.isPathEditing(nodeId)) {
        editor.startPathEditing(nodeId);
      }

      editor.setPathEditingPoints([pathPoint], pathPoint);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("pointerup", handlePointerEnd);
  };

  return (
    <button
      aria-label="Adjust corner radius"
      className={`${FANCY_CANVAS_HANDLE_BUTTON_CLASS} ${isWarningActive ? FANCY_CANVAS_HANDLE_WARNING_BUTTON_CLASS : ""}`}
      data-canvas-cursor={cursorToken || undefined}
      data-selected={isSelected ? "true" : undefined}
      data-testid="path-corner-radius-handle"
      onBlur={() => {
        if (
          hoveredPoint?.contourIndex === pathPoint.contourIndex &&
          hoveredPoint?.segmentIndex === pathPoint.segmentIndex
        ) {
          onHoverChange?.(null);
        }
      }}
      onFocus={() => {
        onHoverChange?.(pathPoint);
      }}
      onPointerDown={startHandleInteraction}
      onPointerEnter={() => {
        onHoverChange?.(pathPoint);
      }}
      onPointerLeave={() => {
        if (
          hoveredPoint?.contourIndex === pathPoint.contourIndex &&
          hoveredPoint?.segmentIndex === pathPoint.segmentIndex
        ) {
          onHoverChange?.(null);
        }
      }}
      style={{
        left: `${geometry.center.x}px`,
        top: `${geometry.center.y}px`,
        touchAction: "none",
        transform: "translate(-50%, -50%)",
      }}
      type="button"
    >
      <span
        aria-hidden="true"
        className={`${CORNER_RADIUS_HANDLE_DOT_CLASS} ${isHovered || isSelected ? CORNER_RADIUS_HANDLE_DOT_ACTIVE_CLASS : ""} ${isWarningActive ? CORNER_RADIUS_HANDLE_DOT_WARNING_CLASS : ""}`}
      />
    </button>
  );
};

export const VectorCornerRadiusHandles = ({
  activeDragSession,
  contours,
  editor,
  hoveredPoint,
  matrix,
  nodeId,
  onDragStateChange,
  onHoverChange,
  selectedPoints,
}) => {
  if (!(contours && matrix && nodeId)) {
    return null;
  }

  const visibleHandles = getVisibleVectorCornerHandles(
    contours,
    selectedPoints || [],
    activeDragSession
  );
  const visibleHandlePoints = visibleHandles.points;

  if (visibleHandlePoints.length === 0) {
    return null;
  }

  return visibleHandlePoints.map((point) => {
    const isSelected = (selectedPoints || []).some((selectedPoint) => {
      return isSamePathPoint(selectedPoint, point);
    });

    return (
      <VectorCornerRadiusHandle
        activeDragSession={activeDragSession}
        contours={contours}
        dragScope={visibleHandles.dragScope}
        editor={editor}
        hoveredPoint={hoveredPoint}
        isSelected={isSelected}
        isWarningActive={Boolean(activeDragSession?.isAtMax)}
        key={`${point.contourIndex}:${point.segmentIndex}`}
        matrix={matrix}
        nodeId={nodeId}
        onDragStateChange={onDragStateChange}
        onHoverChange={onHoverChange}
        selectedPoint={point}
        selectedPoints={selectedPoints || []}
      />
    );
  });
};
