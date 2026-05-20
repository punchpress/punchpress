import { afterEach, describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const globalWithWindow = globalThis as typeof globalThis & {
  window?: {
    cancelAnimationFrame: (id: number) => void;
    requestAnimationFrame: (callback: FrameRequestCallback) => number;
  };
};

const originalWindow = globalWithWindow.window;

const installAnimationFrameWindow = () => {
  let nextFrameId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();

  globalWithWindow.window = {
    cancelAnimationFrame: (id) => {
      callbacks.delete(id);
    },
    requestAnimationFrame: (callback) => {
      const id = nextFrameId;
      nextFrameId += 1;
      callbacks.set(id, callback);
      return id;
    },
  };

  return {
    flushNextFrame: () => {
      const next = callbacks.entries().next().value;

      if (!next) {
        return false;
      }

      const [id, callback] = next;
      callbacks.delete(id);
      callback(performance.now());
      return true;
    },
  };
};

afterEach(() => {
  globalWithWindow.window = originalWindow;
});

describe("Editor.scheduleViewportFocus", () => {
  test("fits an artboard as soon as the canvas viewport exists", () => {
    const animationFrames = installAnimationFrameWindow();
    const editor = new Editor();
    let nextViewport: { x: number; y: number; zoom: number } | null = null;

    let artboardId: string | null = null;
    editor.run(() => {
      artboardId = editor.getState().addArtboardNode({ x: 0, y: 0 });
    });

    if (!artboardId) {
      throw new Error("Expected artboard to be created");
    }

    editor.scheduleViewportFocus([artboardId]);
    animationFrames.flushNextFrame();
    expect(nextViewport).toBeNull();

    editor.viewerRef = {
      setTo: (options) => {
        nextViewport = options;
      },
    };
    editor.hostRef = {
      getBoundingClientRect: () => ({
        height: 900,
        width: 1200,
      }),
    };

    animationFrames.flushNextFrame();

    expect(nextViewport).not.toBeNull();
    expect(nextViewport?.zoom).toBeCloseTo(0.1573, 3);
    expect(editor.viewport.x).toBeCloseTo(nextViewport?.x || 0, 6);
    expect(editor.viewport.y).toBeCloseTo(nextViewport?.y || 0, 6);
    expect(editor.viewport.zoom).toBeCloseTo(nextViewport?.zoom || 0, 6);
  });

  test("honors scheduled focus padding", () => {
    const animationFrames = installAnimationFrameWindow();
    const editor = new Editor();
    let nextViewport: { x: number; y: number; zoom: number } | null = null;

    let artboardId: string | null = null;
    editor.run(() => {
      artboardId = editor.getState().addArtboardNode({ x: 0, y: 0 });
    });

    if (!artboardId) {
      throw new Error("Expected artboard to be created");
    }

    editor.viewerRef = {
      setTo: (options) => {
        nextViewport = options;
      },
    };
    editor.hostRef = {
      getBoundingClientRect: () => ({
        height: 900,
        width: 1200,
      }),
    };

    editor.scheduleViewportFocus([artboardId], {
      paddingX: 450,
      paddingY: 540,
    });
    animationFrames.flushNextFrame();

    expect(nextViewport?.zoom).toBeCloseTo(0.1389, 3);
  });
});
