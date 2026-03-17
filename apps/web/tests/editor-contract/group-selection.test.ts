import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const ARIAL_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

describe("Editor groups", () => {
  test("groupSelected wraps sibling layers in a group and selects the new group", () => {
    const editor = createEditor();
    const firstNodeId = createTextNode(editor, {
      text: "First",
      x: 520,
      y: 320,
    });
    const secondNodeId = createTextNode(editor, {
      text: "Second",
      x: 760,
      y: 520,
    });

    editor.setSelectedNodes([firstNodeId, secondNodeId]);
    editor.groupSelected();

    const dump = editor.getDebugDump();
    const groupNode = dump.nodes.find((node) => node.type === "group");

    expect(groupNode).toBeDefined();
    expect(dump.selection.ids).toEqual([groupNode?.id]);
    expect(dump.nodes.find((node) => node.id === firstNodeId)?.parentId).toBe(
      groupNode?.id
    );
    expect(dump.nodes.find((node) => node.id === secondNodeId)?.parentId).toBe(
      groupNode?.id
    );
    expect(groupNode?.frame).not.toBeNull();
  });

  test("selection target resolves to the group until the group is focused", () => {
    const editor = createEditor();
    const firstNodeId = createTextNode(editor, {
      text: "First",
      x: 520,
      y: 320,
    });
    const secondNodeId = createTextNode(editor, {
      text: "Second",
      x: 760,
      y: 520,
    });

    editor.setSelectedNodes([firstNodeId, secondNodeId]);
    editor.groupSelected();

    const groupNodeId = editor.selectedNodeId;

    expect(editor.getSelectionTargetNodeId(firstNodeId)).toBe(groupNodeId);

    editor.setFocusedGroup(groupNodeId);

    expect(editor.getSelectionTargetNodeId(firstNodeId)).toBe(firstNodeId);
  });

  test("exiting focused group selects the group and clears child selection", () => {
    const editor = createEditor();
    const firstNodeId = createTextNode(editor, {
      text: "First",
      x: 520,
      y: 320,
    });
    const secondNodeId = createTextNode(editor, {
      text: "Second",
      x: 760,
      y: 520,
    });

    editor.setSelectedNodes([firstNodeId, secondNodeId]);
    editor.groupSelected();

    const groupNodeId = editor.selectedNodeId;
    editor.setFocusedGroup(groupNodeId);
    editor.select(firstNodeId);

    editor.exitGroupFocus();

    expect(editor.focusedGroupId).toBeNull();
    expect(editor.selectedNodeIds).toEqual([groupNodeId]);
  });

  test("deleting the last child removes the now-empty group", () => {
    const editor = createEditor();
    const firstNodeId = createTextNode(editor, {
      text: "First child",
      x: 520,
      y: 320,
    });
    const secondNodeId = createTextNode(editor, {
      text: "Second child",
      x: 760,
      y: 520,
    });

    editor.setSelectedNodes([firstNodeId, secondNodeId]);
    editor.groupSelected();

    const groupNodeId = editor.selectedNodeId;
    editor.setFocusedGroup(groupNodeId);
    editor.select(firstNodeId);
    editor.deleteSelected();
    editor.select(secondNodeId);
    editor.deleteSelected();

    expect(editor.getNode(groupNodeId)).toBeNull();
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
