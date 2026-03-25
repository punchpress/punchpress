import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Editor } from "@punchpress/engine";

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
