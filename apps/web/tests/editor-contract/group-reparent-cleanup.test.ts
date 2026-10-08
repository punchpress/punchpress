import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultGroupNode,
  createDefaultShapeNode,
  Editor,
} from "@punchpress/engine";

const shape = (id: string, parentId: string) => ({
  ...createDefaultShapeNode("polygon"),
  id,
  parentId,
});

const group = (id: string, parentId: string) => ({
  ...createDefaultGroupNode(),
  id,
  name: id,
  parentId,
});

// art: outer(middle(inner(only)), kept), sibling, target(t1)
const loadScene = () => {
  const editor = new Editor();

  editor
    .getState()
    .loadNodes([
      { ...createDefaultArtboardNode("Print"), id: "art" },
      group("outer", "art"),
      group("middle", "outer"),
      group("inner", "middle"),
      shape("only", "inner"),
      shape("kept", "outer"),
      shape("sibling", "art"),
      group("target", "art"),
      shape("t1", "target"),
    ] as never);

  return editor;
};

const getOrder = (editor: Editor) => editor.nodes.map((node) => node.id);

describe("group reparent cleanup", () => {
  test("moving the only leaf out removes its whole empty group chain", () => {
    const editor = loadScene();

    editor.moveNodeToParent("only", "target", "t1");

    expect(getOrder(editor)).toEqual([
      "art",
      "outer",
      "kept",
      "sibling",
      "target",
      "only",
      "t1",
    ]);
    expect(editor.getNode("only")?.parentId).toBe("target");

    editor.undo();
    expect(getOrder(editor)).toEqual([
      "art",
      "outer",
      "middle",
      "inner",
      "only",
      "kept",
      "sibling",
      "target",
      "t1",
    ]);
  });

  test("a group never moves into its own descendant", () => {
    const editor = loadScene();
    const nodesBefore = editor.nodes;

    editor.moveNodeToParent("outer", "inner", undefined);
    editor.moveNodeToParent("outer", "outer", undefined);

    expect(editor.nodes).toBe(nodesBefore);
    expect(editor.canUndo).toBe(false);
  });

  test("bringing a group to front moves its subtree as one block", () => {
    const editor = loadScene();

    editor.bringToFront("outer");

    expect(editor.getChildNodeIds("art")).toEqual([
      "sibling",
      "target",
      "outer",
    ]);
    expect(getOrder(editor)).toEqual([
      "art",
      "sibling",
      "target",
      "t1",
      "outer",
      "middle",
      "inner",
      "only",
      "kept",
    ]);
    expect(editor.getLayerRow("outer")?.isFrontmost).toBe(true);
    expect(editor.getLayerRow("sibling")?.isBackmost).toBe(true);
  });
});
