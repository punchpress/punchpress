import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createRoundedPolygonShapeNode = () => {
  return {
    cornerRadius: 18,
    fill: "#123456",
    height: 120,
    id: "shape-node",
    parentId: "root",
    points: [
      { x: -100, y: -60 },
      { x: 100, y: -60 },
      { x: 100, y: 60 },
      { x: -100, y: 60 },
    ],
    shape: "polygon",
    stroke: "#abcdef",
    strokeWidth: 6,
    transform: {
      rotation: 22,
      scaleX: 1.25,
      scaleY: 0.85,
      x: 320,
      y: 220,
    },
    type: "shape",
    visible: true,
    width: 200,
  } as const;
};

const hasBezierHandle = (segment) => {
  return (
    Math.hypot(segment.handleIn.x, segment.handleIn.y) > 0 ||
    Math.hypot(segment.handleOut.x, segment.handleOut.y) > 0
  );
};

describe("shape convert to path", () => {
  test("converting a rounded polygon preserves visible path geometry and style", () => {
    const editor = new Editor();
    const node = createRoundedPolygonShapeNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    expect(editor.canConvertShapeToPath(node.id)).toBe(true);

    const didConvert = editor.convertShapeToPath(node.id);
    const pathNode = editor.getNode(node.id);

    expect(didConvert).toBe(true);
    expect(pathNode?.type).toBe("path");

    if (pathNode?.type !== "path") {
      throw new Error("Expected converted path node");
    }

    expect(pathNode).toMatchObject({
      closed: true,
      fill: node.fill,
      fillRule: "nonzero",
      id: node.id,
      parentId: node.parentId,
      stroke: node.stroke,
      strokeWidth: node.strokeWidth,
      transform: node.transform,
      visible: node.visible,
    });
    expect("cornerRadius" in pathNode).toBe(false);
    expect(pathNode.segments).toHaveLength(8);
    expect(pathNode.segments.some(hasBezierHandle)).toBe(true);
    expect(editor.pathEditingNodeId).toBe(null);
    expect(editor.selectedNodeIds).toEqual([node.id]);
  });
});
