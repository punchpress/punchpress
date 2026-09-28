import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultShapeNode,
  Editor,
} from "@punchpress/engine";

const ARIAL_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

describe("Editor selection commands", () => {
  test("keeps exactly one active layer for every non-empty document", () => {
    const editor = new Editor();
    const firstNode = {
      ...createDefaultShapeNode(),
      id: "first-shape",
    };
    const secondNode = {
      ...createDefaultShapeNode(),
      id: "second-shape",
    };

    expect(editor.activeLayerId).toBeNull();

    editor.insertNodes([firstNode, secondNode]);

    expect(editor.activeLayerId).toBe(secondNode.id);

    editor.getState().loadNodes([firstNode]);

    expect(editor.activeLayerId).toBe(firstNode.id);

    editor.getState().loadNodes([]);

    expect(editor.activeLayerId).toBeNull();
  });

  test("clears canvas transform selection without clearing the active layer", () => {
    const editor = new Editor();
    const firstNode = {
      ...createDefaultShapeNode(),
      id: "first-shape",
    };
    const secondNode = {
      ...createDefaultShapeNode(),
      id: "second-shape",
    };

    editor.insertNodes([firstNode, secondNode]);
    editor.select(firstNode.id);
    editor.clearSelection();

    expect(editor.selectedNodeIds).toEqual([]);
    expect(editor.activeLayerId).toBe(firstNode.id);
    expect(editor.getSelectionBounds()).toBeNull();
    expect(editor.getLayerRow(firstNode.id)).toMatchObject({
      isActive: true,
      isSelected: false,
    });
    expect(editor.getDebugDump()).toMatchObject({
      activeLayerId: firstNode.id,
      selection: {
        ids: [],
        primaryId: null,
      },
    });
  });

  test("activates the nearest surviving sibling or parent Frame after deletion", () => {
    const editor = new Editor();
    const frame = {
      ...createDefaultArtboardNode(),
      id: "frame",
    };
    const firstNode = {
      ...createDefaultShapeNode(),
      id: "first-shape",
      parentId: frame.id,
    };
    const activeNode = {
      ...createDefaultShapeNode(),
      id: "active-shape",
      parentId: frame.id,
    };
    const nextNode = {
      ...createDefaultShapeNode(),
      id: "next-shape",
      parentId: frame.id,
    };
    const unrelatedNode = {
      ...createDefaultShapeNode(),
      id: "unrelated-shape",
    };

    editor.insertNodes([frame, firstNode, activeNode, nextNode, unrelatedNode]);
    editor.select(activeNode.id);
    editor.deleteSelected();

    expect(editor.activeLayerId).toBe(nextNode.id);

    editor.select(nextNode.id);
    editor.deleteSelected();

    expect(editor.activeLayerId).toBe(firstNode.id);

    editor.select(firstNode.id);
    editor.deleteSelected();

    expect(editor.activeLayerId).toBe(frame.id);

    editor.select(frame.id);
    editor.deleteSelected();

    expect(editor.activeLayerId).toBe(unrelatedNode.id);

    editor.select(unrelatedNode.id);
    editor.deleteSelected();

    expect(editor.activeLayerId).toBeNull();
  });

  test("activates the remaining primary when toggling the active layer off", () => {
    const editor = new Editor();
    const firstNode = {
      ...createDefaultShapeNode(),
      id: "first-shape",
    };
    const secondNode = {
      ...createDefaultShapeNode(),
      id: "second-shape",
    };

    editor.insertNodes([firstNode, secondNode]);
    editor.setSelectedNodes([firstNode.id, secondNode.id]);

    expect(editor.selectedNodeId).toBe(secondNode.id);
    expect(editor.activeLayerId).toBe(secondNode.id);

    editor.toggleSelection(secondNode.id);

    expect(editor.selectedNodeIds).toEqual([firstNode.id]);
    expect(editor.selectedNodeId).toBe(firstNode.id);
    expect(editor.activeLayerId).toBe(firstNode.id);

    editor.toggleSelection(firstNode.id);

    expect(editor.selectedNodeIds).toEqual([]);
    expect(editor.activeLayerId).toBe(firstNode.id);
  });

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
