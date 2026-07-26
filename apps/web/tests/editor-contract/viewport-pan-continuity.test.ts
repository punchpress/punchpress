import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

describe("viewport pan continuity", () => {
  test("notifies viewport presentations while document state stays buffered", () => {
    const editor = new Editor({ initialZoom: 1 });
    let presentationUpdates = 0;
    const unsubscribe = editor.subscribeViewportPresentation(() => {
      presentationUpdates += 1;
    });

    editor.setViewportInteracting(true);
    editor.setViewport({ x: 260, y: 180, zoom: 16 });
    editor.setViewport({ x: 266, y: 184, zoom: 16 });
    editor.setViewport({ x: 266, y: 184, zoom: 16 });

    expect(presentationUpdates).toBe(2);
    expect(editor.viewport).toEqual({ x: 266, y: 184, zoom: 16 });
    expect(editor.getState().viewport).toEqual({ x: 0, y: 0, zoom: 1 });

    unsubscribe();
  });

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
