import { describe, expect, test } from "bun:test";
import { Editor, getNodeWorldPoint } from "@punchpress/engine";

describe("shape box resize", () => {
  test("resizes a shape from the east edge without changing its height", () => {
    const editor = new Editor();

    editor.addShapeNode({ x: 400, y: 300 }, "polygon");

    const nodeId = editor.selectedNodeId;
    const node = nodeId ? editor.getNode(nodeId) : null;
    const bounds = nodeId ? editor.getNodeTransformBounds(nodeId) : null;

    if (!(nodeId && node && bounds)) {
      throw new Error("Expected a selected shape node");
    }

    const before = {
      height: node.height,
      width: node.width,
      x: node.transform.x,
      y: node.transform.y,
    };

    const anchorCanvas = getNodeWorldPoint(node, bounds, {
      x: bounds.minX,
      y: 0,
    });
    const startEast = getNodeWorldPoint(node, bounds, {
      x: bounds.maxX,
      y: 0,
    });
    const resizeSession = editor.beginResizeSelection({
      anchorCanvas,
      handle: "e",
      nodeId,
    });

    const resizedNodeIds = editor.updateResizeSelection(resizeSession, {
      pointCanvas: {
        x: startEast.x + 120,
        y: startEast.y,
      },
    });
    const resizedNode = editor.getNode(nodeId);

    expect(resizedNodeIds).toEqual([nodeId]);
    expect(resizedNode?.type).toBe("shape");
    expect(resizedNode?.width).toBeGreaterThan(before.width + 100);
    expect(resizedNode?.height).toBeCloseTo(before.height, 2);
    expect(resizedNode?.transform.x).toBeCloseTo(before.x + 60, 1);
    expect(resizedNode?.transform.y).toBeCloseTo(before.y, 2);
  });
});
