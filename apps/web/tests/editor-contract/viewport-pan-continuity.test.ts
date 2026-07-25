import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

describe("viewport pan continuity", () => {
  test("repeated Space keydowns do not flush viewport state during a pan", () => {
    const editor = new Editor({ initialZoom: 1 });
    const OriginalHTMLElement = globalThis.HTMLElement;
    globalThis.HTMLElement = class {} as typeof HTMLElement;

    try {
      editor.setViewportInteracting(true);
      editor.setViewport({ x: 260, y: 180, zoom: 16 });
      editor.handleSpaceDown({
        code: "Space",
        preventDefault: () => undefined,
        target: {},
      });

      editor.setViewportInteracting(true);
      editor.setViewport({ x: 266, y: 184, zoom: 16 });
      editor.handleSpaceDown({
        code: "Space",
        preventDefault: () => undefined,
        repeat: true,
        target: {},
      });

      expect(editor.viewport).toEqual({ x: 266, y: 184, zoom: 16 });
      expect(editor.getState().viewport).toEqual({
        x: 260,
        y: 180,
        zoom: 16,
      });
    } finally {
      globalThis.HTMLElement = OriginalHTMLElement;
    }
  });

  test("settles buffered viewport state before explicit Hand mode renders", () => {
    const editor = new Editor({ initialZoom: 1 });

    editor.setViewportInteracting(true);
    editor.setViewport({ x: 260, y: 180, zoom: 16 });
    editor.setActiveTool("hand");
    editor.setViewportInteracting(true);
    editor.setViewport({ x: 266, y: 184, zoom: 16 });
    editor.setActiveTool("hand");

    expect(editor.activeTool).toBe("hand");
    expect(editor.viewport).toEqual({ x: 266, y: 184, zoom: 16 });
    expect(editor.getState().viewport).toEqual({
      x: 260,
      y: 180,
      zoom: 16,
    });
  });
});
