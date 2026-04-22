import { clamp } from "@punchpress/engine";
import { useMemo, useRef, useState } from "react";
import { NodeContextMenuItems } from "@/components/context-menus/node-context-menu-items";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import {
  getCanvasRotateCursor,
  getCanvasScaleCursor,
} from "../canvas-cursor-assets";
import { drillIntoGroupSelection } from "../canvas-group-drill-in";
import { openCanvasNodeEditingMode } from "../canvas-node-editing";
import { getHostRectFromNodeFrame } from "./canvas-overlay-geometry";
import {
  getRotateCursorRotationDegrees,
  getScaleCursorRotationDegrees,
  getTransformRotationDegrees,
  type TransformCorner,
} from "./transform-cursor-angle";
import { useActiveTransformCursor } from "./use-active-transform-cursor";

const ROTATION_ZONE_SIZE = 56;
const CORNERS = ["nw", "ne", "sw", "se"] as const;

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
  ne: { right: -56, top: -56 },
  nw: { left: -56, top: -56 },
  se: { bottom: -56, right: -56 },
  sw: { bottom: -56, left: -56 },
};

const resizeCursorClassName = {
  ne: "canvas-cursor-scale",
  nw: "canvas-cursor-scale",
  se: "canvas-cursor-scale",
  sw: "canvas-cursor-scale",
};

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

