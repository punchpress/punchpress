import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createRectanglePath = (
  id: string,
  parentId: string,
  x: number,
  y: number
) => ({
  closed: true,
  fill: "#ffffff",
  fillRule: "nonzero" as const,
  id,
  parentId,
  segments: [
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 0, y: 0 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 120, y: 0 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 120, y: 80 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 0, y: 80 },
      pointType: "corner" as const,
    },
  ],
  stroke: "#000000",
  strokeLineCap: "round" as const,
  strokeLineJoin: "round" as const,
  strokeMiterLimit: 4,
  strokeWidth: 2,
  transform: {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x,
    y,
  },
  type: "path" as const,
  visible: true,
});

const getNodeWorldCenter = (editor: Editor, nodeId: string) => {
  const node = editor.getNode(nodeId);
  const bounds = editor.getNodeTransformBounds(nodeId);

  if (!(node && bounds)) {
    return null;
  }

  return {
    x: node.transform.x + (bounds.minX + bounds.maxX) / 2,
    y: node.transform.y + (bounds.minY + bounds.maxY) / 2,
  };
};

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

  test("scales a selected compound vector in place without drifting child paths", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "vector-container",
        name: "Vector",
        parentId: "root",
        pathComposition: "compound-fill",
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
      createRectanglePath("outer-path", "vector-container", 200, 160),
      createRectanglePath("inner-path", "vector-container", 320, 240),
    ]);

    editor.select("vector-container");

    const beforeFrame = editor.getSelectionTransformFrame(["vector-container"]);
    const beforeOuterCenter = getNodeWorldCenter(editor, "outer-path");
    const beforeInnerCenter = getNodeWorldCenter(editor, "inner-path");

    expect(beforeFrame).not.toBeNull();
    expect(beforeOuterCenter).not.toBeNull();
    expect(beforeInnerCenter).not.toBeNull();

    const resizedNodeIds = editor.resizeSelectionFromCorner({
      corner: "se",
      scale: 0.5,
    });

    const afterFrame = editor.getSelectionTransformFrame(["vector-container"]);
    const afterOuterCenter = getNodeWorldCenter(editor, "outer-path");
    const afterInnerCenter = getNodeWorldCenter(editor, "inner-path");
    const anchor = {
      x: beforeFrame?.bounds.minX || 0,
      y: beforeFrame?.bounds.minY || 0,
    };

    expect(resizedNodeIds).toEqual(["outer-path", "inner-path"]);
    expect(afterFrame).not.toBeNull();
    expect(afterFrame?.bounds.minX).toBeCloseTo(anchor.x, 2);
    expect(afterFrame?.bounds.minY).toBeCloseTo(anchor.y, 2);
    expect(afterFrame?.bounds.width).toBeCloseTo(
      (beforeFrame?.bounds.width || 0) * 0.5,
      2
    );
    expect(afterFrame?.bounds.height).toBeCloseTo(
      (beforeFrame?.bounds.height || 0) * 0.5,
      2
    );
    expect(afterOuterCenter?.x).toBeCloseTo(
      anchor.x + ((beforeOuterCenter?.x || 0) - anchor.x) * 0.5,
      2
    );
    expect(afterOuterCenter?.y).toBeCloseTo(
      anchor.y + ((beforeOuterCenter?.y || 0) - anchor.y) * 0.5,
      2
    );
    expect(afterInnerCenter?.x).toBeCloseTo(
      anchor.x + ((beforeInnerCenter?.x || 0) - anchor.x) * 0.5,
      2
    );
    expect(afterInnerCenter?.y).toBeCloseTo(
      anchor.y + ((beforeInnerCenter?.y || 0) - anchor.y) * 0.5,
      2
    );
  });
});
