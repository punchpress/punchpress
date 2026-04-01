import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const ARIAL_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

describe("Editor clipboard", () => {
  test("copySelection and pasteClipboardContent duplicate the selected nodes", () => {
    const editor = createEditor();
    const firstNodeId = createTextNode(editor, {
      text: "Copy me",
      x: 360,
      y: 260,
    });
    const secondNodeId = createTextNode(editor, {
      text: "Me too",
      x: 520,
      y: 340,
    });

    editor.setSelectedNodes([firstNodeId, secondNodeId]);

    const content = editor.copySelection();
    editor.pasteClipboardContent(content);

    const dump = editor.getDebugDump();
    const pastedNodeIds = dump.selection.ids;
    const firstPasted = getDebugNode(dump, pastedNodeIds[0]);
    const secondPasted = getDebugNode(dump, pastedNodeIds[1]);

    expect(pastedNodeIds).toHaveLength(2);
    expect(dump.nodes).toHaveLength(4);
    expect(firstPasted.id).not.toBe(firstNodeId);
    expect(secondPasted.id).not.toBe(secondNodeId);
    expect(firstPasted.text).toBe("Copy me");
    expect(secondPasted.text).toBe("Me too");
    expect(firstPasted.transform.x).toBeCloseTo(480, 6);
    expect(firstPasted.transform.y).toBeCloseTo(380, 6);
    expect(secondPasted.transform.x).toBeCloseTo(640, 6);
    expect(secondPasted.transform.y).toBeCloseTo(460, 6);
  });

  test("pasteText creates a selected text node from external plain text", () => {
    const editor = createEditor();

    editor.pasteText("  hello\nworld  ");

    const dump = editor.getDebugDump();
    const pastedNodeId = dump.selection.primaryId;
    const pastedNode = getDebugNode(dump, pastedNodeId);

    expect(dump.nodes).toHaveLength(1);
    expect(pastedNode.text).toBe("hello world");
    expect(pastedNode.warp).toEqual({
      kind: "none",
    });
  });

  test("repeated paste steps the same clipboard payload forward", () => {
    const editor = createEditor();
    const originalNodeId = createTextNode(editor, {
      text: "Step me",
      x: 360,
      y: 260,
    });

    editor.setSelectedNodes([originalNodeId]);

    const content = editor.copySelection();
    editor.pasteClipboardContent(content);

    const firstPasteNode = getDebugNode(
      editor.getDebugDump(),
      editor.getDebugDump().selection.primaryId
    );

    editor.pasteClipboardContent(content);

    const secondPasteNode = getDebugNode(
      editor.getDebugDump(),
      editor.getDebugDump().selection.primaryId
    );

    expect(firstPasteNode.transform.x).toBeCloseTo(480, 6);
    expect(firstPasteNode.transform.y).toBeCloseTo(380, 6);
    expect(secondPasteNode.transform.x).toBeCloseTo(600, 6);
    expect(secondPasteNode.transform.y).toBeCloseTo(500, 6);
  });

  test("pasteClipboardContent recenters a shape-only payload into the viewport", () => {
    const editor = createEditor();

    attachViewport(editor);
    editor.addShapeNode({ x: 5000, y: 5000 }, "polygon");

    const originalNodeId = editor.selectedNodeId;

    if (!originalNodeId) {
      throw new Error("Expected a selected shape node");
    }

    const content = editor.copySelection();
    editor.pasteClipboardContent(content);

    const dump = editor.getDebugDump();
    const pastedNode = getDebugNode(dump, dump.selection.primaryId);

    expect(pastedNode.id).not.toBe(originalNodeId);
    expect(pastedNode.type).toBe("shape");
    expect(pastedNode.shape).toBe("polygon");
    expect(pastedNode.transform.x).toBeCloseTo(500, 6);
    expect(pastedNode.transform.y).toBeCloseTo(400, 6);
  });

  test("pasteClipboardContent recenters mixed text and shape payloads using both node bounds", () => {
    const editor = createEditor();

    attachViewport(editor);
    const textNodeId = createTextNode(editor, {
      text: "A",
      x: 5000,
      y: 5000,
    });
    editor.addShapeNode({ x: 5300, y: 5000 }, "polygon");

    const shapeNodeId = editor.selectedNodeId;

    if (!shapeNodeId) {
      throw new Error("Expected a selected shape node");
    }

    editor.setSelectedNodes([textNodeId, shapeNodeId]);

    const content = editor.copySelection();
    editor.pasteClipboardContent(content);

    const dump = editor.getDebugDump();
    const pastedNodes = dump.selection.ids.map((nodeId) =>
      getDebugNode(dump, nodeId)
    );
    const pastedTextNode = pastedNodes.find((node) => node.type === "text");
    const pastedShapeNode = pastedNodes.find((node) => node.type === "shape");

    expect(pastedTextNode?.id).not.toBe(textNodeId);
    expect(pastedShapeNode?.id).not.toBe(shapeNodeId);
    expect(pastedTextNode?.transform.x).toBeCloseTo(340, 6);
    expect(pastedTextNode?.transform.y).toBeCloseTo(400, 6);
    expect(pastedShapeNode?.transform.x).toBeCloseTo(640, 6);
    expect(pastedShapeNode?.transform.y).toBeCloseTo(400, 6);
  });

  test("a fresh copy of the same selection resets the paste step", () => {
    const editor = createEditor();
    const originalNodeId = createTextNode(editor, {
      text: "Reset me",
      x: 360,
      y: 260,
    });

    editor.setSelectedNodes([originalNodeId]);

    const firstContent = editor.copySelection();
    editor.pasteClipboardContent(firstContent);

    const firstPasteNode = getDebugNode(
      editor.getDebugDump(),
      editor.getDebugDump().selection.primaryId
    );

    editor.setSelectedNodes([originalNodeId]);

    const secondContent = editor.copySelection();
    editor.pasteClipboardContent(secondContent);

    const secondPasteNode = getDebugNode(
      editor.getDebugDump(),
      editor.getDebugDump().selection.primaryId
    );

    expect(firstPasteNode.transform.x).toBeCloseTo(480, 6);
    expect(firstPasteNode.transform.y).toBeCloseTo(380, 6);
    expect(secondPasteNode.transform.x).toBeCloseTo(480, 6);
    expect(secondPasteNode.transform.y).toBeCloseTo(380, 6);
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

const attachViewport = (editor) => {
  editor.hostRef = {
    getBoundingClientRect: () => ({
      height: 800,
      width: 1000,
    }),
    querySelector: () => null,
  };
  editor.viewerRef = {
    getScrollLeft: () => 0,
    getScrollTop: () => 0,
  };
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