const getRotateCursorForCorner = (
  corner: TransformCorner,
  nodeRotationDegrees: number
) => {
  return getCanvasRotateCursor(
    getRotateCursorRotationDegrees(corner, nodeRotationDegrees)
  );
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

export const CanvasMultiNodeTransformOverlay = ({
  isDraggable,
  isResizable,
  isRotatable,
  nodeIds,
  selectedGroupNodeId,
}) => {
  const editor = useEditor();
  const handleElementsRef = useRef<
    Record<"ne" | "nw" | "se" | "sw", HTMLButtonElement | null>
  >({
    ne: null,
    nw: null,
    se: null,
    sw: null,
  });
  const [activeResizeCorner, setActiveResizeCorner] =
    useState<TransformCorner | null>(null);
  const [activeRotateCursor, setActiveRotateCursor] = useState<string | null>(
    null
  );
  const frame = useEditorSurfaceValue((editor) => {
    return editor.getSelectionTransformFrame(nodeIds);
  });

  const overlayRect = useMemo(() => {
    return getHostRectFromNodeFrame(editor, frame);
  }, [editor, frame]);
  const overlayRotationDegrees = useEditorValue((editor) => {
    const selectionFrame = editor.getSelectionTransformFrame(nodeIds);

    return getTransformRotationDegrees(selectionFrame?.transform);
  });
  const activeTransformCursor =
    activeRotateCursor ??
    (activeResizeCorner !== null
      ? getCanvasScaleCursor(
          getScaleCursorRotationDegrees(
            activeResizeCorner,
            overlayRotationDegrees
          )
        )
      : null);

  useActiveTransformCursor(activeTransformCursor);

  if (!(overlayRect && nodeIds.length > 0)) {
    return null;
  }

  const cursorClassName = "canvas-cursor-default";
  const contextMenuNodeId = nodeIds[0] || selectedGroupNodeId || null;

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
          nodeIds,
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

    const oppositeCorner = CORNERS.find((currentCorner) => {
      return (
        currentCorner !== corner &&
        currentCorner.startsWith(corner.startsWith("n") ? "s" : "n") &&
        currentCorner.endsWith(corner.endsWith("e") ? "w" : "e")
      );
    });
    const anchorElement = oppositeCorner
      ? handleElementsRef.current[oppositeCorner]
      : null;
    const anchorRect = anchorElement?.getBoundingClientRect?.();
    const pointer = getClientPoint(event);

    if (!(anchorRect && pointer)) {
      return;
    }

    const anchorClient = getRectCenter(anchorRect);
    const anchorCanvas = getCanvasPoint(editor, anchorClient.x, anchorClient.y);

    if (!anchorCanvas) {
      return;
    }

    const resizeSession = editor.beginResizeSelection({
      anchorCanvas,
      nodeIds,
    });

    if (!resizeSession) {
      return;
    }

    setActiveResizeCorner(corner);
    editor.setHoveringSuppressed(true);
    const historyMark = editor.markHistoryStep("resize selection");
    const startDistance = Math.max(
      Math.hypot(pointer.x - anchorClient.x, pointer.y - anchorClient.y),
      1
    );

    const handlePointerMove = (moveEvent) => {
      const scale = getResizeScale(
        getClientPoint(moveEvent),
        anchorClient,
        startDistance
      );

      if (!Number.isFinite(scale)) {
        return;
      }

      editor.updateResizeSelection(resizeSession, { scale });
    };

    const handlePointerEnd = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("pointerup", handlePointerEnd);
      setActiveResizeCorner(null);
      editor.setHoveringSuppressed(false);

      if (historyMark) {
        editor.commitHistoryStep(historyMark);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("pointerup", handlePointerEnd);
  };

  const startRotate = (corner: TransformCorner, event) => {
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
    const rotateSession = editor.beginRotateSelection({ nodeIds });

    if (!(startPoint && rotateSession)) {
      return;
    }

    const historyMark = editor.markHistoryStep("rotate selection");
    setActiveRotateCursor(
      getRotateCursorForCorner(corner, overlayRotationDegrees)
    );
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
      setActiveRotateCursor(
        getRotateCursorForCorner(corner, overlayRotationDegrees + totalRotation)
      );

      editor.updateRotateSelection(rotateSession, {
        deltaRotation: totalRotation,
      });
    };

    const handlePointerEnd = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("pointerup", handlePointerEnd);
      editor.endSelectionRotationInteraction();
      setActiveRotateCursor(null);
      editor.setHoveringSuppressed(false);

      if (historyMark) {
        editor.commitHistoryStep(historyMark);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("pointerup", handlePointerEnd);
  };

  const handleDoubleClick = (event) => {
    if (!selectedGroupNodeId) {
      return;
    }

    const targetNodeId = document
      .elementsFromPoint(event.clientX, event.clientY)
      .find(
        (element) => element instanceof HTMLElement && element.dataset.nodeId
      )
      ?.getAttribute("data-node-id");

    if (
      !(
        targetNodeId && editor.isDescendantOf(targetNodeId, selectedGroupNodeId)
      )
    ) {
      return;
    }

    if (
      openCanvasNodeEditingMode(editor, targetNodeId, {
        clientPoint: {
          x: event.clientX,
          y: event.clientY,
        },
      })
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    drillIntoGroupSelection(editor, targetNodeId);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          // biome-ignore lint/a11y/noStaticElementInteractions: editor transform overlays are pointer-only interaction surfaces
          // biome-ignore lint/a11y/noNoninteractiveElementInteractions: editor transform overlays are not semantic controls
          <div
            className={`canvas-moveable canvas-multi-node-transform-overlay moveable-control-box absolute ${cursorClassName}`}
            onDoubleClick={handleDoubleClick}
            onPointerDown={startSelectionDrag}
            style={{
              height: `${overlayRect.height}px`,
              left: `${overlayRect.left}px`,
              top: `${overlayRect.top}px`,
              transform: overlayRect.transform,
              transformOrigin: "center center",
              width: `${overlayRect.width}px`,
            }}
          />
        }
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

        {CORNERS.map((corner) => {
          return (
            <div key={corner}>
              {isRotatable ? (
                <div
                  className="canvas-rotation-zone canvas-multi-node-rotation-zone canvas-cursor-rotate absolute"
                  data-corner={corner}
                  onPointerDown={(event) => startRotate(corner, event)}
                  style={{
                    ...rotationZoneStyle[corner],
                    cursor: getRotateCursorForCorner(
                      corner,
                      overlayRotationDegrees
                    ),
                    height: `${ROTATION_ZONE_SIZE}px`,
                    width: `${ROTATION_ZONE_SIZE}px`,
                  }}
                />
              ) : null}

              <button
                className={`moveable-control moveable-${corner} canvas-multi-node-control absolute ${resizeCursorClassName[corner]}`}
                onPointerDown={(event) => startResize(corner, event)}
                ref={(element) => {
                  handleElementsRef.current[corner] = element;
                }}
                style={{
                  ...handlePositionStyle[corner],
                  cursor: getCanvasScaleCursor(
                    getScaleCursorRotationDegrees(
                      corner,
                      overlayRotationDegrees
                    )
                  ),
                  transform: handleTransformStyle[corner],
                }}
                type="button"
              />
            </div>
          );
        })}
      </ContextMenuTrigger>
      {contextMenuNodeId ? (
        <NodeContextMenuItems nodeId={contextMenuNodeId} />
      ) : null}
    </ContextMenu>
  );
};
