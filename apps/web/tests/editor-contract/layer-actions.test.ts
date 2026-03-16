import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const ARIAL_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

describe("Editor layer actions", () => {
  test("bringToFront keeps grouped layer order stable", () => {
    const editor = createEditor();
    const backNodeId = createTextNode(editor, {
      text: "Shift back",
      x: 360,
      y: 260,
    });
    const middleNodeId = createTextNode(editor, {
      text: "Shift middle",
      x: 520,
      y: 340,
    });
    const frontNodeId = createTextNode(editor, {
      text: "Shift front",
      x: 680,
      y: 420,
    });

    editor.setSelectedNodes([backNodeId, middleNodeId]);
    editor.bringToFront();

    expect(editor.getDebugDump().nodes.map((node) => node.id)).toEqual([
      frontNodeId,
      backNodeId,
      middleNodeId,
    ]);
    expect(editor.getDebugDump().selection).toMatchObject({
      ids: [backNodeId, middleNodeId],
      primaryId: middleNodeId,
    });
  });

  test("duplicate duplicates a grouped selection and selects the duplicates", () => {
    const editor = createEditor();
    const backNodeId = createTextNode(editor, {
      text: "Shift back",
      x: 360,
      y: 260,
    });
    const middleNodeId = createTextNode(editor, {
      text: "Shift middle",
      x: 520,
      y: 340,
    });
    const frontNodeId = createTextNode(editor, {
      text: "Shift front",
      x: 680,
      y: 420,
    });

    editor.setSelectedNodes([backNodeId, middleNodeId]);
    editor.bringToFront();

    const beforeDump = editor.getDebugDump();
    const beforeBack = getDebugNode(beforeDump, backNodeId);
    const beforeMiddle = getDebugNode(beforeDump, middleNodeId);

    editor.duplicate();

    const afterDump = editor.getDebugDump();
    const duplicateIds = afterDump.selection.ids;

    expect(afterDump.nodes).toHaveLength(5);
    expect(duplicateIds).toHaveLength(2);
    expect(afterDump.nodes.map((node) => node.id)).toEqual([
      frontNodeId,
      backNodeId,
      duplicateIds[0],
      middleNodeId,
      duplicateIds[1],
    ]);

    const backDuplicate = getDebugNode(afterDump, duplicateIds[0]);
    const middleDuplicate = getDebugNode(afterDump, duplicateIds[1]);

    expect(backDuplicate.text).toBe("Shift back");
    expect(backDuplicate.transform.x).toBeCloseTo(
      beforeBack.transform.x + 120,
      6
    );
    expect(backDuplicate.transform.y).toBeCloseTo(
      beforeBack.transform.y + 120,
      6
    );
    expect(middleDuplicate.text).toBe("Shift middle");
    expect(middleDuplicate.transform.x).toBeCloseTo(
      beforeMiddle.transform.x + 120,
      6
    );
    expect(middleDuplicate.transform.y).toBeCloseTo(
      beforeMiddle.transform.y + 120,
      6
    );
  });

  test("toggleVisibility hides a selected layer without clearing selection", () => {
    const editor = createEditor();
    const nodeId = createTextNode(editor, {
      text: "Hide me",
      x: 520,
      y: 340,
    });

    editor.toggleVisibility(nodeId);

    const dump = editor.getDebugDump();
    const node = getDebugNode(dump, nodeId);

    expect(node.visible).toBe(false);
    expect(dump.selection).toMatchObject({
      ids: [nodeId],
      primaryId: nodeId,
    });
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
