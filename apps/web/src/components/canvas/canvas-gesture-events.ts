interface GestureCallbacks {
  onCancel?: () => void;
  onFinish: (event: PointerEvent) => void;
  onMove: (event: PointerEvent) => void;
  pointerId: number;
}

export const attachCanvasGestureEvents = ({
  onCancel,
  onFinish,
  onMove,
  pointerId,
}: GestureCallbacks) => {
  const cleanup = () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerCancel);
    window.removeEventListener("keydown", handleKeyDown, true);
  };
  const handlePointerMove = (event: PointerEvent) => {
    if (event.pointerId === pointerId) {
      onMove(event);
    }
  };
  const handlePointerUp = (event: PointerEvent) => {
    if (event.pointerId === pointerId) {
      cleanup();
      onFinish(event);
    }
  };
  const handlePointerCancel = (event: PointerEvent) => {
    if (event.pointerId === pointerId) {
      cleanup();
      onCancel?.();
    }
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cleanup();
      onCancel?.();
    }
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("pointercancel", handlePointerCancel);
  window.addEventListener("keydown", handleKeyDown, true);
};
