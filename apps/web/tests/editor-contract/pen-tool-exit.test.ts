import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

describe("leaving Pen path editing", () => {
  test("Pointer restores object selection after closing a drawn path", () => {
    const editor = new Editor();
    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 260, y: 140 });
    clickPen(editor, { x: 200, y: 240 });
    clickPen(editor, { x: 120, y: 140 });
    const nodeId = editor.selectedNodeId;
    const node = editor.getNode(nodeId);
    expect(node?.type).toBe("path");
    expect(editor.pathEditingNodeId).toBe(nodeId);

    editor.setActiveTool("pointer");

    expect(editor.pathEditingNodeId).toBeNull();
    expect(editor.pathEditingPoints).toEqual([]);
    expect(editor.selectedNodeId).toBe(nodeId);
    expect(editor.getNode(nodeId)).toEqual(node);
    expect(editor.undo()).toBe(true);
    expect(editor.getNode(nodeId)).toMatchObject({ closed: false });
  });

  test("leaving an open path commits the drawing and clears point editing", () => {
    const editor = new Editor();
    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 260, y: 140 });
    const nodeId = editor.selectedNodeId;

    editor.setActiveTool("shape");

    expect(editor.pathEditingNodeId).toBeNull();
    expect(editor.selectedNodeId).toBe(nodeId);
    expect(editor.nodes).toHaveLength(1);
    expect(editor.undo()).toBe(true);
    const node = editor.getNode(nodeId);
    if (node?.type !== "path") {
      throw new Error("Expected the drawn path after undo");
    }
    expect(node.segments).toHaveLength(1);
  });

  test("Node retains direct editing when taking over from Pen", () => {
    const editor = new Editor();
    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 260, y: 140 });
    const nodeId = editor.selectedNodeId;

    editor.setActiveTool("node");

    expect(editor.pathEditingNodeId).toBe(nodeId);
    expect(editor.getPenPreviewState()).toBeNull();
    editor.setActiveTool("pointer");
    expect(editor.pathEditingNodeId).toBeNull();
  });
});

const clickPen = (editor: Editor, point: { x: number; y: number }) => {
  const session = editor.dispatchCanvasPointerDown({ point });
  if (!session) {
    throw new Error("Expected a Pen placement session");
  }
  if (session.complete({ dragDistancePx: 0, point }) !== true) {
    throw new Error("Expected Pen placement to complete");
  }
};
