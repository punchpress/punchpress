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

const mountFakeViewport = (editor: Editor) => {
  (editor as any).viewerRef = {
    setTo: () => undefined,
    setZoom: () => undefined,
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

const createSquareSegments = () => {
  return [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 120 },
    { x: 0, y: 120 },
  ].map((point) => ({
    handleIn: { x: 0, y: 0 },
    handleOut: { x: 0, y: 0 },
    point,
    pointType: "corner",
  }));
};

const createPathNode = (id: string, parentId: string) => {
  return {
    closed: true,
    fill: "#000000",
    fillRule: "nonzero",
    id,
    parentId,
    segments: createSquareSegments(),
    stroke: null,
    strokeLineCap: "butt",
    strokeLineJoin: "miter",
    strokeMiterLimit: 4,
    strokeWidth: 0,
    transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 320, y: 220 },
    type: "path",
    visible: true,
  };
};

const createContainerNode = (id: string, type: "group" | "vector") => {
  return {
    id,
    name: id,
    parentId: "root",
    transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
    type,
    visible: true,
  };
};

// Fitting the 200x120 square at (320, 220) into a 1200x800 host at zoom 1.
const FOCUSED_VIEWPORT_X = 320 - (1200 - 200) / 2;

describe("document load viewport focus with containers", () => {
  test("focuses a loaded vector without waiting out the readiness fallback", () => {
    const raf = installFakeRaf();
    const editor = new Editor();

    mountFakeViewport(editor);
    editor.loadDocument(
      JSON.stringify({
        nodes: [
          createContainerNode("vector", "vector"),
          createPathNode("vector-path", "vector"),
        ],
        version: "1.8",
      })
    );
    // Vector child paths render through their container's canvas element.
    editor.registerNodeElement("vector", {});

    for (let frame = 0; frame < 5; frame += 1) {
      raf.tick();
    }

    expect(editor.viewport.x).toBeCloseTo(FOCUSED_VIEWPORT_X, 1);
  });

  test("focuses a loaded group once its leaf content is rendered", () => {
    const raf = installFakeRaf();
    const editor = new Editor();

    mountFakeViewport(editor);
    editor.loadDocument(
      JSON.stringify({
        nodes: [
          createContainerNode("group", "group"),
          createPathNode("group-path", "group"),
        ],
        version: "1.8",
      })
    );
    editor.registerNodeElement("group-path", {});

    for (let frame = 0; frame < 5; frame += 1) {
      raf.tick();
    }

    expect(editor.viewport.x).toBeCloseTo(FOCUSED_VIEWPORT_X, 1);
  });
});
