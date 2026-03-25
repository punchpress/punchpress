import { clamp, getResizeCorner } from "@punchpress/engine";
import { useMemo, useRef } from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { getHostRectFromNodeFrame } from "./canvas-overlay-geometry";
import { getTextPathTransformTargetStyle } from "./text-path-overlay-geometry";

const EMPTY_PREVIEW = { x: 0, y: 0 };
const ROTATION_ZONE_SIZE = 56;

const getCanvasPoint = (editor, clientX, clientY) => {
  const host = editor.hostRef;
  const viewer = editor.viewerRef;

  if (!(host && viewer && editor.zoom > 0)) {
    return null;
  }

  const hostRect = host.getBoundingClientRect();

  return {
    x: viewer.getScrollLeft() + (clientX - hostRect.left) / editor.zoom,
    y: viewer.getScrollTop() + (clientY - hostRect.top) / editor.zoom,
  };
};

const getClientPoint = (event) => {
  if (typeof event.clientX === "number" && typeof event.clientY === "number") {
    return { x: event.clientX, y: event.clientY };
  }

  return null;
};

const getRectCenter = (rect) => {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
};

const getRectCorner = (rect, corner) => {
  if (!rect) {
    return null;
  }

  return {
    x: corner.endsWith("e") ? rect.right : rect.left,
    y: corner.startsWith("s") ? rect.bottom : rect.top,
  };
};

const getAngleFromCenter = (center, point) => {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
};

const normalizeAngleDelta = (angle) => {
  let nextAngle = angle;

  while (nextAngle > 180) {
    nextAngle -= 360;
  }

  while (nextAngle < -180) {
    nextAngle += 360;
  }

  return nextAngle;
};

const resizeDirection = {
  ne: [1, -1] as const,
  nw: [-1, -1] as const,
  se: [1, 1] as const,
  sw: [-1, 1] as const,
};

const getResizeSession = (
  editor,
  handleElements,
  corner,
  pointer,
  nodeId,
  transformTargetElement
) => {
  const direction = resizeDirection[corner];

  if (!direction) {
    return null;
  }

  const oppositeCorner = getResizeCorner(direction, true);
  const targetAnchorClient = (() => {
    const targetRect = transformTargetElement?.getBoundingClientRect?.();
    return getRectCorner(targetRect, oppositeCorner);
  })();
  const fallbackAnchorClient = (() => {
    const anchorElement = handleElements.current[oppositeCorner];
    const anchorRect = anchorElement?.getBoundingClientRect?.();
    return anchorRect ? getRectCenter(anchorRect) : null;
  })();
  const resolvedAnchorClient = targetAnchorClient || fallbackAnchorClient;
  const resolvedAnchorCanvas = resolvedAnchorClient
    ? getCanvasPoint(editor, resolvedAnchorClient.x, resolvedAnchorClient.y)
    : null;

  if (!(resolvedAnchorCanvas && resolvedAnchorClient && pointer)) {
    return null;
  }

  const resizeSession = editor.beginResizeSelection({
    anchorCanvas: resolvedAnchorCanvas,
    direction,
    nodeId,
  });

  if (!resizeSession) {
    return null;
  }

  return {
    anchorClient: resolvedAnchorClient,
    resizeSession,
    startDistance: Math.max(
      Math.hypot(
        pointer.x - resolvedAnchorClient.x,
        pointer.y - resolvedAnchorClient.y
      ),
      1
    ),
  };
};

const getResizeScale = (pointer, anchorClient, startDistance) => {
  if (!(pointer && anchorClient && Number.isFinite(startDistance))) {
    return null;
  }

  return clamp(
    Math.hypot(pointer.x - anchorClient.x, pointer.y - anchorClient.y) /
      startDistance,
    0.001,
    20
  );
};

const handlePositionStyle = {
  ne: { right: 0, top: 0 },
  nw: { left: 0, top: 0 },
  se: { bottom: 0, right: 0 },
  sw: { bottom: 0, left: 0 },
};

const handleTransformStyle = {
  ne: "translate(50%, -50%)",
  nw: "translate(-50%, -50%)",
  se: "translate(50%, 50%)",
  sw: "translate(-50%, 50%)",
};

const rotationZoneStyle = {
  ne: { right: -28, top: -28 },
  nw: { left: -28, top: -28 },
  se: { bottom: -28, right: -28 },
  sw: { bottom: -28, left: -28 },
};

