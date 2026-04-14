import { getPointerDistancePx } from "@punchpress/engine";

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

  const cleanup = () => {
    window.removeEventListener("mousemove", handlePointerMove);
    window.removeEventListener("mouseup", handlePointerUp);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointercancel", handlePointerCancel);
    window.removeEventListener("pointerup", handlePointerUp);
  };

  const getDragDistancePx = (nextEvent) => {
    return getPointerDistancePx(startClientPoint, {
      x: nextEvent.clientX,
      y: nextEvent.clientY,
    });
  };

  const handlePointerMove = (moveEvent) => {
    session.update({
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

  window.addEventListener("mousemove", handlePointerMove);
  window.addEventListener("mouseup", handlePointerUp);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointercancel", handlePointerCancel);
  window.addEventListener("pointerup", handlePointerUp);

  return true;
};
