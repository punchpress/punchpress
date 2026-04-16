import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

describe("vector container drag preview", () => {
  test("applies preview delta once to a selected vector container transform frame", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "vector-container",
        name: "Vector",
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "vector",
        visible: true,
      },
      {
        closed: true,
        fill: "#ffffff",
        fillRule: "nonzero",
        id: "vector-path",
        parentId: "vector-container",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 0, y: 20 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 110, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 140, y: 90 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 40, y: 120 },
            pointType: "corner",
          },
        ],
        stroke: "#000000",
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 3,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 280,
          y: 220,
        },
        type: "path",
        visible: true,
      },
    ]);

    editor.select("vector-container");

    const before = editor.getSelectionTransformFrame(["vector-container"]);
    const dragSession = editor.beginSelectionDrag({
      nodeIds: ["vector-container"],
    });

    expect(before).not.toBeNull();
    expect(dragSession).not.toBeNull();

    editor.updateSelectionDrag(dragSession, {
      delta: {
        x: 10,
        y: 15,
      },
    });

    const after = editor.getSelectionTransformFrame(["vector-container"]);

    expect(after).not.toBeNull();
    expect(after?.bounds.minX).toBe((before?.bounds.minX || 0) + 10);
    expect(after?.bounds.maxX).toBe((before?.bounds.maxX || 0) + 10);
    expect(after?.bounds.minY).toBe((before?.bounds.minY || 0) + 15);
    expect(after?.bounds.maxY).toBe((before?.bounds.maxY || 0) + 15);
  });
});
