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

const createPathDocument = () => {
  return {
    nodes: [
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
        type: "vector" as const,
        visible: true,
      },
      {
        closed: true,
        fill: "#000000",
        fillRule: "nonzero" as const,
        id: "vector-node",
        parentId: "vector-container",
        segments: createRectangleContour().segments,
        stroke: null,
        strokeLineCap: "butt",
        strokeLineJoin: "miter",
        strokeMiterLimit: 4,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 320,
          y: 220,
        },
        type: "path" as const,
        visible: true,
      },
    ],
    version: "1.7",
  };
};

describe("vector point insertion", () => {
  test("inserting a vector point persists the new contour geometry and selects the inserted point", () => {
    const editor = new Editor();

    editor.loadDocument(
      JSON.stringify(createPathDocument())
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
    const segment = node?.type === "path" ? node.segments[1] : null;

    expect(didInsert).toBe(true);
    expect(node?.type).toBe("path");
    expect(node?.type === "path" ? node.segments.length : 0).toBe(5);
    expect(segment?.point).toEqual({ x: 100, y: 0 });
    expect(segment?.handleIn).toEqual({ x: 0, y: 0 });
    expect(segment?.handleOut).toEqual({ x: 0, y: 0 });
    expect(segment?.pointType).toBe("corner");
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
  });

  test("inserting a point on a straight segment does not invent a live corner radius", () => {
    const editor = new Editor();

    editor.loadDocument(
      JSON.stringify(createPathDocument())
    );

    editor.setPathEditingNodeId("vector-node");

    editor.insertVectorPoint(
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
    const segment = node?.type === "path" ? node.segments[1] : null;

    expect(node?.type === "path" ? node.segments.length : 0).toBe(5);
    expect(segment ? Object.hasOwn(segment, "cornerRadius") : false).toBe(
      false
    );
    expect(
      editor.getPathPointCornerRadius("vector-node", {
        contourIndex: 0,
        segmentIndex: 1,
      })
    ).toBe(0);
  });
});
