import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultGroupNode,
  createDefaultShapeNode,
  Editor,
} from "@punchpress/engine";

const shape = (id: string, parentId: string, x = 0, y = 0) => {
  const node = createDefaultShapeNode("polygon");

  return {
    ...node,
    height: 40,
    id,
    parentId,
    transform: { ...node.transform, x, y },
    width: 40,
  };
};

const group = (id: string, parentId: string, extra = {}) => ({
  ...createDefaultGroupNode(),
  id,
  name: id,
  parentId,
  ...extra,
});

// Two nested translucent stacks in an artboard, a loose leaf in the artboard,
// and a loose root leaf: the shapes the group drag benchmark and mixed
// selections exercise.
const loadStackScene = () => {
  const editor = new Editor();

  editor.getState().loadNodes([
    {
      ...createDefaultArtboardNode("A"),
      height: 2000,
      id: "art",
      width: 2000,
    },
    group("s0", "art", { opacity: 0.6 }),
    group("s0-1", "s0", { opacity: 0.6 }),
    group("s0-2", "s0-1", { opacity: 0.6 }),
    shape("a", "s0-2", 100, 100),
    shape("b", "s0-2", 200, 100),
    shape("c", "s0-1", 300, 100),
    group("s1", "art"),
    group("s1-1", "s1"),
    shape("d", "s1-1", 100, 400),
    shape("e", "s1", 200, 400),
    shape("f", "art", 600, 600),
    shape("g", "root", 3000, 3000),
  ] as never);

  return editor;
};

const getPositions = (editor: Editor, nodeIds: string[]) => {
  return nodeIds.map((nodeId) => {
    const transform = editor.getNode(nodeId)?.transform;

    return [nodeId, transform?.x, transform?.y];
  });
};

describe("group drag preview", () => {
  test("cancel restores the document without an undo step", () => {
    const editor = loadStackScene();
    const nodesBefore = editor.nodes;

    editor.setSelectedNodes(["s0", "f"]);

    const session = editor.beginSelectionDrag({
      nodeIds: editor.selectedNodeIds,
    });

    editor.updateSelectionDrag(session, { delta: { x: 40, y: 40 } });
    editor.endSelectionDrag(session, { cancel: true });

    expect(editor.selectionDragPreview).toBeNull();
    expect(editor.nodes).toEqual(nodesBefore);
    expect(editor.selectedNodeIds).toEqual(["s0", "f"]);
    expect(editor.undo()).toBeFalsy();
  });

  test("preview leaves the document untouched; commit moves every leaf once and undoes in one step", () => {
    const editor = loadStackScene();
    const leafIds = ["a", "b", "c", "d", "e", "f"];
    const before = getPositions(editor, leafIds);
    const nodesBefore = editor.nodes;

    editor.setSelectedNodes(["s0", "s1", "f"]);

    const session = editor.beginSelectionDrag({
      nodeIds: editor.selectedNodeIds,
    });

    editor.updateSelectionDrag(session, { delta: { x: 10, y: 0 } });
    editor.updateSelectionDrag(session, { delta: { x: 15, y: -20 } });

    expect(editor.nodes).toBe(nodesBefore);

    editor.endSelectionDrag(session);

    expect(editor.selectionDragPreview).toBeNull();
    expect(getPositions(editor, leafIds)).toEqual(
      before.map(([nodeId, x, y]) => [
        nodeId,
        (x as number) + 25,
        (y as number) - 20,
      ])
    );
    expect(editor.getNode("g")?.transform.x).toBe(3000);
    expect(editor.selectedNodeIds).toEqual(["s0", "s1", "f"]);

    editor.undo();

    expect(getPositions(editor, leafIds)).toEqual(before);
  });
});

describe("editor tree queries", () => {
  test("isDescendantOf walks real ancestors only", () => {
    const editor = loadStackScene();

    expect(editor.isDescendantOf("a", "s0")).toBe(true);
    expect(editor.isDescendantOf("a", "art")).toBe(true);
    expect(editor.isDescendantOf("a", "s1")).toBe(false);
    expect(editor.isDescendantOf("s0", "a")).toBe(false);
    expect(editor.isDescendantOf("a", "a")).toBe(true);
    expect(editor.isDescendantOf("a", "missing")).toBe(false);
    expect(editor.isDescendantOf("g", "root")).toBe(false);
    expect(editor.isDescendantOf(null, "s0")).toBe(false);
  });

  test("effective selection expands groups to leaves and keeps the rest", () => {
    const editor = loadStackScene();

    expect(
      editor.getEffectiveSelectionNodeIds(["s0", "f", "a", "art"])
    ).toEqual(["a", "b", "c", "f", "art"]);
    expect(editor.getEffectiveSelectionNodeIds(["missing", "s1-1"])).toEqual([
      "d",
    ]);
  });

  test("effective selection de-duplicates overlapping roots", () => {
    const editor = loadStackScene();

    expect(
      editor.getEffectiveSelectionNodeIds(["s0", "s0-2", "a", "a"])
    ).toEqual(["a", "b", "c"]);
  });

  test("tree queries follow reparent, delete, undo, and redo", () => {
    const editor = loadStackScene();

    expect(editor.getEffectiveSelectionNodeIds(["s1"])).toEqual(["d", "e"]);
    expect(editor.isDescendantOf("f", "s1")).toBe(false);

    editor.moveNodeToParent("f", "s1-1");

    expect(editor.isDescendantOf("f", "s1")).toBe(true);
    expect(editor.getEffectiveSelectionNodeIds(["s1"])).toContain("f");

    editor.undo();

    expect(editor.isDescendantOf("f", "s1")).toBe(false);
    expect(editor.getEffectiveSelectionNodeIds(["s1"])).toEqual(["d", "e"]);

    editor.redo();

    expect(editor.isDescendantOf("f", "s1")).toBe(true);

    editor.deleteNode("d");

    expect(editor.getEffectiveSelectionNodeIds(["s1"])).not.toContain("d");
    expect(editor.isDescendantOf("d", "s1")).toBe(false);
  });

  test("tree queries follow document edits", () => {
    const editor = loadStackScene();

    expect(editor.getEffectiveSelectionNodeIds(["s1"])).toEqual(["d", "e"]);

    editor
      .getState()
      .loadNodes([
        group("s1", "root"),
        shape("e", "s1"),
        shape("d", "root"),
      ] as never);

    expect(editor.getEffectiveSelectionNodeIds(["s1"])).toEqual(["e"]);
    expect(editor.isDescendantOf("d", "s1")).toBe(false);
  });
});
