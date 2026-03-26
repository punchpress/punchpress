import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const ARIAL_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

describe("Editor history", () => {
  test("undo and redo restore a created node", () => {
    const editor = createEditor();

    createTextNode(editor, {
      text: "UNDO REDO",
      x: 240,
      y: 240,
    });

    expect(editor.getDebugDump().nodes.map((node) => node.text)).toEqual([
      "UNDO REDO",
    ]);

    editor.undo();
    expect(editor.getDebugDump().nodes).toHaveLength(0);

    editor.redo();
    expect(editor.getDebugDump().nodes.map((node) => node.text)).toEqual([
      "UNDO REDO",
    ]);
  });

  test("undo and redo restore a created shape node", () => {
    const editor = createEditor();

    editor.setNextShapeKind("ellipse");
    editor.addShapeNode({
      x: 320,
      y: 240,
    });

    expect(editor.getDebugDump().nodes).toMatchObject([
      {
        shape: "ellipse",
        type: "shape",
      },
    ]);

    editor.undo();
    expect(editor.getDebugDump().nodes).toHaveLength(0);

    editor.redo();
    expect(editor.getDebugDump().nodes).toMatchObject([
      {
        shape: "ellipse",
        type: "shape",
      },
    ]);
  });

  test("a marked drag session records a single history step", () => {
    const editor = createEditor();
    const nodeId = createTextNode(editor, {
      text: "DRAG ME",
      x: 320,
      y: 260,
    });

    const beforeDump = editor.getDebugDump();
    const beforeNode = getDebugNode(beforeDump, nodeId);
    const moveSession = editor.beginMoveSelection({ nodeId });

    if (!(moveSession && beforeNode.frame)) {
      throw new Error("Expected a move session and frame");
    }

    const historyMark = editor.markHistoryStep("move selection");

    if (!historyMark) {
      throw new Error("Expected a history mark");
    }

    editor.updateMoveSelection(moveSession, {
      left: beforeNode.frame.bounds.minX + 70,
      top: beforeNode.frame.bounds.minY + 45,
    });
    editor.updateMoveSelection(moveSession, {
      left: beforeNode.frame.bounds.minX + 140,
      top: beforeNode.frame.bounds.minY + 80,
    });
    editor.commitMoveSelection(moveSession);
    editor.commitHistoryStep(historyMark);

    const afterDrag = getDebugNode(editor.getDebugDump(), nodeId);

    expect(afterDrag.transform.x - beforeNode.transform.x).toBeCloseTo(140, 6);
    expect(afterDrag.transform.y - beforeNode.transform.y).toBeCloseTo(80, 6);

    editor.undo();

    const afterUndo = getDebugNode(editor.getDebugDump(), nodeId);

    expect(afterUndo.transform.x).toBeCloseTo(beforeNode.transform.x, 6);
    expect(afterUndo.transform.y).toBeCloseTo(beforeNode.transform.y, 6);

    editor.redo();

    const afterRedo = getDebugNode(editor.getDebugDump(), nodeId);

    expect(afterRedo.transform.x).toBeCloseTo(afterDrag.transform.x, 6);
    expect(afterRedo.transform.y).toBeCloseTo(afterDrag.transform.y, 6);
  });

  test("reverting to a mark restores state without adding a history step", () => {
    const editor = createEditor();
    const nodeId = createTextNode(editor, {
      text: "RESET ME",
      x: 260,
      y: 180,
    });

    editor.resetHistory();

    const beforeNode = getDebugNode(editor.getDebugDump(), nodeId);
    const historyMark = editor.markHistoryStep("move selection");

    if (!historyMark) {
      throw new Error("Expected a history mark");
    }

    editor.moveSelectionBy({
      x: 90,
      y: 55,
    });

    const movedNode = getDebugNode(editor.getDebugDump(), nodeId);

    expect(movedNode.transform.x).toBeCloseTo(beforeNode.transform.x + 90, 6);
    expect(movedNode.transform.y).toBeCloseTo(beforeNode.transform.y + 55, 6);

    editor.revertToMark(historyMark);

    const revertedNode = getDebugNode(editor.getDebugDump(), nodeId);

    expect(revertedNode.transform.x).toBeCloseTo(beforeNode.transform.x, 6);
    expect(revertedNode.transform.y).toBeCloseTo(beforeNode.transform.y, 6);
    expect(editor.canUndo).toBe(false);
    expect(editor.canRedo).toBe(false);
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

  return node;
};
