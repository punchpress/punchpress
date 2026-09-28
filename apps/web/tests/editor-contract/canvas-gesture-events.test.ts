import { expect, test } from "bun:test";
import { attachCanvasGestureEvents } from "../../src/components/canvas/canvas-gesture-events";

const pointerEvent = (type: string, pointerId: number) => {
  const event = new Event(type);
  Object.defineProperty(event, "pointerId", { value: pointerId });
  return event;
};

test("synthetic pointer cancellation and Escape end only the active gesture", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const eventTarget = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: eventTarget,
  });

  try {
    const calls: string[] = [];
    const callbacks = {
      onCancel: () => calls.push("cancel"),
      onFinish: () => calls.push("finish"),
      onMove: () => calls.push("move"),
      pointerId: 7,
    };

    attachCanvasGestureEvents(callbacks);
    eventTarget.dispatchEvent(pointerEvent("pointermove", 8));
    eventTarget.dispatchEvent(pointerEvent("pointerup", 8));
    eventTarget.dispatchEvent(pointerEvent("pointermove", 7));
    eventTarget.dispatchEvent(pointerEvent("pointercancel", 7));
    eventTarget.dispatchEvent(pointerEvent("pointerup", 7));
    expect(calls).toEqual(["move", "cancel"]);

    attachCanvasGestureEvents(callbacks);
    const escapeEvent = new Event("keydown", { cancelable: true });
    Object.defineProperty(escapeEvent, "key", { value: "Escape" });
    eventTarget.dispatchEvent(escapeEvent);
    eventTarget.dispatchEvent(pointerEvent("pointerup", 7));
    expect(escapeEvent.defaultPrevented).toBe(true);
    expect(calls).toEqual(["move", "cancel", "cancel"]);

    attachCanvasGestureEvents(callbacks);
    eventTarget.dispatchEvent(pointerEvent("pointerup", 7));
    eventTarget.dispatchEvent(pointerEvent("pointercancel", 7));
    expect(calls).toEqual(["move", "cancel", "cancel", "finish"]);
  } finally {
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", previousWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});
