import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

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
    expect(editor.zoom).toBeCloseTo(1.1, 6);
    expect(afterAnchorX).toBeCloseTo(beforeAnchorX, 6);
    expect(afterAnchorY).toBeCloseTo(beforeAnchorY, 6);
  });
});
