import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultGroupNode,
  createDefaultShapeNode,
  createSolidAppearance,
  Editor,
} from "@punchpress/engine";
import { saveDesignDocument } from "@punchpress/punch-schema";

describe("Editor node art revision", () => {
  test("a property edit invalidates only the edited node and its ancestors", () => {
    const { editor, ids } = createScene();
    const before = getRevisions(editor, ids);

    editor.setFocusedGroup(ids.group);
    editor.setSelectedNodes([ids.groupedShape]);
    editor.updateAppearanceLayer({ index: 0, list: "fills" }, { opacity: 0.5 });

    const after = getRevisions(editor, ids);

    expect(after.groupedShape).not.toBe(before.groupedShape);
    expect(after.group).not.toBe(before.group);
    expect(after.artboard).not.toBe(before.artboard);
    expect(after.looseShape).toBe(before.looseShape);
    expect(after.siblingShape).toBe(before.siblingShape);
  });

  test("an ancestor change invalidates its descendants", () => {
    const { editor, ids } = createScene();
    const before = getRevisions(editor, ids);

    editor.updateNodes([ids.artboard], (node) => ({ ...node, width: 900 }));

    const after = getRevisions(editor, ids);

    expect(after.looseShape).not.toBe(before.looseShape);
    expect(after.groupedShape).not.toBe(before.groupedShape);
  });

  test("reorder, delete, and undo invalidate the affected parent", () => {
    const { editor, ids } = createScene();
    const beforeReorder = getRevisions(editor, ids);

    editor.bringToFront(ids.groupedShape);

    const afterReorder = getRevisions(editor, ids);

    expect(afterReorder.group).not.toBe(beforeReorder.group);
    expect(afterReorder.looseShape).toBe(beforeReorder.looseShape);

    editor.deleteNode(ids.siblingShape);

    const afterDelete = getRevisions(editor, ids);

    expect(afterDelete.group).not.toBe(afterReorder.group);
    expect(afterDelete.looseShape).toBe(afterReorder.looseShape);

    editor.undo();

    expect(editor.getNodeArtRevision(ids.group)).not.toBe(afterDelete.group);
    expect(editor.getNodeArtRevision(ids.siblingShape)).toBeGreaterThan(0);
  });

  test("reparenting invalidates the old and new parents", () => {
    const { editor, ids } = createScene();
    const before = getRevisions(editor, ids);

    editor.updateNodes([ids.looseShape], (node) => ({
      ...node,
      parentId: ids.group,
    }));

    const after = getRevisions(editor, ids);

    expect(after.group).not.toBe(before.group);
    expect(after.artboard).not.toBe(before.artboard);
    expect(after.siblingShape).toBe(before.siblingShape);
  });

  test("deleted containers release their revisions", () => {
    const { editor, ids } = createScene();

    editor.getNodeArtRevision(ids.group);
    editor.deleteNode(ids.group);
    editor.getNodeArtRevision(ids.artboard);

    const { nodeRevisionById, subtreeRevisionById } = editor.nodeTree.revisions;
    const nodeIds = new Set(editor.nodes.map((node) => node.id));

    expect(nodeIds.has(ids.group)).toBe(false);
    expect([...nodeRevisionById.keys()].every((id) => nodeIds.has(id))).toBe(
      true
    );
    expect([...subtreeRevisionById.keys()].every((id) => nodeIds.has(id))).toBe(
      true
    );
  });
});

describe("Editor selection target", () => {
  test("resolves top-level ancestors beneath artboards and focused groups", () => {
    const { editor, ids } = createScene();

    expect(editor.getSelectionTargetNodeId(ids.groupedShape)).toBe(ids.group);
    expect(editor.getSelectionTargetNodeId(ids.looseShape)).toBe(
      ids.looseShape
    );
    expect(editor.getSelectionTargetNodeId(ids.artboard)).toBe(ids.artboard);
    expect(editor.getSelectionTargetNodeId("missing")).toBeNull();

    editor.setFocusedGroup(ids.group);

    expect(editor.getSelectionTargetNodeId(ids.groupedShape)).toBe(
      ids.groupedShape
    );
    expect(editor.getSelectionTargetNodeId(ids.looseShape)).toBe(ids.artboard);
  });
});

const createScene = () => {
  const artboard = { ...createDefaultArtboardNode("Print"), height: 600 };
  const group = { ...createDefaultGroupNode(), parentId: artboard.id };
  const createShape = (parentId: string, x: number) => {
    const node = createDefaultShapeNode("ellipse");

    return {
      ...node,
      appearance: createSolidAppearance({ fill: "#1f6feb" }),
      parentId,
      transform: { ...node.transform, x, y: 100 },
    };
  };
  const looseShape = createShape(artboard.id, 40);
  const groupedShape = createShape(group.id, 200);
  const siblingShape = createShape(group.id, 320);
  const editor = new Editor();

  editor.loadDocument(
    saveDesignDocument([
      artboard,
      looseShape,
      group,
      groupedShape,
      siblingShape,
    ]).contents
  );

  return {
    editor,
    ids: {
      artboard: artboard.id,
      group: group.id,
      groupedShape: groupedShape.id,
      looseShape: looseShape.id,
      siblingShape: siblingShape.id,
    },
  };
};

const getRevisions = (editor: Editor, ids: Record<string, string>) => {
  return Object.fromEntries(
    Object.entries(ids).map(([key, id]) => [key, editor.getNodeArtRevision(id)])
  );
};
