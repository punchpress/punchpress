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

  test("the tree keeps its identity until its inputs change", () => {
    const editor = new Editor();

    editor.getState().loadNodes([group("g"), shape("a", "g")] as never);

    const tree = editor.getRenderTree();

    editor.setHoveredNode("a");
    expect(editor.getRenderTree()).toBe(tree);

    editor.updateNode("a", { opacity: 0.4 });
    expect(editor.getRenderTree()).not.toBe(tree);
  });
});
