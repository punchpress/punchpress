import { afterEach, describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const globalWithWindow = globalThis as typeof globalThis & { window?: any };
const originalWindow = globalWithWindow.window;

afterEach(() => {
  globalWithWindow.window = originalWindow;
});

const installFakeRaf = () => {
  const queue: Array<() => void> = [];
  globalWithWindow.window = {
    addEventListener: () => undefined,
    cancelAnimationFrame: () => undefined,
    removeEventListener: () => undefined,
    requestAnimationFrame: (cb: () => void) => {
      queue.push(cb);
      return queue.length;
    },
  };

  return {
    tick: () => {
      for (const cb of queue.splice(0, queue.length)) {
        cb();
      }
    },
  };
};

// Mirrors the canvas: react-infinite-viewer echoes programmatic moves through
// its scroll handler, which marks the viewport as interacting before syncing.
const mountEchoingViewport = (editor: Editor) => {
  let current = { x: 0, y: 0, zoom: 1 };
  const echo = () => {
    editor.setViewportInteracting(true);
    editor.setViewport(current);
  };

  (editor as any).viewerRef = {
    getScrollLeft: () => current.x,
    getScrollTop: () => current.y,
    getZoom: () => current.zoom,
    setTo: (next) => {
      current = { ...current, ...next };
      echo();
    },
    setZoom: (zoom) => {
      current = { ...current, zoom };
      echo();
    },
  };
  (editor as any).hostRef = {
    getBoundingClientRect: () => ({
      height: 800,
      left: 0,
      top: 0,
      width: 1200,
    }),
  };
};

describe("programmatic viewport moves", () => {
  test("moving the viewport writes the store and ends the echoed interaction", () => {
    const editor = new Editor();

    mountEchoingViewport(editor);
    editor.moveViewportTo({ x: 120, y: -40, zoom: 0.5 });

    expect(editor.viewportInteracting).toBe(false);
    expect(editor.viewport).toEqual({ x: 120, y: -40, zoom: 0.5 });
    expect(editor.getState().viewport).toEqual({ x: 120, y: -40, zoom: 0.5 });
  });

  test("moving the viewport cancels a pending focus request", () => {
    const raf = installFakeRaf();
    const editor = new Editor();

    mountEchoingViewport(editor);
    editor.loadDocument(
      JSON.stringify({
        nodes: [
          {
            fill: "#000000",
            height: 100,
            id: "shape",
            parentId: "root",
            shape: "polygon",
            stroke: null,
            strokeWidth: 0,
            transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 900, y: 900 },
            type: "shape",
            visible: true,
            width: 100,
          },
        ],
        version: "1.8",
      })
    );
    editor.moveViewportTo({ x: 0, y: 0, zoom: 1 });

    for (let frame = 0; frame < 130; frame += 1) {
      raf.tick();
    }

    expect(editor.getState().viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  test("document-load focus writes its target to the store immediately", () => {
    const raf = installFakeRaf();
    const editor = new Editor();

    mountEchoingViewport(editor);
    editor.loadDocument(
      JSON.stringify({
        nodes: [
          {
            fill: "#000000",
            height: 1200,
            id: "shape",
            parentId: "root",
            shape: "polygon",
            stroke: null,
            strokeWidth: 0,
            transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 600, y: 600 },
            type: "shape",
            visible: true,
            width: 1200,
          },
        ],
        version: "1.8",
      })
    );
    editor.registerNodeElement("shape", {});

    raf.tick();
    raf.tick();

    expect(editor.zoom).toBeLessThan(1);
    expect(editor.viewportInteracting).toBe(false);
    expect(editor.getState().viewport).toEqual(editor.viewport);
  });
});
