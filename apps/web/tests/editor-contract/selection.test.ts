import { describe, expect, test } from "bun:test";
import { Editor } from "../../src/editor/editor";

const ARIAL_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

describe("Editor selection commands", () => {
  test("selects, toggles, deselects, and clears selection through the debug dump", () => {
    const editor = createEditor();
    const firstNodeId = createTextNode(editor, {
      text: "First node",
      x: 520,
      y: 320,
    });
    const secondNodeId = createTextNode(editor, {
      text: "Second node",
      x: 760,
      y: 520,
    });

    editor.select(firstNodeId);
    expect(editor.getDebugDump().selection).toMatchObject({
      ids: [firstNodeId],
      primaryId: firstNodeId,
    });

    editor.toggleSelection(secondNodeId);
    expect(editor.getDebugDump().selection).toMatchObject({
      ids: [firstNodeId, secondNodeId],
      primaryId: secondNodeId,
    });

    editor.deselect(firstNodeId);
    expect(editor.getDebugDump().selection).toMatchObject({
      ids: [secondNodeId],
      primaryId: secondNodeId,
    });

    editor.clearSelection();
    expect(editor.getDebugDump().selection).toMatchObject({
      ids: [],
      primaryId: null,
    });
  });

  test("selecting another node finalizes the current text edit", () => {
    const editor = createEditor();
    const editingNodeId = createTextNode(editor, {
      text: "Original text",
      x: 520,
      y: 320,
    });
    const otherNodeId = createTextNode(editor, {
      text: "Other node",
      x: 760,
      y: 520,
    });

    editor.startEditing(editor.getNode(editingNodeId));
    editor.setEditingText("Edited text");
    editor.select(otherNodeId);

    const dump = editor.getDebugDump();
    const editingNode = dump.nodes.find((node) => node.id === editingNodeId);

    expect(editor.editingNodeId).toBeNull();
    expect(dump.selection).toMatchObject({
      ids: [otherNodeId],
      primaryId: otherNodeId,
    });
    expect(editingNode?.text).toBe("Edited text");
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
