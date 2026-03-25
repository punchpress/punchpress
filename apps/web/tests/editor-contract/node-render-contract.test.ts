import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const ARIAL_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

describe("Editor node render contract", () => {
  test("keeps the render frame stable during drag preview and commits it on drag end", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...ARIAL_FONT, id: "arialmt" }],
      state: "ready",
    });

    editor.addTextNode({ x: 600, y: 450 });
    editor.setEditingText("Preview me");
    editor.finalizeEditing();

    const nodeId = editor.selectedNodeId;
    if (!nodeId) {
      throw new Error("Expected a selected node after creating text");
    }

    const beforeDump = editor.getDebugDump();
    const beforeNode = getDebugNode(beforeDump, nodeId);
    const dragSession = editor.beginSelectionDrag({ nodeIds: [nodeId] });

    if (!dragSession) {
      throw new Error("Expected a drag session");
    }

    editor.updateSelectionDrag(dragSession, {
      delta: {
        x: 120,
        y: 70,
      },
    });

    const previewDump = editor.getDebugDump();
    const previewNode = getDebugNode(previewDump, nodeId);

    expect(previewDump.selection.previewDelta).toEqual({ x: 120, y: 70 });
    expect(previewNode.transform.x).toBeCloseTo(beforeNode.transform.x, 6);
    expect(previewNode.transform.y).toBeCloseTo(beforeNode.transform.y, 6);
    expect(previewNode.renderFrame?.bounds.minX).toBeCloseTo(
      beforeNode.renderFrame?.bounds.minX ?? 0,
      6
    );
    expect(previewNode.renderFrame?.bounds.minY).toBeCloseTo(
      beforeNode.renderFrame?.bounds.minY ?? 0,
      6
    );
    expect(previewDump.selection.bounds?.minX).toBeCloseTo(
      (beforeDump.selection.bounds?.minX ?? 0) + 120,
      6
    );
    expect(previewDump.selection.bounds?.minY).toBeCloseTo(
      (beforeDump.selection.bounds?.minY ?? 0) + 70,
      6
    );

    editor.endSelectionDrag(dragSession);

    const afterDump = editor.getDebugDump();
    const afterNode = getDebugNode(afterDump, nodeId);

    expect(afterDump.selection.previewDelta).toBeNull();
    expect(afterNode.transform.x - beforeNode.transform.x).toBeCloseTo(120, 6);
    expect(afterNode.transform.y - beforeNode.transform.y).toBeCloseTo(70, 6);
    expect(afterNode.renderFrame?.bounds.minX).toBeCloseTo(
      (beforeNode.renderFrame?.bounds.minX ?? 0) + 120,
      6
    );
    expect(afterNode.renderFrame?.bounds.minY).toBeCloseTo(
      (beforeNode.renderFrame?.bounds.minY ?? 0) + 70,
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
