import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultGroupNode,
  createDefaultShapeNode,
  Editor,
} from "@punchpress/engine";
import { parseDesignDocument } from "@punchpress/punch-schema";

const shape = (id: string, parentId = "root") => ({
  ...createDefaultShapeNode("polygon"),
  id,
  parentId,
});

const group = (id: string, parentId = "root") => ({
  ...createDefaultGroupNode(),
  id,
  name: id,
  parentId,
});

const artboard = (id: string) => ({ ...createDefaultArtboardNode(id), id });

// Parents precede children and every subtree occupies one contiguous interval.
// Returns each violation so tests can assert an empty list.
const getContiguityViolations = (nodes: { id: string; parentId: string }[]) => {
  const violations: string[] = [];
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const subtreeEnd = nodes.map((_node, index) => index);

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const parentIndex = indexById.get(nodes[index].parentId);

    if (parentIndex === undefined) {
      continue;
    }

    if (parentIndex > index) {
      violations.push(`${nodes[index].id} precedes its parent`);
    }

    subtreeEnd[parentIndex] = Math.max(
      subtreeEnd[parentIndex],
      subtreeEnd[index]
    );
  }

  for (let index = 0; index < nodes.length; index += 1) {
    for (let inner = index + 1; inner <= subtreeEnd[index]; inner += 1) {
      let ancestor = nodes[inner].parentId;

      while (ancestor !== nodes[index].id && indexById.has(ancestor)) {
        ancestor = nodes[indexById.get(ancestor) as number].parentId;
      }

      if (ancestor !== nodes[index].id) {
        violations.push(`${nodes[inner].id} interrupts ${nodes[index].id}`);
      }
    }
  }

  return violations;
};

const ids = (editor: Editor) => editor.nodes.map((node) => node.id);

describe("group contiguity", () => {
  test("loading interleaved nodes canonicalizes subtree order and keeps sibling order", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        group("g"),
        shape("a", "g"),
        shape("x"),
        shape("b", "g"),
      ] as never);

    expect(ids(editor)).toEqual(["g", "a", "b", "x"]);
    expect(getContiguityViolations(editor.nodes)).toEqual([]);
  });

  test("parsing a document canonicalizes order and keeps orphans for validation", () => {
    const document = parseDesignDocument(
      JSON.stringify({
        assets: {},
        nodes: [group("g"), shape("a", "g"), shape("x"), shape("b", "g")],
        version: "1.9",
      })
    );

    expect(document.nodes.map((node) => node.id)).toEqual(["g", "a", "b", "x"]);
  });

  test("inserting a child under an earlier parent keeps the subtree contiguous", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([artboard("art"), shape("a", "art"), shape("x")] as never);
    editor.insertNodes([shape("b", "art")] as never);

    expect(ids(editor)).toEqual(["art", "a", "b", "x"]);
    expect(getContiguityViolations(editor.nodes)).toEqual([]);
  });

  test("reparenting, grouping, ungrouping, and undo keep subtrees contiguous", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        artboard("art"),
        shape("a", "art"),
        shape("b", "art"),
        shape("x"),
        shape("y"),
      ] as never);

    editor.moveNodeToParent("y", "art");
    expect(getContiguityViolations(editor.nodes)).toEqual([]);

    editor.setSelectedNodes(["a", "y"]);
    editor.groupSelected();
    expect(getContiguityViolations(editor.nodes)).toEqual([]);

    const groupId = editor.selectedNodeIds[0];

    editor.ungroup(groupId);
    expect(getContiguityViolations(editor.nodes)).toEqual([]);

    const afterUngroup = ids(editor);

    editor.undo();
    editor.undo();
    editor.undo();
    expect(ids(editor)).toEqual(["art", "a", "b", "x", "y"]);

    editor.redo();
    editor.redo();
    editor.redo();
    expect(ids(editor)).toEqual(afterUngroup);
  });

  test("seeded random structural edits keep every subtree contiguous", () => {
    let seed = 20_261_007;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;

      return seed / 2_147_483_648;
    };
    const pick = <T>(values: T[]) =>
      values[Math.floor(random() * values.length)];
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        artboard("art"),
        shape("a", "art"),
        group("g", "art"),
        shape("b", "g"),
        shape("c", "g"),
        shape("x"),
        shape("y"),
      ] as never);

    let created = 0;

    for (let step = 0; step < 300; step += 1) {
      const nodes = editor.nodes;
      const leafIds = nodes
        .filter((node) => node.type === "shape")
        .map((node) => node.id);
      const containerIds = [
        "root",
        ...nodes
          .filter((node) => node.type === "group" || node.type === "artboard")
          .map((node) => node.id),
      ];

      const before = ids(editor);

      switch (Math.floor(random() * 11)) {
        case 0:
          created += 1;
          editor.insertNodes([
            shape(`n${created}`, pick(containerIds)),
          ] as never);
          break;
        case 1:
          if (leafIds.length > 0) {
            editor.moveNodeToParent(pick(leafIds), pick(containerIds));
          }
          break;
        case 2:
          if (leafIds.length > 1) {
            editor.setSelectedNodes([pick(leafIds), pick(leafIds)]);
            editor.groupSelected();
          }
          break;
        case 3: {
          const groups = nodes.filter((node) => node.type === "group");

          if (groups.length > 0) {
            editor.ungroup(pick(groups).id);
          }
          break;
        }
        case 4:
          if (leafIds.length > 0) {
            editor.bringToFront(pick(leafIds));
          }
          break;
        case 5:
          if (leafIds.length > 0) {
            editor.sendToBack(pick(leafIds));
          }
          break;
        case 6:
          if (leafIds.length > 0) {
            editor.duplicate(pick(leafIds));
          }
          break;
        case 7:
          if (leafIds.length > 0) {
            editor.setSelectedNodes([pick(leafIds)]);
            editor.pasteClipboardContent(editor.copySelection());
          }
          break;
        case 8:
          if (leafIds.length > 2) {
            editor.setSelectedNodes([pick(leafIds)]);
            editor.deleteSelected();
          }
          break;
        case 9: {
          // Undo then redo must restore the exact document orders.
          const afterEdit = ids(editor);

          if (editor.undo()) {
            const undone = ids(editor);

            editor.redo();
            expect(ids(editor)).toEqual(afterEdit);
            editor.undo();
            expect(ids(editor)).toEqual(undone);
          }
          break;
        }
        default:
          editor.redo();
      }

      expect(getContiguityViolations(editor.nodes)).toEqual([]);
      expect(before.length).toBeGreaterThan(0);
      expect(new Set(ids(editor)).size).toBe(editor.nodes.length);
    }
  });

  test("an already canonical document keeps its nodes array identity", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([group("g"), shape("a", "g"), shape("x")] as never);

    const before = editor.nodes;

    editor.updateNode("x", { opacity: 0.5 });
    expect(editor.nodes).not.toBe(before);

    const after = editor.nodes;

    editor.getState().setFocusedGroupId("g");
    expect(editor.nodes).toBe(after);
  });
});
