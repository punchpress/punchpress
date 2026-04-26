import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createPathNode = () => {
  return {
    closed: true,
    fill: "#ffffff",
    fillRule: "nonzero" as const,
    id: "vector-node",
    parentId: "root",
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -120, y: -90 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 120, y: -90 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 120, y: 90 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -120, y: 90 },
        pointType: "corner" as const,
      },
    ],
    stroke: "#000000",
    strokeWidth: 12,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 320,
      y: 220,
    },
    type: "path" as const,
    visible: true,
  };
};

describe("vector point convert selection", () => {
  test("setPathPointType converts every selected vector anchor", () => {
    const editor = new Editor();
    const node = createPathNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoints([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
    ]);

    expect(editor.setPathPointType("smooth", node.id)).toBe(true);

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "path") {
      throw new Error("Expected the path node to remain after conversion.");
    }

    expect(nextNode.segments[0]?.pointType).toBe("smooth");
    expect(nextNode.segments[1]?.pointType).toBe("smooth");
    expect(nextNode.segments[2]?.pointType).toBe("corner");
    expect(editor.pathEditingPoints).toEqual([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
    ]);
  });

  test("setPathPointType collapses every selected smooth anchor back to corner", () => {
    const editor = new Editor();
    const node = createPathNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoints([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
    ]);
    editor.setPathPointType("smooth", node.id);

    expect(editor.setPathPointType("corner", node.id)).toBe(true);

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "path") {
      throw new Error("Expected the path node to remain after conversion.");
    }

    expect(nextNode.segments[0]).toMatchObject({
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      pointType: "corner",
    });
    expect(nextNode.segments[1]).toMatchObject({
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      pointType: "corner",
    });
  });
});
