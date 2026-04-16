import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

describe("vector container resize selection", () => {
  test("resizes a selected vector container by scaling its child path", () => {
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

    const beforeContainerFrame = editor.getSelectionTransformFrame([
      "vector-container",
    ]);
    const beforePath = editor.getNode("vector-path");

    expect(beforeContainerFrame).not.toBeNull();
    expect(beforePath?.type).toBe("path");

    const resizedNodeIds = editor.resizeSelectionFromCorner({
      corner: "se",
      scale: 1.25,
    });

    const afterContainerFrame = editor.getSelectionTransformFrame([
      "vector-container",
    ]);
    const afterPath = editor.getNode("vector-path");

    expect(resizedNodeIds).toEqual(["vector-path"]);
    expect(afterContainerFrame).not.toBeNull();
    expect(afterContainerFrame?.bounds.width).toBeGreaterThan(
      beforeContainerFrame?.bounds.width || 0
    );
    expect(afterContainerFrame?.bounds.height).toBeGreaterThan(
      beforeContainerFrame?.bounds.height || 0
    );
    expect(afterPath).toMatchObject({
      transform: {
        scaleX: 1.25,
        scaleY: 1.25,
      },
      type: "path",
    });
  });
});
