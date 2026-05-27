import { getPointerDistancePx } from "@punchpress/engine";

interface PlacementSessionUpdate {
  altKey?: boolean;
  dragDistancePx: number;
  metaKey?: boolean;
  point: unknown;
  preserveAspectRatio?: boolean;
  spaceKey?: boolean;
}

export const getPlacementSessionEventNames = (event) => {
  if (typeof event.pointerId === "number") {
    return {
      cancel: "pointercancel",
      move: "pointermove",
      up: "pointerup",
    };
  }

  return {
    cancel: null,
    move: "mousemove",
    up: "mouseup",
  };
};

export const startCanvasToolPlacementSession = ({
  editor,
  event,
  getCanvasPoint,
  session,
}) => {
  if (!session) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();

  const eventTarget = event.currentTarget;
  const eventNames = getPlacementSessionEventNames(event);

  if (
    eventTarget instanceof Element &&
    typeof event.pointerId === "number" &&
    "setPointerCapture" in eventTarget
  ) {
    eventTarget.setPointerCapture(event.pointerId);
  }

  const startClientPoint = {
    x: event.clientX,
    y: event.clientY,
  };
  let pendingUpdate: PlacementSessionUpdate | null = null;
  let updateFrameId = 0;

  const flushPendingUpdate = () => {
    updateFrameId = 0;

    if (!pendingUpdate) {
      return;
    }

    const nextUpdate = pendingUpdate;
    pendingUpdate = null;
    session.update(nextUpdate);
  };

  const scheduleUpdate = (nextUpdate) => {
    pendingUpdate = nextUpdate;

    if (updateFrameId) {
      return;
    }

    updateFrameId = window.requestAnimationFrame(flushPendingUpdate);
  };

  const cleanup = () => {
    window.removeEventListener(eventNames.move, handlePointerMove);
    window.removeEventListener(eventNames.up, handlePointerUp);

    if (eventNames.cancel) {
      window.removeEventListener(eventNames.cancel, handlePointerCancel);
    }

    window.cancelAnimationFrame(updateFrameId);
    updateFrameId = 0;
    pendingUpdate = null;
  };

  const getDragDistancePx = (nextEvent) => {
    return getPointerDistancePx(startClientPoint, {
      x: nextEvent.clientX,
      y: nextEvent.clientY,
    });
  };

  const handlePointerMove = (moveEvent) => {
    scheduleUpdate({
      altKey: moveEvent.altKey,
      dragDistancePx: getDragDistancePx(moveEvent),
      metaKey: moveEvent.metaKey,
      point: getCanvasPoint(moveEvent.clientX, moveEvent.clientY),
      preserveAspectRatio: moveEvent.shiftKey,
      spaceKey:
        editor.getState().spacePressed ||
        moveEvent.code === "Space" ||
        moveEvent.getModifierState?.("Space"),
    });
  };

  const handlePointerCancel = () => {
    cleanup();
    session.cancel();
  };

  const handlePointerUp = (upEvent) => {
    flushPendingUpdate();
    cleanup();
    session.complete({
      altKey: upEvent.altKey,
      dragDistancePx: getDragDistancePx(upEvent),
      metaKey: upEvent.metaKey,
      point: getCanvasPoint(upEvent.clientX, upEvent.clientY),
      preserveAspectRatio: upEvent.shiftKey,
      spaceKey:
        editor.getState().spacePressed ||
        upEvent.code === "Space" ||
        upEvent.getModifierState?.("Space"),
    });
    editor.notifyPlacementSurfaceApplied();
  };

  window.addEventListener(eventNames.move, handlePointerMove);
  window.addEventListener(eventNames.up, handlePointerUp);

  if (eventNames.cancel) {
    window.addEventListener(eventNames.cancel, handlePointerCancel);
  }

  return true;
};
