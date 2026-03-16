import { describe, expect, test } from "bun:test";
import { Editor } from "../../src/editor/editor";

const ARIAL_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

describe("Editor.moveSelectedNodesBy", () => {
  test("moves a selected text node and its frame by the requested delta", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...ARIAL_FONT, id: "arialmt" }],
      state: "ready",
    });

    editor.addTextNode({ x: 600, y: 450 });
    editor.setEditingText("Move me");
    editor.finalizeEditing();

    const nodeId = editor.selectedNodeId;
    if (!nodeId) {
      throw new Error("Expected a selected node after creating text");
    }

    const beforeDump = editor.getDebugDump();
    const beforeNode = getDebugNode(beforeDump, nodeId);

    const movedNodeIds = editor.moveSelectedNodesBy({ x: 140, y: 80 });

    const afterDump = editor.getDebugDump();
    const afterNode = getDebugNode(afterDump, nodeId);

    expect(movedNodeIds).toEqual([nodeId]);
    expect(afterDump.selection.primaryId).toBe(nodeId);
    expect(afterNode.transform.x - beforeNode.transform.x).toBeCloseTo(140, 6);
    expect(afterNode.transform.y - beforeNode.transform.y).toBeCloseTo(80, 6);
    expect(afterNode.frame?.bounds.minX).toBeCloseTo(
      (beforeNode.frame?.bounds.minX ?? 0) + 140,
      6
    );
    expect(afterNode.frame?.bounds.minY).toBeCloseTo(
      (beforeNode.frame?.bounds.minY ?? 0) + 80,
      6
    );
    expect(afterNode.frame?.bounds.maxX).toBeCloseTo(
      (beforeNode.frame?.bounds.maxX ?? 0) + 140,
      6
    );
    expect(afterNode.frame?.bounds.maxY).toBeCloseTo(
      (beforeNode.frame?.bounds.maxY ?? 0) + 80,
      6
    );
  });
});

const getDebugNode = (dump, nodeId) => {
  const node = dump.nodes.find((item) => item.id === nodeId);

  if (!node) {
    throw new Error(`Missing node ${nodeId} in debug dump`);
  }

  return node;
};