const resizeCursorClassName = {
  ne: "cursor-nesw-resize",
  nw: "cursor-nwse-resize",
  se: "cursor-nwse-resize",
  sw: "cursor-nesw-resize",
};

export const CanvasSingleNodeTransformOverlay = ({
  isDraggable,
  isResizable,
  isRotatable,
  nodeId,
}) => {
  const editor = useEditor();
  const isSelectionDragging = useEditorValue(
    (_, state) => state.isSelectionDragging
  );
  const isPathEditing = useEditorValue((editor, state) => {
    return state.pathEditingNodeId === nodeId && editor.isPathEditing(nodeId);
  });
  const handleElementsRef = useRef<
    Record<"ne" | "nw" | "se" | "sw", HTMLButtonElement | null>
  >({
    ne: null,
    nw: null,
    se: null,
    sw: null,
  });
  const frame = useEditorSurfaceValue((editor) => {
    return editor.getNodeTransformFrame(nodeId);
  });
  const selectionPreview = useEditorSurfaceValue((editor) => {
    return editor.getSelectionPreviewDelta([nodeId]) || EMPTY_PREVIEW;
  });
  const pathEditOverlayState = useEditorSurfaceValue((editor) => {
    if (!isPathEditing) {
      return null;
    }

    return {
      geometry: editor.getNodeGeometry(nodeId),
      node: editor.getNode(nodeId),
    };
  });
  const transformTargetElement = useEditorSurfaceValue((editor) => {
    return isPathEditing ? editor.getNodeTransformElement(nodeId) : null;
  });

  const overlayRect = useMemo(() => {
    if (
      isPathEditing &&
      pathEditOverlayState?.geometry &&
      pathEditOverlayState.node
    ) {
      const targetStyle = getTextPathTransformTargetStyle(
        editor,
        pathEditOverlayState.node,
        pathEditOverlayState.geometry,
        selectionPreview,
        true
      );

      if (!targetStyle) {
        return null;
      }

      return {
        height: Number.parseFloat(targetStyle.height || "0"),
        left: Number.parseFloat(targetStyle.left || "0"),
        top: Number.parseFloat(targetStyle.top || "0"),
        transform: targetStyle.transform,
        width: Number.parseFloat(targetStyle.width || "0"),
      };
    }

    const hostRect = getHostRectFromNodeFrame(editor, frame);

    if (!hostRect) {
      return null;
    }

    return {
      ...hostRect,
      left: hostRect.left + selectionPreview.x * editor.zoom,
      top: hostRect.top + selectionPreview.y * editor.zoom,
    };
  }, [editor, frame, isPathEditing, pathEditOverlayState, selectionPreview]);

  if (!overlayRect) {
    return null;
  }

  let cursorClassName = "cursor-default";

  if (isDraggable) {
    cursorClassName = isSelectionDragging ? "cursor-grabbing" : "cursor-grab";
  }

  const startSelectionDrag = (event) => {
    if (!(event.button === 0 && isDraggable)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const startClientPoint = {
      x: event.clientX,
      y: event.clientY,
    };
    let previousCanvasPoint = getCanvasPoint(
      editor,
      event.clientX,
      event.clientY
    );
    let dragSession: ReturnType<typeof editor.beginSelectionDrag> = null;

    const handlePointerMove = (moveEvent) => {
      const movedDistance = Math.hypot(
        moveEvent.clientX - startClientPoint.x,
        moveEvent.clientY - startClientPoint.y
      );

      if (!(dragSession || movedDistance >= 3)) {
        return;
      }

      if (!dragSession) {
        dragSession = editor.beginSelectionDrag({
          duplicate: event.altKey,
          nodeId,
        });
      }

      if (!(dragSession && previousCanvasPoint)) {
        return;
      }

      const nextCanvasPoint = getCanvasPoint(
        editor,
        moveEvent.clientX,
        moveEvent.clientY
      );

      if (!nextCanvasPoint) {
        return;
      }

      editor.updateSelectionDrag(dragSession, {
        delta: {
          x: nextCanvasPoint.x - previousCanvasPoint.x,
          y: nextCanvasPoint.y - previousCanvasPoint.y,
        },
      });

      previousCanvasPoint = nextCanvasPoint;
    };

    const handlePointerEnd = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("pointerup", handlePointerEnd);

      if (dragSession) {
        editor.endSelectionDrag(dragSession);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("pointerup", handlePointerEnd);
  };

  const startResize = (corner, event) => {
    if (!(event.button === 0 && isResizable)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const pointer = getClientPoint(event);
    const resizeState = getResizeSession(
      editor,
      handleElementsRef,
      corner,
      pointer,
      nodeId,
      transformTargetElement
    );

    if (!resizeState) {
      return;
    }

    editor.setHoveringSuppressed(true);
    const historyMark = editor.markHistoryStep("resize selection");

    const handlePointerMove = (moveEvent) => {
      const scale = getResizeScale(
        getClientPoint(moveEvent),
        resizeState.anchorClient,
        resizeState.startDistance
      );

      if (!Number.isFinite(scale)) {
        return;
      }

      editor.updateResizeSelection(resizeState.resizeSession, { scale });
    };

    const handlePointerEnd = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("pointerup", handlePointerEnd);
      editor.setHoveringSuppressed(false);

      if (historyMark) {
        editor.commitHistoryStep(historyMark);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("pointerup", handlePointerEnd);
  };

  const startRotate = (event) => {
    if (!(event.button === 0 && isRotatable)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const center = {
      x: overlayRect.left + overlayRect.width / 2,
      y: overlayRect.top + overlayRect.height / 2,
    };
    const startPoint = getClientPoint(event);
    const rotateSession = editor.beginRotateSelection({ nodeId });

    if (!(startPoint && rotateSession)) {
      return;
    }

    const historyMark = editor.markHistoryStep("rotate selection");
    editor.setHoveringSuppressed(true);
    editor.beginSelectionRotationInteraction();

    let previousAngle = getAngleFromCenter(center, startPoint);
    let totalRotation = 0;

    const handlePointerMove = (moveEvent) => {
      const point = getClientPoint(moveEvent);

      if (!point) {
        return;
      }

      const nextAngle = getAngleFromCenter(center, point);
      totalRotation += normalizeAngleDelta(nextAngle - previousAngle);
      previousAngle = nextAngle;

      editor.updateRotateSelection(rotateSession, {
        deltaRotation: totalRotation,
      });
    };

    const handlePointerEnd = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("pointerup", handlePointerEnd);
      editor.endSelectionRotationInteraction();
      editor.setHoveringSuppressed(false);

      if (historyMark) {
        editor.commitHistoryStep(historyMark);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("pointerup", handlePointerEnd);
  };

  return (
    <div
      className={`canvas-moveable canvas-single-node-transform-overlay moveable-control-box absolute ${cursorClassName}`}
      onPointerDown={startSelectionDrag}
      style={{
        height: `${overlayRect.height}px`,
        left: `${overlayRect.left}px`,
        pointerEvents: isDraggable ? "auto" : "none",
        top: `${overlayRect.top}px`,
        transform: overlayRect.transform,
        transformOrigin: "center center",
        width: `${overlayRect.width}px`,
      }}
    >
      <div
        className="moveable-line absolute top-0 left-0 w-full"
        style={{ height: "1.5px" }}
      />
      <div
        className="moveable-line absolute bottom-0 left-0 w-full"
        style={{ height: "1.5px" }}
      />
      <div
        className="moveable-line absolute top-0 left-0 h-full"
        style={{ width: "1.5px" }}
      />
      <div
        className="moveable-line absolute top-0 right-0 h-full"
        style={{ width: "1.5px" }}
      />

      {(["nw", "ne", "sw", "se"] as const).map((corner) => {
        return (
          <div key={corner}>
            {isRotatable ? (
              <div
                className="canvas-rotation-zone canvas-single-node-rotation-zone pointer-events-auto absolute cursor-crosshair"
                data-corner={corner}
                onPointerDown={startRotate}
                style={{
                  ...rotationZoneStyle[corner],
                  height: `${ROTATION_ZONE_SIZE}px`,
                  width: `${ROTATION_ZONE_SIZE}px`,
                }}
              />
            ) : null}

            <button
              className={`moveable-control moveable-${corner} canvas-single-node-control pointer-events-auto absolute ${resizeCursorClassName[corner]}`}
              onPointerDown={(event) => startResize(corner, event)}
              ref={(element) => {
                handleElementsRef.current[corner] = element;
              }}
              style={{
                ...handlePositionStyle[corner],
                transform: handleTransformStyle[corner],
              }}
              type="button"
            />
          </div>
        );
      })}
    </div>
  );
};
