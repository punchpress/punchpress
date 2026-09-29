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

  test("continues resizing when a corner crosses its opposite anchor", () => {
    const editor = new Editor();

    editor.addShapeNode({ x: 797.5, y: 580 }, "ellipse");
    const nodeId = editor.selectedNodeId;

    if (!nodeId) {
      throw new Error("Expected a selected shape node");
    }

    editor.updateNode(nodeId, {
      height: 80,
      width: 115,
    });

    const node = editor.getNode(nodeId);
    const bounds = editor.getNodeTransformBounds(nodeId);

    if (!(node?.type === "shape" && bounds)) {
      throw new Error("Expected a selected shape node");
    }

    const before = {
      height: node.height,
      transform: { ...node.transform },
      width: node.width,
    };
    const anchorCanvas = getNodeWorldPoint(node, bounds, {
      x: bounds.minX,
      y: bounds.minY,
    });
    const resizeSession = editor.beginResizeSelection({
      anchorCanvas,
      handle: "se",
      nodeId,
    });

    const previewedNodeIds = editor.updateResizeSelection(resizeSession, {
      pointCanvas: { x: 700, y: 515 },
      preview: true,
    });

    expect(previewedNodeIds).toEqual([nodeId]);
    expect(editor.getNode(nodeId)).toMatchObject(before);

    const committedNodeIds = editor.commitResizeSelection(resizeSession);
    const resizedNode = editor.getNode(nodeId);

    expect(committedNodeIds).toEqual([nodeId]);
    expect(resizedNode?.type).toBe("shape");
    expect(resizedNode?.width).toBeCloseTo(40, 2);
    expect(resizedNode?.height).toBeCloseTo(25, 2);
    expect(resizedNode?.transform.x).toBeCloseTo(720, 2);
    expect(resizedNode?.transform.y).toBeCloseTo(527.5, 2);

    expect(editor.undo()).toBe(true);
    expect(editor.getNode(nodeId)).toMatchObject(before);
    expect(editor.redo()).toBe(true);
    expect(editor.getNode(nodeId)).toMatchObject({
      height: 25,
      transform: {
        x: 720,
        y: 527.5,
      },
      width: 40,
    });
  });

  test("keeps a rotated shape anchored while its corner crosses", () => {
    const editor = new Editor();

    editor.addShapeNode({ x: 797.5, y: 580 }, "ellipse");
    const nodeId = editor.selectedNodeId;

    if (!nodeId) {
      throw new Error("Expected a selected shape node");
    }

    editor.updateNode(nodeId, {
      height: 80,
      transform: { rotation: 30 },
      width: 115,
    });

    const node = editor.getNode(nodeId);
    const bounds = editor.getNodeTransformBounds(nodeId);

    if (!(node?.type === "shape" && bounds)) {
      throw new Error("Expected a selected shape node");
    }

    const anchorCanvas = getNodeWorldPoint(node, bounds, {
      x: bounds.minX,
      y: bounds.minY,
    });
    const crossingPoint = getNodeWorldPoint(node, bounds, {
      x: bounds.minX - 40,
      y: bounds.minY - 25,
    });
    const resizeSession = editor.beginResizeSelection({
      anchorCanvas,
      handle: "se",
      nodeId,
    });

    editor.updateResizeSelection(resizeSession, {
      pointCanvas: crossingPoint,
      preserveAspectRatio: true,
      preview: true,
    });
    editor.commitResizeSelection(resizeSession);

    const resizedNode = editor.getNode(nodeId);
    const resizedBounds = editor.getNodeTransformBounds(nodeId);

    if (!(resizedNode?.type === "shape" && resizedBounds)) {
      throw new Error("Expected a resized shape node");
    }

    const fixedCornerAfter = getNodeWorldPoint(resizedNode, resizedBounds, {
      x: resizedBounds.maxX,
      y: resizedBounds.maxY,
    });

    expect(resizedNode.width).toBeCloseTo(40, 2);
    expect(resizedNode.height).toBeCloseTo(27.83, 2);
    expect(resizedNode.transform.rotation).toBe(30);
    expect(fixedCornerAfter.x).toBeCloseTo(anchorCanvas.x, 2);
    expect(fixedCornerAfter.y).toBeCloseTo(anchorCanvas.y, 2);
  });
});
