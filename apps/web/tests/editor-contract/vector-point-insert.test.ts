import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createRectangleContour = () => {
  return {
    closed: true,
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
        point: { x: 200, y: 0 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 200, y: 120 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 0, y: 120 },
        pointType: "corner" as const,
      },
    ],
  };
};

describe("vector point insertion", () => {
  test("inserting a vector point persists the new contour geometry and selects the inserted point", () => {
    const editor = new Editor();

    editor.loadDocument(
      JSON.stringify({
        nodes: [
          {
            contours: [createRectangleContour()],
            fill: "#000000",
            fillRule: "nonzero",
            id: "vector-node",
            parentId: "root",
            stroke: null,
            strokeWidth: 0,
            transform: {
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              x: 320,
              y: 220,
            },
            type: "vector",
            visible: true,
          },
        ],
        version: "1.5",
      })
    );

    editor.setPathEditingNodeId("vector-node");

    const didInsert = editor.insertVectorPoint(
      {
        contourIndex: 0,
        segmentIndex: 1,
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 0, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 100, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 200, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 200, y: 120 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 0, y: 120 },
            pointType: "corner",
          },
        ],
      },
      "vector-node"
    );

    const node = editor.getNode("vector-node");
    const segment = node?.type === "vector" ? node.contours[0]?.segments[1] : null;

    expect(didInsert).toBe(true);
    expect(node?.type).toBe("vector");
    expect(node?.type === "vector" ? node.contours[0]?.segments.length : 0).toBe(
      5
    );
    expect(segment?.point).toEqual({ x: 100, y: 0 });
    expect(segment?.handleIn).toEqual({ x: 0, y: 0 });
    expect(segment?.handleOut).toEqual({ x: 0, y: 0 });
    expect(segment?.pointType).toBe("corner");
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
  });
});
