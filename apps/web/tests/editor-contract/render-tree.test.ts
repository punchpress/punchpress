import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultGroupNode,
  createDefaultPathNode,
  createDefaultShapeNode,
  Editor,
  type RenderItem,
} from "@punchpress/engine";

const shape = (id: string, parentId = "root", extra = {}) => ({
  ...createDefaultShapeNode("polygon"),
  id,
  parentId,
  ...extra,
});

const group = (id: string, parentId = "root", extra = {}) => ({
  ...createDefaultGroupNode(),
  id,
  name: id,
  parentId,
  ...extra,
});

// Compact text form: layers as `id@opacity[...]`, leaves as `kind:id`.
const describeItems = (items: RenderItem[]): string[] => {
  return items.map((item) => {
    if (item.kind === "layer") {
      return `${item.nodeId}@${item.opacity}[${describeItems(item.children).join(",")}]`;
    }

    return `${item.kind}:${item.nodeId}`;
  });
};

describe("render tree", () => {
  test("every group and artboard is a layer; leaves are shells in paint order", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      { ...createDefaultArtboardNode("A"), id: "art", opacity: 0.8 },
      shape("a", "art"),
      group("g", "art", { opacity: 0.5 }),
      shape("b", "g"),
      shape("c", "g", { visible: false }),
      shape("x"),
      {
        ...createDefaultGroupNode(),
        id: "empty-g",
        name: "e",
        parentId: "root",
      },
    ] as never);

    const tree = editor.getRenderTree();

    expect(describeItems(tree.items)).toEqual([
      "art@0.8[shell:a,g@0.5[shell:b]]",
      "shell:x",
      "empty-g@1[]",
    ]);
    expect(tree.placedNodeIds).toEqual(["a", "b", "x"]);
  });

  test("vectors are atomic shells; hidden subtrees are pruned", () => {
    const editor = new Editor();
    const vector = {
      id: "v",
      name: "Vector",
      opacity: 1,
      parentId: "root",
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      type: "vector",
      visible: true,
    };

    editor
      .getState()
      .loadNodes([
        vector,
        { ...createDefaultPathNode("v"), id: "p1" },
        group("hidden", "root", { visible: false }),
        shape("h1", "hidden"),
      ] as never);

    expect(describeItems(editor.getRenderTree().items)).toEqual(["shell:v"]);
  });

  test("dense groups collapse to one surface unless focus or editing is inside", () => {
    const editor = new Editor();
    const leaves = Array.from({ length: 301 }, (_, index) =>
      shape(`s${index}`, "inner")
    );

    editor
      .getState()
      .loadNodes([
        group("outer", "root", { opacity: 0.5 }),
        group("inner", "outer"),
        ...leaves,
      ] as never);

    expect(describeItems(editor.getRenderTree().items)).toEqual([
      "outer@0.5[surface:outer]",
    ]);

    // Focus expands only the focused group; a dense ancestor stays one
    // surface. Editing a node expands every group on its path.
    editor.getState().setFocusedGroupId("inner");
    expect(describeItems(editor.getRenderTree().items)).toEqual([
      "outer@0.5[surface:outer]",
    ]);

    editor.getState().setFocusedGroupId("outer");
    expect(editor.getRenderTree().placedNodeIds).toEqual(["inner"]);

    editor.getState().setFocusedGroupId(null);
    editor.startPathEditing("s7");

    const editing = editor.getRenderTree();

    expect(editing.placedNodeIds).toHaveLength(301);
    expect(editing.placedNodeIds).not.toContain("outer");
  });

  test("density counts leaves through nested groups; shadows below keep a group expanded", () => {
    const editor = new Editor();
    const shadow = {
      blur: 4,
      color: "#000000",
      enabled: true,
      id: "shadow",
      kind: "drop-shadow",
      opacity: 0.5,
      x: 2,
      y: 2,
    };
    const leaves = (parentId: string, count: number) =>
      Array.from({ length: count }, (_, index) =>
        shape(`${parentId}-${index}`, parentId)
      );

    editor
      .getState()
      .loadNodes([
        group("dense"),
        group("dense-a", "dense"),
        ...leaves("dense-a", 151),
        group("dense-b", "dense"),
        ...leaves("dense-b", 150),
        group("held"),
        group("held-shadowed", "held", { effects: [shadow] }),
        ...leaves("held-shadowed", 2),
        ...leaves("held", 300),
      ] as never);

    const tree = editor.getRenderTree();

    expect(describeItems(tree.items).slice(0, 1)).toEqual([
      "dense@1[surface:dense]",
    ]);
    expect(tree.placedNodeIds).toHaveLength(1 + 2 + 300);
    expect(tree.placedNodeIds).not.toContain("held");
  });

  test("the tree keeps its identity until its structure changes", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([group("g"), shape("a", "g"), shape("b", "g")] as never);

    const tree = editor.getRenderTree();

    editor.setHoveredNode("a");
    expect(editor.getRenderTree()).toBe(tree);

    // Leaf content edits repaint the leaf without re-placing every shell.
    editor.updateNode("a", { opacity: 0.4 });
    expect(editor.getRenderTree()).toBe(tree);

    editor.updateNode("g", { opacity: 0.5 });
    const layerOpacityTree = editor.getRenderTree();
    expect(layerOpacityTree).not.toBe(tree);

    editor.updateNode("b", { visible: false });
    expect(editor.getRenderTree()).not.toBe(layerOpacityTree);
    expect(editor.getRenderTree().placedNodeIds).toEqual(["a"]);
  });

  test("a structural change keeps unchanged layers and the placed ids", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        group("g1"),
        shape("a", "g1"),
        shape("b", "g1"),
        group("g2"),
        shape("c", "g2"),
        shape("d", "g2"),
      ] as never);

    const tree = editor.getRenderTree();
    const [g1, g2] = tree.items;

    editor.setFocusedGroup("g2");
    editor.setSelectedNodes(["c", "d"]);
    editor.groupSelected();

    const grouped = editor.getRenderTree();

    expect(grouped).not.toBe(tree);
    expect(grouped.items[0]).toBe(g1);
    expect(grouped.items[1]).not.toBe(g2);
    expect(grouped.placedNodeIds).toBe(tree.placedNodeIds);

    editor.undo();

    const restored = editor.getRenderTree();

    expect(restored.items[0]).toBe(g1);
    expect(describeItems(restored.items)).toEqual(describeItems(tree.items));

    // Paint order changes replace the placed ids.
    editor.bringToFront("g1");
    expect(editor.getRenderTree().placedNodeIds).toEqual(["c", "d", "a", "b"]);
    expect(editor.getRenderTree().items[1]).toBe(g1);
  });
});
