import { describe, expect, test } from "bun:test";
import { Editor, MAX_ZOOM } from "@punchpress/engine";

describe("Editor.zoomViewportFromWheel", () => {
  test("clamps oversized wheel zoom and keeps the cursor anchored to the same page point", () => {
    const editor = new Editor({ initialZoom: 1 });
    const viewerRect = {
      bottom: 360,
      height: 300,
      left: 100,
      right: 500,
      top: 60,
      width: 400,
      x: 100,
      y: 60,
    };
    let nextViewport: { x: number; y: number; zoom: number } | null = null;

    editor.viewerRef = {
      getContainer: () => ({
        getBoundingClientRect: () => viewerRect,
      }),
      getScrollLeft: () => 320,
      getScrollTop: () => 180,
      setTo: (options) => {
        nextViewport = options;
      },
    };
    editor.hostRef = {
      getBoundingClientRect: () => ({
        bottom: 760,
        height: 700,
        left: 0,
        right: 900,
        top: 0,
        width: 900,
        x: 0,
        y: 0,
      }),
    };

    const didZoom = editor.zoomViewportFromWheel({
      clientX: 360,
      clientY: 210,
      deltaY: -2000,
    });

    if (!nextViewport) {
      throw new Error("Expected viewer.setTo to be called");
    }

    const localX = 260;
    const localY = 150;
    const beforeAnchorX = 320 + localX / 1;
    const beforeAnchorY = 180 + localY / 1;
    const afterAnchorX = nextViewport.x + localX / nextViewport.zoom;
    const afterAnchorY = nextViewport.y + localY / nextViewport.zoom;

    expect(didZoom).toBe(true);
    expect(nextViewport.zoom).toBeCloseTo(1.1, 6);
    expect(editor.viewport.x).toBeCloseTo(nextViewport.x, 6);
    expect(editor.viewport.y).toBeCloseTo(nextViewport.y, 6);
    expect(editor.zoom).toBeCloseTo(1.1, 6);
    expect(afterAnchorX).toBeCloseTo(beforeAnchorX, 6);
    expect(afterAnchorY).toBeCloseTo(beforeAnchorY, 6);
  });

  test("allows wheel zooming out to one percent", () => {
    const editor = new Editor({ initialZoom: 0.011 });
    let nextViewport: { x: number; y: number; zoom: number } | null = null;

    editor.viewerRef = {
      getContainer: () => ({
        getBoundingClientRect: () => ({
          height: 300,
          left: 0,
          top: 0,
          width: 400,
        }),
      }),
      getScrollLeft: () => 0,
      getScrollTop: () => 0,
      setTo: (options) => {
        nextViewport = options;
      },
    };

    const didZoom = editor.zoomViewportFromWheel({
      clientX: 200,
      clientY: 150,
      deltaY: 2000,
    });

    expect(didZoom).toBe(true);
    expect(nextViewport?.zoom).toBe(0.01);
    expect(editor.zoom).toBe(0.01);
  });

  test("clamps at 12,800 percent without moving the pointer anchor", () => {
    const editor = new Editor({ initialZoom: 127 });
    let nextViewport: { x: number; y: number; zoom: number } | null = null;

    editor.viewerRef = {
      getContainer: () => ({
        getBoundingClientRect: () => ({
          height: 640,
          left: 80,
          top: 40,
          width: 960,
        }),
      }),
      getScrollLeft: () => 4100.125,
      getScrollTop: () => 2700.75,
      setTo: (options) => {
        nextViewport = options;
      },
    };

    const didZoom = editor.zoomViewportFromWheel({
      clientX: 713.25,
      clientY: 427.75,
      deltaY: -2000,
    });

    if (!nextViewport) {
      throw new Error("Expected viewer.setTo to be called");
    }

    const localX = 713.25 - 80;
    const localY = 427.75 - 40;
    const before = {
      x: 4100.125 + localX / 127,
      y: 2700.75 + localY / 127,
    };
    const after = {
      x: nextViewport.x + localX / nextViewport.zoom,
      y: nextViewport.y + localY / nextViewport.zoom,
    };

    expect(MAX_ZOOM).toBe(128);
    expect(didZoom).toBe(true);
    expect(nextViewport.zoom).toBe(MAX_ZOOM);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });
});
