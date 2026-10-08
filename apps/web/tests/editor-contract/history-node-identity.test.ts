import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultGroupNode,
  createDefaultPathNode,
  Editor,
} from "@punchpress/engine";

const contour = (x: number) => ({
  closed: true,
  segments: [
    { point: { x, y: 0 } },
    { point: { x: x + 10, y: 0 } },
    { point: { x: x + 10, y: 10 } },
  ],
});

// A two-contour path, already in the normalized shape (primary contour
// mirrored into `segments` and `closed`).
const path = (id: string, parentId: string, x: number) => {
  const contours = [contour(0), contour(20)];

  return {
    ...createDefaultPathNode(parentId),
    closed: true,
    contours,
    id,
    segments: contours[0].segments,
    transform: { rotation: 0, scaleX: 1, scaleY: 1, x, y: 0 },
  };
};

const group = (id: string, parentId: string) => ({
  ...createDefaultGroupNode(),
  id,
  name: id,
  parentId,
});

const LEAF_IDS = ["a1", "a2", "b1", "b2"];

const loadScene = () => {
  const editor = new Editor();

  editor
    .getState()
    .loadNodes([
      { ...createDefaultArtboardNode("Print"), id: "art" },
      group("ga", "art"),
      path("a1", "ga", 0),
      path("a2", "ga", 40),
      group("gb", "art"),
      path("b1", "gb", 80),
      path("b2", "gb", 120),
    ] as never);

  return editor;
};

const getNodes = (editor: Editor, nodeIds: string[]) => {
  return nodeIds.map((nodeId) => editor.getNode(nodeId));
};

const getArtRevisions = (editor: Editor, nodeIds: string[]) => {
  return nodeIds.map((nodeId) => editor.getNodeArtRevision(nodeId));
};

describe("history node identity", () => {
  test("loading keeps an already normalized path node", () => {
    const editor = new Editor();
    const node = path("p", "root", 0);

    editor.getState().loadNodes([node] as never);

    expect(editor.getNode("p")).toBe(node);
  });

  test("loading still mirrors a legacy segments patch into contours", () => {
    const editor = new Editor();
    const segments = contour(0).segments;

    editor.getState().loadNodes([
      {
        ...createDefaultPathNode("root"),
        closed: false,
        contours: undefined,
        id: "legacy",
        segments,
      },
    ] as never);

    expect(editor.getNode("legacy")?.contours).toEqual([
      { closed: false, segments },
    ]);
  });

  test("undo and redo of a reorder keep untouched nodes and their art", () => {
    const editor = loadScene();
    const nodesBefore = getNodes(editor, LEAF_IDS);
    const revisionsBefore = getArtRevisions(editor, LEAF_IDS);

    editor.bringToFront("ga");
    expect(editor.getChildNodeIds("art")).toEqual(["gb", "ga"]);

    const nodesAfter = getNodes(editor, LEAF_IDS);

    expect(nodesAfter).toEqual(nodesBefore);
    expect(editor.undo()).toBe(true);
    expect(editor.getChildNodeIds("art")).toEqual(["ga", "gb"]);
    getNodes(editor, LEAF_IDS).forEach((node, index) => {
      expect(node).toBe(nodesBefore[index]);
    });
    expect(getArtRevisions(editor, ["b1", "b2"])).toEqual(
      revisionsBefore.slice(2)
    );

    expect(editor.redo()).toBe(true);
    expect(editor.getChildNodeIds("art")).toEqual(["gb", "ga"]);
    getNodes(editor, LEAF_IDS).forEach((node, index) => {
      expect(node).toBe(nodesAfter[index]);
    });
  });

  test("undoing a move restores the original node objects", () => {
    const editor = loadScene();
    const [before, untouched] = getNodes(editor, ["a1", "b1"]);

    editor.setFocusedGroup("ga");
    editor.setSelectedNodes(["a1"]);
    editor.moveSelectionBy({ x: 15, y: 0 });

    const moved = editor.getNode("a1");

    expect(moved?.transform.x).toBe(15);
    expect(moved?.contours).toBe(before?.contours);
    expect(editor.getNode("b1")).toBe(untouched);

    editor.undo();
    expect(editor.getNode("a1")).toBe(before);
    expect(editor.getNode("b1")).toBe(untouched);
    expect(editor.selectedNodeIds).toEqual(["a1"]);
  });

  test("an update that changes no values records no history step", () => {
    const editor = loadScene();

    editor.updateNodes(LEAF_IDS, () => ({}));
    editor.updateNode("a1", (node) => ({
      contours: node.contours.map((entry) => ({ ...entry })),
    }));

    expect(editor.canUndo).toBe(false);
  });

  test("a change nested inside a shared-shape field is recorded", () => {
    const editor = loadScene();
    const before = editor.getNode("a1");

    editor.updateNode("a1", (node) => ({
      contours: [{ ...node.contours[0], closed: false }, node.contours[1]],
    }));

    expect(editor.canUndo).toBe(true);
    editor.undo();
    expect(editor.getNode("a1")).toBe(before);
  });

  test("undo restores the surviving part of the selection", () => {
    const editor = loadScene();

    editor.setSelectedNodes(["ga", "gb"]);
    editor.groupSelected();

    const groupId = editor.selectedNodeIds[0];

    expect(editor.getChildNodeIds("art")).toEqual([groupId]);
    editor.undo();
    expect(editor.getChildNodeIds("art")).toEqual(["ga", "gb"]);
    expect(editor.selectedNodeIds).toEqual([]);

    editor.setSelectedNodes(["gb", "ga"]);
    editor.bringToFront("ga");
    editor.undo();
    expect(editor.selectedNodeIds).toEqual(["gb", "ga"]);
  });
});
