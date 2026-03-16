import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const ARIAL_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

describe("Editor.rotateSelectionBy", () => {
  test("rotates a selected text node around its center", () => {
    const editor = createEditor();
    const nodeId = createTextNode(editor, {
      text: "Rotate me",
      x: 600,
      y: 450,
    });

    const beforeDump = editor.getDebugDump();
    const beforeNode = getDebugNode(beforeDump, nodeId);
    const beforeCenter = getFrameCenter(beforeNode);

    const rotatedNodeIds = editor.rotateSelectionBy({ deltaRotation: 30 });

    const afterDump = editor.getDebugDump();
    const afterNode = getDebugNode(afterDump, nodeId);
    const afterCenter = getFrameCenter(afterNode);

    expect(rotatedNodeIds).toEqual([nodeId]);
    expect(afterDump.selection.primaryId).toBe(nodeId);
    expect(
      afterNode.transform.rotation - beforeNode.transform.rotation
    ).toBeCloseTo(30, 6);
    expect(afterCenter.x).toBeCloseTo(beforeCenter.x, 6);
    expect(afterCenter.y).toBeCloseTo(beforeCenter.y, 6);
  });

  test("rotates a selected group around the shared selection center", () => {
    const editor = createEditor();
    const firstNodeId = createTextNode(editor, {
      text: "Rotate first",
      x: 520,
      y: 320,
    });
    const secondNodeId = createTextNode(editor, {
      text: "Rotate second",
      x: 760,
      y: 520,
    });

    editor.setSelectedNodes([firstNodeId, secondNodeId]);

    const beforeDump = editor.getDebugDump();
    const beforeFirst = getDebugNode(beforeDump, firstNodeId);
    const beforeSecond = getDebugNode(beforeDump, secondNodeId);
    const selectionCenter = getCombinedCenter(beforeFirst, beforeSecond);

    const rotatedNodeIds = editor.rotateSelectionBy({ deltaRotation: 30 });

    const afterDump = editor.getDebugDump();
    const afterFirst = getDebugNode(afterDump, firstNodeId);
    const afterSecond = getDebugNode(afterDump, secondNodeId);
    const rotationDelta =
      afterFirst.transform.rotation - beforeFirst.transform.rotation;

    expect(rotatedNodeIds).toEqual([firstNodeId, secondNodeId]);
    expect(afterDump.selection.ids).toEqual([firstNodeId, secondNodeId]);
    expect(rotationDelta).toBeCloseTo(30, 6);
    expect(
      afterSecond.transform.rotation - beforeSecond.transform.rotation
    ).toBeCloseTo(rotationDelta, 6);

    const expectedFirstCenter = rotatePointAround(
      getFrameCenter(beforeFirst),
      selectionCenter,
      rotationDelta
    );
    const expectedSecondCenter = rotatePointAround(
      getFrameCenter(beforeSecond),
      selectionCenter,
      rotationDelta
    );
    const afterFirstCenter = getFrameCenter(afterFirst);
    const afterSecondCenter = getFrameCenter(afterSecond);

    expect(afterFirstCenter.x).toBeCloseTo(expectedFirstCenter.x, 2);
    expect(afterFirstCenter.y).toBeCloseTo(expectedFirstCenter.y, 2);
    expect(afterSecondCenter.x).toBeCloseTo(expectedSecondCenter.x, 2);
    expect(afterSecondCenter.y).toBeCloseTo(expectedSecondCenter.y, 2);
  });
});

const createEditor = () => {
  const editor = new Editor();

  editor.applyLocalFontCatalog({
    error: "",
    fonts: [{ ...ARIAL_FONT, id: "arialmt" }],
    state: "ready",
  });

  return editor;
};

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

  if (!node.frame) {
    throw new Error(`Missing frame for node ${nodeId} in debug dump`);
  }

  return node;
};

const getFrameCenter = (node) => {
  return {
    x: (node.frame.bounds.minX + node.frame.bounds.maxX) / 2,
    y: (node.frame.bounds.minY + node.frame.bounds.maxY) / 2,
  };
};

const getCombinedCenter = (firstNode, secondNode) => {
  return {
    x:
      (Math.min(firstNode.frame.bounds.minX, secondNode.frame.bounds.minX) +
        Math.max(firstNode.frame.bounds.maxX, secondNode.frame.bounds.maxX)) /
      2,
    y:
      (Math.min(firstNode.frame.bounds.minY, secondNode.frame.bounds.minY) +
        Math.max(firstNode.frame.bounds.maxY, secondNode.frame.bounds.maxY)) /
      2,
  };
};

const rotatePointAround = (point, center, rotation) => {
  const angle = (rotation * Math.PI) / 180;
  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;

  return {
    x: center.x + offsetX * Math.cos(angle) - offsetY * Math.sin(angle),
    y: center.y + offsetX * Math.sin(angle) + offsetY * Math.cos(angle),
  };
};
