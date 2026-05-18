import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

describe("Editor artboards", () => {
  test("creates a durable root-level artboard with a fixed frame", () => {
    const editor = new Editor();

    editor.addArtboardNode({ x: 100, y: 200 });

    const artboard = editor.selectedNode;
    const frame = artboard ? editor.getNodeRenderFrame(artboard.id) : null;

    expect(artboard?.type).toBe("artboard");
    expect(artboard?.parentId).toBe("root");
    expect(artboard?.name).toBe("Artboard 1");
    expect(frame?.bounds.minX).toBe(100);
    expect(frame?.bounds.minY).toBe(200);
    expect(frame?.bounds.width).toBe(4500);
    expect(frame?.bounds.height).toBe(5400);
  });

  test("selecting content inside an artboard targets the content, not the artboard", () => {
    const editor = new Editor();

    editor.addArtboardNode({ x: 0, y: 0 });
    const artboardId = editor.selectedNodeId;
    editor.addShapeNode({ x: 300, y: 300 }, "polygon");
    const shapeId = editor.selectedNodeId;

    editor.moveNodeToParent(shapeId, artboardId, null);

    expect(editor.getSelectionTargetNodeId(shapeId)).toBe(shapeId);
  });

  test("placing text inside an artboard makes the text artboard content and selects it", () => {
    const editor = new Editor();

    editor.addArtboardNode({ x: 0, y: 0 });
    const artboardId = editor.selectedNodeId;

    editor.addTextNode({ x: 300, y: 300 });
    const textNode = editor.selectedNode;

    expect(textNode?.type).toBe("text");
    expect(textNode?.parentId).toBe(artboardId);
    expect(editor.selectedNodeId).toBe(textNode?.id);
    expect(editor.editingNodeId).toBe(textNode?.id);
  });

  test("moving an artboard moves its child content with it", () => {
    const editor = new Editor();

    editor.addArtboardNode({ x: 0, y: 0 });
    const artboardId = editor.selectedNodeId;
    editor.addShapeNode({ x: 300, y: 300 }, "polygon");
    const shapeId = editor.selectedNodeId;
    editor.moveNodeToParent(shapeId, artboardId, null);

    const beforeShape = editor.getNode(shapeId);
    editor.select(artboardId);
    const movedNodeIds = editor.moveSelectionBy({ x: 50, y: 70 });
    const afterArtboard = editor.getNode(artboardId);
    const afterShape = editor.getNode(shapeId);

    expect(movedNodeIds).toEqual([artboardId, shapeId]);
    expect(afterArtboard?.transform.x).toBe(50);
    expect(afterArtboard?.transform.y).toBe(70);
    expect(afterShape?.transform.x).toBe((beforeShape?.transform.x || 0) + 50);
    expect(afterShape?.transform.y).toBe((beforeShape?.transform.y || 0) + 70);
    expect(afterShape?.parentId).toBe(artboardId);
  });

  test("moving a root node into an artboard reparents it", () => {
    const editor = new Editor();

    editor.addArtboardNode({ x: 0, y: 0 });
    const artboardId = editor.selectedNodeId;
    editor.addShapeNode({ x: 6000, y: 6000 }, "polygon");
    const shapeId = editor.selectedNodeId;

    editor.moveSelectionBy({ x: -5750, y: -5750 });

    expect(editor.getNode(shapeId)?.parentId).toBe(artboardId);
  });

  test("resizing an artboard changes its surface without scaling child content", () => {
    const editor = new Editor();

    editor.addArtboardNode({ x: 0, y: 0 });
    const artboardId = editor.selectedNodeId;
    editor.addShapeNode({ x: 300, y: 300 }, "polygon");
    const shapeId = editor.selectedNodeId;
    editor.moveNodeToParent(shapeId, artboardId, null);
    editor.select(artboardId);

    const beforeShape = editor.getNode(shapeId);
    const resizeSession = editor.beginResizeSelection({
      anchorCanvas: { x: 0, y: 0 },
      handle: "se",
      nodeId: artboardId,
    });

    editor.updateResizeSelection(resizeSession, {
      pointCanvas: { x: 1200, y: 900 },
    });

    const artboard = editor.getNode(artboardId);
    const afterShape = editor.getNode(shapeId);

    expect(artboard?.width).toBe(1200);
    expect(artboard?.height).toBe(900);
    expect(afterShape?.transform.x).toBe(beforeShape?.transform.x);
    expect(afterShape?.transform.y).toBe(beforeShape?.transform.y);
  });

  test("does not rotate a mixed selection that includes an artboard", () => {
    const editor = new Editor();

    editor.addArtboardNode({ x: 0, y: 0 });
    const artboardId = editor.selectedNodeId;
    editor.addShapeNode({ x: 6000, y: 0 }, "polygon");
    const shapeId = editor.selectedNodeId;

    editor.setSelectedNodes([artboardId, shapeId]);

    const rotatedNodeIds = editor.rotateSelectionBy({ deltaRotation: 15 });

    expect(rotatedNodeIds).toEqual([]);
    expect(editor.getNode(artboardId)?.transform.rotation).toBe(0);
    expect(editor.getNode(shapeId)?.transform.rotation).toBe(0);
  });
});
