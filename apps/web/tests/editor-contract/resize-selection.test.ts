import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createDefaultImageNode, Editor } from "@punchpress/engine";

const ARIAL_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

const SCALED_TEXT_DOCUMENT = readFileSync(
  new URL("../e2e/fixtures/documents/scaled-text-node.punch", import.meta.url),
  "utf8"
);

describe("Editor.resizeSelectionFromCorner", () => {
  test("resizes a selected shape through the public corner resize command", () => {
    const editor = new Editor();

    editor.addShapeNode({ x: 400, y: 300 }, "polygon");
    const nodeId = editor.selectedNodeId;
    const beforeNode = nodeId ? editor.getNode(nodeId) : null;

    if (!(nodeId && beforeNode?.type === "shape")) {
      throw new Error("Expected a selected shape node");
    }

    const resizedNodeIds = editor.resizeSelectionFromCorner({
      corner: "se",
      scale: 1.5,
    });
    const afterNode = editor.getNode(nodeId);

    expect(resizedNodeIds).toEqual([nodeId]);
    expect(afterNode?.type).toBe("shape");
    expect(afterNode?.width).toBeGreaterThan(beforeNode.width);
    expect(afterNode?.height).toBeGreaterThan(beforeNode.height);
  });

  test("resizes a selected image through the public corner resize command", () => {
    const editor = new Editor();
    const imageNode = {
      ...createDefaultImageNode({
        height: 180,
        name: "Dropped image",
        src: "data:image/png;base64,test",
        width: 240,
      }),
      id: "image-node",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 320,
        y: 240,
      },
    };

    editor.getState().loadNodes([imageNode]);
    editor.select("image-node");

    const beforeNode = editor.getNode("image-node");
    const beforeFrame = editor.getNodeTransformFrame("image-node");
    const fixedCornerBefore = beforeFrame
      ? { x: beforeFrame.bounds.minX, y: beforeFrame.bounds.minY }
      : null;
    const resizedNodeIds = editor.resizeSelectionFromCorner({
      corner: "se",
      scale: 1.5,
    });
    const afterNode = editor.getNode("image-node");
    const afterFrame = editor.getNodeTransformFrame("image-node");

    expect(resizedNodeIds).toEqual(["image-node"]);
    expect(afterNode?.type).toBe("image");
    expect(afterNode?.width).toBeCloseTo((beforeNode?.width || 0) * 1.5, 2);
    expect(afterNode?.height).toBeCloseTo((beforeNode?.height || 0) * 1.5, 2);
    expect(afterFrame?.bounds.width).toBeCloseTo(
      (beforeFrame?.bounds.width || 0) * 1.5,
      2
    );
    expect(afterFrame?.bounds.height).toBeCloseTo(
      (beforeFrame?.bounds.height || 0) * 1.5,
      2
    );
    expect(afterFrame?.bounds.minX).toBeCloseTo(fixedCornerBefore?.x || 0, 2);
    expect(afterFrame?.bounds.minY).toBeCloseTo(fixedCornerBefore?.y || 0, 2);
  });

  test("scales retained Raster content on resize while Crop only changes visible bounds", () => {
    const editor = new Editor();
    const imageNode = {
      ...createDefaultImageNode({
        height: 180,
        name: "Dropped image",
        src: "data:image/png;base64,test",
        width: 240,
      }),
      id: "image-node",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 320,
        y: 240,
      },
    };

    editor.getState().loadNodes([imageNode]);
    editor.select(imageNode.id);
    editor.resizeSelectionFromCorner({ corner: "se", scale: 0.5 });

    const resized = editor.getNode(imageNode.id);
    expect(resized).toMatchObject({
      baseHeight: 90,
      baseWidth: 120,
      baseX: 0,
      baseY: 0,
      height: 90,
      width: 120,
    });

    expect(editor.startCrop()).toBe(true);
    editor.updateCrop({ height: 60, width: 80, x: 20, y: 10 });
    expect(editor.commitCrop()).toBe(true);

    expect(editor.getNode(imageNode.id)).toMatchObject({
      baseHeight: 90,
      baseWidth: 120,
      baseX: -20,
      baseY: -10,
      height: 60,
      width: 80,
    });
  });

  test("previews shape box resize without rewriting width and height until commit", () => {
    const editor = new Editor();

    editor.addShapeNode({ x: 400, y: 300 }, "polygon");
    const nodeId = editor.selectedNodeId;
    const beforeNode = nodeId ? editor.getNode(nodeId) : null;
    const beforeFrame = nodeId ? editor.getNodeTransformFrame(nodeId) : null;

    if (!(nodeId && beforeNode?.type === "shape" && beforeFrame)) {
      throw new Error("Expected a selected shape node");
    }

    const resizeSession = editor.beginResizeSelection({
      anchorCanvas: {
        x: beforeFrame.bounds.minX,
        y: beforeFrame.bounds.minY,
      },
      handle: "se",
      nodeId,
    });

    const previewedNodeIds = editor.updateResizeSelection(resizeSession, {
      pointCanvas: {
        x: beforeFrame.bounds.maxX + 120,
        y: beforeFrame.bounds.maxY + 80,
      },
      preview: true,
    });
    const previewNode = editor.getNode(nodeId);

    expect(previewedNodeIds).toEqual([nodeId]);
    expect(previewNode?.width).toBe(beforeNode.width);
    expect(previewNode?.height).toBe(beforeNode.height);
    expect(editor.selectionDragPreview?.resize?.transformFrame).not.toBeNull();

    const committedNodeIds = editor.commitResizeSelection(resizeSession);
    const committedNode = editor.getNode(nodeId);

    expect(committedNodeIds).toEqual([nodeId]);
    expect(editor.selectionDragPreview).toBeNull();
    expect(committedNode?.width).toBeGreaterThan(beforeNode.width);
    expect(committedNode?.height).toBeGreaterThan(beforeNode.height);
  });

  test("keeps the opposite corner anchored for a loaded scaled node", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...ARIAL_FONT, id: "arialmt" }],
      state: "ready",
    });
    editor.loadDocument(SCALED_TEXT_DOCUMENT);
    editor.select("scaled-node");

    const beforeDump = editor.getDebugDump();
    const beforeNode = getDebugNode(beforeDump, "scaled-node");
    const fixedCornerBefore = getNodeCorner(beforeNode, "nw");

    const resizeSession = editor.beginResizeSelection({
      anchorCanvas: fixedCornerBefore,
      direction: [1, 1],
      nodeId: "scaled-node",
    });
    const resizedNodeIds = editor.updateResizeSelection(resizeSession, {
      scale: 1.2,
    });

    const afterDump = editor.getDebugDump();
    const afterNode = getDebugNode(afterDump, "scaled-node");
    const fixedCornerAfter = getNodeCorner(afterNode, "nw");

    expect(resizedNodeIds).toEqual(["scaled-node"]);
    expect(afterDump.selection.primaryId).toBe("scaled-node");
    expect(afterNode.fontSize).toBeGreaterThan(beforeNode.fontSize);
    expect(afterNode.transform.rotation).toBe(beforeNode.transform.rotation);
    expect(fixedCornerAfter.x).toBeCloseTo(fixedCornerBefore.x, 1);
    expect(fixedCornerAfter.y).toBeCloseTo(fixedCornerBefore.y, 1);
  });

  test("keeps the opposite group anchor fixed when resizing from the lower-left corner", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...ARIAL_FONT, id: "arialmt" }],
      state: "ready",
    });

    const firstNodeId = createTextNode(editor, {
      text: "Top right anchor",
      x: 780,
      y: 260,
    });
    const secondNodeId = createTextNode(editor, {
      text: "Bottom left",
      x: 560,
      y: 540,
    });

    editor.setSelectedNodes([firstNodeId, secondNodeId]);

    const beforeDump = editor.getDebugDump();
    const beforeBounds = beforeDump.selection.bounds;

    const resizedNodeIds = editor.resizeSelectionFromCorner({
      corner: "sw",
      scale: 1.2,
    });

    const afterDump = editor.getDebugDump();
    const afterBounds = afterDump.selection.bounds;

    expect(resizedNodeIds).toEqual([firstNodeId, secondNodeId]);
    expect(afterBounds?.minX).toBeLessThan(beforeBounds?.minX ?? 0);
    expect(afterBounds?.maxY).toBeGreaterThan(beforeBounds?.maxY ?? 0);
    expect(afterBounds?.maxX).toBeCloseTo(beforeBounds?.maxX ?? 0, 1);
    expect(afterBounds?.minY).toBeCloseTo(beforeBounds?.minY ?? 0, 1);
  });

  test("previews selected group resize before committing child geometry", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "group",
        name: "Group",
        parentId: "root",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "group",
        visible: true,
      },
      createRectanglePath("first-path", "group", 200, 160),
      createRectanglePath("second-path", "group", 360, 260),
    ]);
    editor.select("group");

    expect(editor.getNodeResizeMode("group")).toBe("children");
    expect(editor.getNodeResizeMode("first-path")).toBe("scale");

    const beforeFrame = editor.getSelectionTransformFrame(["group"]);
    const beforeFirstPath = editor.getNode("first-path");
    const beforeSecondPath = editor.getNode("second-path");

    expect(beforeFrame).not.toBeNull();

    const resizeSession = editor.beginResizeSelection({
      anchorCanvas: {
        x: beforeFrame?.bounds.minX || 0,
        y: beforeFrame?.bounds.minY || 0,
      },
      nodeIds: ["group"],
    });

    const previewedNodeIds = editor.updateResizeSelection(resizeSession, {
      scale: 1.4,
    });
    const previewFirstPath = editor.getNode("first-path");
    const previewSecondPath = editor.getNode("second-path");

    expect(previewedNodeIds).toEqual(["group"]);
    expect(previewFirstPath?.transform.scaleX).toBe(
      beforeFirstPath?.transform.scaleX
    );
    expect(previewSecondPath?.transform.scaleX).toBe(
      beforeSecondPath?.transform.scaleX
    );
    expect(editor.selectionDragPreview?.resize?.scale).toBe(1.4);

    const committedNodeIds = editor.commitResizeSelection(resizeSession);
    const committedFirstPath = editor.getNode("first-path");
    const committedSecondPath = editor.getNode("second-path");

    expect(committedNodeIds).toEqual(["first-path", "second-path"]);
    expect(editor.selectionDragPreview).toBeNull();
    expect(committedFirstPath?.transform.scaleX).toBeCloseTo(1.4, 6);
    expect(committedSecondPath?.transform.scaleX).toBeCloseTo(1.4, 6);
  });

  test("keeps selected group frame rotated after resizing rotated descendants", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "group",
        name: "Group",
        parentId: "root",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "group",
        visible: true,
      },
      createRectanglePath("first-path", "group", 200, 160),
      createRectanglePath("second-path", "group", 360, 260),
    ]);
    editor.select("group");

    const rotateSession = editor.beginRotateSelection({ nodeIds: ["group"] });

    editor.updateRotateSelection(rotateSession, { deltaRotation: 30 });
    editor.commitRotateSelection(rotateSession);

    const beforeFrame = editor.getSelectionTransformFrame(["group"]);

    expect(beforeFrame?.transform).toBe("rotate(30deg)");

    const resizedNodeIds = editor.resizeSelectionFromCorner({
      corner: "se",
      scale: 1.25,
    });
    const afterFrame = editor.getSelectionTransformFrame(["group"]);

    expect(resizedNodeIds).toEqual(["first-path", "second-path"]);
    expect(afterFrame?.transform).toBe("rotate(30deg)");
  });
});

