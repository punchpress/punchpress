import { describe, expect, test } from "bun:test";
import { Editor, getNodeWorldPoint } from "@punchpress/engine";

const makeShape = () => {
  const editor = new Editor();
  editor.addShapeNode({ x: 400, y: 300 }, "polygon");
  const nodeId = editor.selectedNodeId;
  if (!nodeId) {
    throw new Error("Expected a selected shape");
  }
  editor.resetHistory();
  return { editor, nodeId };
};

describe("canceled gestures", () => {
  test("resize restores live geometry and consumes no undo step", () => {
    const { editor, nodeId } = makeShape();
    const before = editor.getNode(nodeId);
    const bounds = editor.getNodeTransformBounds(nodeId);
    if (!bounds) {
      throw new Error("Expected shape bounds");
    }
    const session = editor.beginResizeSelection({
      anchorCanvas: { x: bounds.minX, y: bounds.minY },
      direction: [1, 1],
      nodeId,
    });
    const mark = editor.markHistoryStep("resize selection");
    editor.updateResizeSelection(session, { scale: 1.5 });
    expect(editor.getNode(nodeId)).not.toEqual(before);

    editor.cancelGesture(mark);

    expect(editor.getNode(nodeId)).toEqual(before);
    expect(editor.selectionDragPreview).toBeNull();
    expect(editor.canUndo).toBe(false);
  });

  test("rotation restores live geometry and consumes no undo step", () => {
    const { editor, nodeId } = makeShape();
    const before = editor.getNode(nodeId);
    const session = editor.beginRotateSelection({ nodeId });
    const mark = editor.markHistoryStep("rotate selection");
    editor.updateRotateSelection(session, { deltaRotation: 30 });
    expect(editor.getNode(nodeId)).not.toEqual(before);

    editor.cancelGesture(mark);

    expect(editor.getNode(nodeId)).toEqual(before);
    expect(editor.selectionDragPreview).toBeNull();
    expect(editor.canUndo).toBe(false);
  });

  test("duplicate move removes the duplicate on cancellation", () => {
    const { editor } = makeShape();
    const beforeIds = editor.getDebugDump().nodes.map((node) => node.id);
    const beforeSelection = editor.selectedNodeIds;
    const session = editor.beginSelectionDrag({ duplicate: true });
    editor.updateSelectionDrag(session, { delta: { x: 50, y: 25 } });
    expect(editor.getDebugDump().nodes).toHaveLength(2);

    editor.endSelectionDrag(session, { cancel: true });

    expect(editor.getDebugDump().nodes.map((node) => node.id)).toEqual(
      beforeIds
    );
    expect(editor.selectedNodeIds).toEqual(beforeSelection);
    expect(editor.selectionDragPreview).toBeNull();
    expect(editor.canUndo).toBe(false);
  });

  test("text guide edit restores the starting warp without an undo step", () => {
    const editor = new Editor();
    const node = {
      fill: "#000000",
      font: {
        family: "Arial",
        fullName: "Arial",
        postscriptName: "ArialMT",
        style: "Regular",
      },
      fontSize: 120,
      id: "wave-node",
      parentId: "root",
      stroke: null,
      strokeWidth: 0,
      text: "FLAG",
      tracking: 0,
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 500, y: 600 },
      type: "text",
      visible: true,
      warp: { amplitude: 180, cycles: 2, kind: "wave" },
    } as const;
    editor.getState().loadNodes([node]);
    editor.resetHistory();
    const before = editor.getNode(node.id);
    const geometry = editor.getNodeGeometry(node.id);
    const handle = geometry?.guide?.handles.find(
      (item) => item.role === "amplitude"
    );
    if (!(geometry?.bbox && handle)) {
      throw new Error("Expected a wave amplitude handle");
    }
    const start = getNodeWorldPoint(node, geometry.bbox, handle.point);
    const session = editor.beginTextPathEdit({
      mode: "amplitude",
      nodeId: node.id,
      pointerCanvas: start,
    });
    const mark = editor.markHistoryStep("adjust text warp");
    editor.updateTextPathEdit(session, {
      pointerCanvas: { x: start.x, y: start.y - 80 },
    });
    expect(editor.getNode(node.id)).not.toEqual(before);

    editor.cancelGesture(mark);

    expect(editor.getNode(node.id)).toEqual(before);
    expect(editor.canUndo).toBe(false);
  });
});
