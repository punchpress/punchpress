import { describe, expect, test } from "bun:test";
import { startCanvasNodeDragSession } from "../src/components/canvas/canvas-node/node-interactions";

const createPointerEvent = (type: string, clientX: number, clientY: number) => {
  const event = new Event(type);

  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: 1 },
  });

  return event;
};

const createDragHarness = () => {
  const eventTarget = new EventTarget();
  let animationFrameCallback: (() => void) | null = null;
  const updates: Array<{ delta: { x: number; y: number } }> = [];
  const endings: Array<{ cancel?: boolean }> = [];

  const fakeWindow = Object.assign(eventTarget, {
    cancelAnimationFrame: () => undefined,
    requestAnimationFrame: (callback: () => void) => {
      animationFrameCallback = callback;
      return 1;
    },
  });

  const editor = {
    beginSelectionDrag: () => ({ id: "drag-session" }),
    endSelectionDrag: (_session, options) => {
      endings.push(options || {});
    },
    getSelectionTargetNodeId: () => null,
    hostRef: {
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
    },
    updateSelectionDrag: (_session, options) => {
      updates.push(options);
    },
    selectedNodeIds: ["node"],
    viewerRef: {
      getScrollLeft: () => 0,
      getScrollTop: () => 0,
    },
    zoom: 1,
  };

  return {
    editor,
    finishPrewarm: () => animationFrameCallback?.(),
    move: (clientX: number, clientY: number) => {
      eventTarget.dispatchEvent(
        createPointerEvent("pointermove", clientX, clientY)
      );
    },
    end: () => {
      eventTarget.dispatchEvent(createPointerEvent("pointerup", 100, 100));
    },
    endings,
    updates,
    window: fakeWindow,
  };
};

describe("canvas node selection drag threshold", () => {
  test("cancels a prewarmed selected drag that moves less than three screen pixels", () => {
    const previousWindow = Object.getOwnPropertyDescriptor(
      globalThis,
      "window"
    );
    const harness = createDragHarness();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: harness.window,
    });

    try {
      startCanvasNodeDragSession({
        editor: harness.editor,
        event: {
          altKey: false,
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          preventDefault: () => undefined,
          stopPropagation: () => undefined,
        },
        isSelectionTargetSelected: true,
        nodeId: "node",
      });
      harness.finishPrewarm();
      harness.move(101, 100);
      harness.end();

      expect(harness.updates).toEqual([{ delta: { x: 0, y: 0 } }]);
      expect(harness.endings).toEqual([{ cancel: true }]);
    } finally {
      if (previousWindow) {
        Object.defineProperty(globalThis, "window", previousWindow);
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    }
  });

  test("commits a prewarmed selected drag and tracks a return inside the threshold", () => {
    const previousWindow = Object.getOwnPropertyDescriptor(
      globalThis,
      "window"
    );
    const harness = createDragHarness();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: harness.window,
    });

    try {
      startCanvasNodeDragSession({
        editor: harness.editor,
        event: {
          altKey: false,
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          preventDefault: () => undefined,
          stopPropagation: () => undefined,
        },
        isSelectionTargetSelected: true,
        nodeId: "node",
      });
      harness.finishPrewarm();
      harness.move(104, 100);
      harness.move(101, 100);
      harness.move(100, 100);
      harness.end();

      expect(harness.updates).toEqual([
        { delta: { x: 0, y: 0 } },
        { delta: { x: 4, y: 0 }, queueRefresh: true },
        { delta: { x: -3, y: 0 }, queueRefresh: true },
        { delta: { x: -1, y: 0 }, queueRefresh: true },
      ]);
      expect(harness.endings).toEqual([{ cancel: false }]);
    } finally {
      if (previousWindow) {
        Object.defineProperty(globalThis, "window", previousWindow);
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    }
  });
});