const createTextNode = (editor, { text, x, y }) => {
  editor.addTextNode({ x, y });
  editor.setEditingText(text);
  editor.finalizeEditing();

  if (!editor.selectedNodeId) {
    throw new Error("Expected a selected node after creating text");
  }

  return editor.selectedNodeId;
};

const createRectanglePath = (id, parentId, x, y) => ({
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

const getDebugNode = (dump, nodeId) => {
  const node = dump.nodes.find((item) => item.id === nodeId);

  if (!node) {
    throw new Error(`Missing node ${nodeId} in debug dump`);
  }

  if (!node.renderFrame) {
    throw new Error(`Missing render frame for node ${nodeId} in debug dump`);
  }

  return node;
};

const getNodeCorner = (node, corner) => {
  const localBounds = {
    maxX: node.renderFrame.bounds.maxX - node.transform.x,
    maxY: node.renderFrame.bounds.maxY - node.transform.y,
    minX: node.renderFrame.bounds.minX - node.transform.x,
    minY: node.renderFrame.bounds.minY - node.transform.y,
  };
  const center = {
    x: (localBounds.minX + localBounds.maxX) / 2,
    y: (localBounds.minY + localBounds.maxY) / 2,
  };
  const point = {
    x: corner.endsWith("e") ? localBounds.maxX : localBounds.minX,
    y: corner.startsWith("s") ? localBounds.maxY : localBounds.minY,
  };
  const offset = {
    x: (point.x - center.x) * node.transform.scaleX,
    y: (point.y - center.y) * node.transform.scaleY,
  };
  const angle = (node.transform.rotation * Math.PI) / 180;

  return {
    x:
      node.transform.x +
      center.x +
      offset.x * Math.cos(angle) -
      offset.y * Math.sin(angle),
    y:
      node.transform.y +
      center.y +
      offset.x * Math.sin(angle) +
      offset.y * Math.cos(angle),
  };
};
