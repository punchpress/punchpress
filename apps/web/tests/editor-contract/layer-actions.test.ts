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

  test("duplicate keeps a focused group child inside its group", () => {
    const editor = createEditor();
    const firstChildId = createTextNode(editor, {
      text: "Child one",
      x: 220,
      y: 180,
    });
    const secondChildId = createTextNode(editor, {
      text: "Child two",
      x: 380,
      y: 260,
    });

    editor.setSelectedNodes([firstChildId, secondChildId]);
    editor.groupSelected();

    const groupId = editor.selectedNodeId;
    if (!groupId) {
      throw new Error("Expected a selected group after grouping");
    }

    editor.setFocusedGroup(groupId);
    editor.select(firstChildId);

    const originalChild = editor.getNode(firstChildId);
    if (!originalChild) {
      throw new Error("Expected grouped child to exist");
    }

    editor.duplicate();

    const duplicateId = editor.selectedNodeId;
    if (!duplicateId) {
      throw new Error("Expected a selected duplicate");
    }

    const duplicate = editor.getNode(duplicateId);
    if (!duplicate) {
      throw new Error("Expected duplicate node to exist");
    }

    expect(duplicate.parentId).toBe(groupId);
    expect(duplicate.transform.x).toBeCloseTo(
      originalChild.transform.x + 120,
      6
    );
    expect(duplicate.transform.y).toBeCloseTo(
      originalChild.transform.y + 120,
      6
    );
    expect(editor.getChildNodeIds(groupId)).toHaveLength(3);
  });

  test("beginSelectionDrag duplicates a multiselection without offset before move", () => {
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
    createTextNode(editor, {
      text: "Shift front",
      x: 680,
      y: 420,
    });

    editor.setSelectedNodes([backNodeId, middleNodeId]);

    const beforeBack = editor.getNode(backNodeId);
    const beforeMiddle = editor.getNode(middleNodeId);
    if (!(beforeBack && beforeMiddle)) {
      throw new Error("Expected selected nodes to exist");
    }

    const dragSession = editor.beginSelectionDrag({ duplicate: true });

    if (!dragSession) {
      throw new Error("Expected a drag session for multiselection duplicate");
    }

    editor.updateSelectionDrag(dragSession, {
      delta: { x: 110, y: 70 },
    });
    editor.endSelectionDrag(dragSession);

    const duplicateIds = editor.selectedNodeIds;
    const backDuplicate = editor.getNode(duplicateIds[0]);
    const middleDuplicate = editor.getNode(duplicateIds[1]);
    const backAfter = editor.getNode(backNodeId);
    const middleAfter = editor.getNode(middleNodeId);

    expect(editor.getDebugDump().nodes).toHaveLength(5);
    expect(duplicateIds).toHaveLength(2);
    expect(backAfter?.transform.x).toBeCloseTo(beforeBack.transform.x, 6);
    expect(backAfter?.transform.y).toBeCloseTo(beforeBack.transform.y, 6);
    expect(middleAfter?.transform.x).toBeCloseTo(beforeMiddle.transform.x, 6);
    expect(middleAfter?.transform.y).toBeCloseTo(beforeMiddle.transform.y, 6);
    expect(backDuplicate?.transform.x).toBeCloseTo(
      beforeBack.transform.x + 110,
      6
    );
    expect(backDuplicate?.transform.y).toBeCloseTo(
      beforeBack.transform.y + 70,
      6
    );
    expect(middleDuplicate?.transform.x).toBeCloseTo(
      beforeMiddle.transform.x + 110,
      6
    );
    expect(middleDuplicate?.transform.y).toBeCloseTo(
      beforeMiddle.transform.y + 70,
      6
    );
  });

  test("beginSelectionDrag keeps a focused group child inside its group", () => {
    const editor = createEditor();
    const firstChildId = createTextNode(editor, {
      text: "Child one",
      x: 220,
      y: 180,
    });
    const secondChildId = createTextNode(editor, {
      text: "Child two",
      x: 380,
      y: 260,
    });

    editor.setSelectedNodes([firstChildId, secondChildId]);
    editor.groupSelected();

    const groupId = editor.selectedNodeId;
    if (!groupId) {
      throw new Error("Expected a selected group after grouping");
    }

    editor.setFocusedGroup(groupId);
    editor.select(firstChildId);

    const originalChild = editor.getNode(firstChildId);
    if (!originalChild) {
      throw new Error("Expected grouped child to exist");
    }

    const dragSession = editor.beginSelectionDrag({ duplicate: true });

    if (!dragSession) {
      throw new Error("Expected a drag session for focused child duplicate");
    }

    editor.updateSelectionDrag(dragSession, {
      delta: { x: 80, y: 50 },
    });
    editor.endSelectionDrag(dragSession);

    const duplicateId = editor.selectedNodeId;
    const duplicate = duplicateId ? editor.getNode(duplicateId) : null;
    const originalAfter = editor.getNode(firstChildId);

    expect(editor.focusedGroupId).toBe(groupId);
    expect(duplicate?.parentId).toBe(groupId);
    expect(originalAfter?.transform.x).toBeCloseTo(
      originalChild.transform.x,
      6
    );
    expect(originalAfter?.transform.y).toBeCloseTo(
      originalChild.transform.y,
      6
    );
    expect(duplicate?.transform.x).toBeCloseTo(
      originalChild.transform.x + 80,
      6
    );
    expect(duplicate?.transform.y).toBeCloseTo(
      originalChild.transform.y + 50,
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
