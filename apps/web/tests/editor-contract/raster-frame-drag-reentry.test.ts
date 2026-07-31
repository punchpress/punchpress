import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultImageNode,
  Editor,
} from "@punchpress/engine";

describe("Frame Raster drag re-entry", () => {
  test("commits one final move and Undo restores the original placement", () => {
    const editor = new Editor();
    const frame = {
      ...createDefaultArtboardNode("Frame"),
      height: 500,
      id: "frame",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 100,
        y: 100,
      },
      width: 500,
    };
    const raster = {
      ...createDefaultImageNode({
        height: 400,
        src: "data:image/png;base64,raster",
        width: 400,
      }),
      id: "raster",
      parentId: frame.id,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 150,
        y: 150,
      },
    };

    editor.getState().loadNodes([frame, raster]);
    editor.select(raster.id);
    editor.resetHistory();

    const originalTransform = editor.getNode(raster.id)?.transform;
    const dragSession = editor.beginSelectionDrag({ nodeIds: [raster.id] });

    if (!dragSession) {
      throw new Error("Expected Raster drag session");
    }

    editor.updateSelectionDrag(dragSession, {
      delta: { x: -300, y: 0 },
    });
    expect(editor.getNode(raster.id)?.transform).toEqual(originalTransform);

    editor.updateSelectionDrag(dragSession, {
      delta: { x: 360, y: 0 },
    });
    expect(editor.getNode(raster.id)?.transform).toEqual(originalTransform);

    expect(editor.endSelectionDrag(dragSession)).toBe(true);
    expect(editor.getNode(raster.id)?.transform).toEqual({
      ...originalTransform,
      x: (originalTransform?.x ?? 0) + 60,
    });
    expect(editor.undo()).toBe(true);
    expect(editor.getNode(raster.id)?.transform).toEqual(originalTransform);
    expect(editor.canUndo).toBe(false);
  });
});
