import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultGroupNode,
  createDefaultPathNode,
  createDefaultShapeNode,
  Editor,
  type PreviewPresentationPlan,
  type RenderItem,
  type RenderLayer,
} from "@punchpress/engine";

const shape = (id: string, parentId: string, x = 0, y = 0, extra = {}) => {
  const node = createDefaultShapeNode("polygon");

  return {
    ...node,
    height: 40,
    id,
    parentId,
    transform: { ...node.transform, x, y },
    width: 40,
    ...extra,
  };
};

const group = (id: string, parentId: string, extra = {}) => ({
  ...createDefaultGroupNode(),
  id,
  name: id,
  parentId,
  ...extra,
});

const vector = (id: string, parentId: string) => ({
  id,
  name: id,
  opacity: 1,
  parentId,
  transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
  type: "vector",
  visible: true,
});

const shadow = {
  blur: 0,
  color: "#000000",
  enabled: true,
  id: "shadow-1",
  kind: "drop-shadow" as const,
  opacity: 1,
  x: 8,
  y: 8,
};

// art
// ├─ s0 (60%)  ─ s0-1 ─ s0-2 ─ a, b
// │                  └─ c
// ├─ s1 ─ s1-1 ─ d
// │    └─ e
// └─ f
// g (root)
const loadStackScene = () => {
  const editor = new Editor();

  editor.getState().loadNodes([
    {
      ...createDefaultArtboardNode("A"),
      height: 2000,
      id: "art",
      width: 2000,
    },
    group("s0", "art", { effects: [shadow], opacity: 0.6 }),
    group("s0-1", "s0", { effects: [shadow] }),
    group("s0-2", "s0-1"),
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

const describeTargets = (plan: PreviewPresentationPlan) => {
  return plan.targets.map((target) => `${target.kind}:${target.nodeId}`);
};

const move = (nodeIds: string[], committed: string[], extra = {}) => ({
  delta: { x: 10, y: 5 },
  effectiveNodeIdSet: new Set(committed),
  nodeIdSet: new Set([...nodeIds, ...committed]),
  nodeIds,
  ...extra,
});

const dragSelection = (editor: Editor, nodeIds: string[]) => {
  editor.setSelectedNodes(nodeIds);

  const session = editor.beginSelectionDrag({ nodeIds });

  editor.updateSelectionDrag(session, { delta: { x: 10, y: 5 } });

  return session;
};

const findLayer = (items: RenderItem[], nodeId: string): RenderLayer | null => {
  for (const item of items) {
    if (item.kind === "layer") {
      if (item.nodeId === nodeId) {
        return item;
      }

      const nested = findLayer(item.children, nodeId);

      if (nested) {
        return nested;
      }
    }
  }

  return null;
};

describe("preview presentation plan", () => {
  test("a whole-group drag moves one layer and carries everything beneath it", () => {
    const editor = loadStackScene();
    const session = dragSelection(editor, ["s0"]);
    const plan = editor.getPreviewPresentationPlan();

    expect(describeTargets(plan)).toEqual(["layer:s0"]);
    expect([...plan.carriedLayerIds].sort()).toEqual(["s0", "s0-1", "s0-2"]);
    expect([...plan.movedPlacedNodeIds].sort()).toEqual(["a", "b", "c"]);
    expect([...plan.affectedLayerIds]).toEqual(["art"]);

    editor.endSelectionDrag(session, { cancel: true });
  });

  test("a requested group inside another requested group is not a second root", () => {
    const editor = loadStackScene();
    const plan = editor.getPreviewPresentationPlan(
      move(["s0", "s0-2"], ["a", "b", "c"])
    );

    expect(describeTargets(plan)).toEqual(["layer:s0"]);
  });

  test("mixed group and leaf roots resolve to disjoint targets in paint order", () => {
    const editor = loadStackScene();
    const session = dragSelection(editor, ["g", "f", "s0", "s1"]);
    const plan = editor.getPreviewPresentationPlan();

    expect(describeTargets(plan)).toEqual([
      "layer:s0",
      "layer:s1",
      "shell:f",
      "shell:g",
    ]);
    expect([...plan.movedPlacedNodeIds].sort()).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
    ]);

    editor.endSelectionDrag(session, { cancel: true });
  });

  test("partial coverage keeps the highest fully committed group or falls back to shells", () => {
    const editor = loadStackScene();

    expect(
      describeTargets(
        editor.getPreviewPresentationPlan(move(["s0"], ["a", "b"]))
      )
    ).toEqual(["layer:s0-2"]);

    const leafOnly = editor.getPreviewPresentationPlan(move(["s0"], ["a"]));

    expect(describeTargets(leafOnly)).toEqual(["shell:a"]);
    // Every stationary ancestor of the moving shell re-filters.
    expect([...leafOnly.affectedLayerIds].sort()).toEqual([
      "art",
      "s0",
      "s0-1",
      "s0-2",
    ]);
    expect(leafOnly.carriedLayerIds.size).toBe(0);
  });

  test("independently selected leaves never infer their parent group", () => {
    const editor = loadStackScene();
    const session = dragSelection(editor, ["a", "b"]);

    expect(describeTargets(editor.getPreviewPresentationPlan())).toEqual([
      "shell:a",
      "shell:b",
    ]);

    editor.endSelectionDrag(session, { cancel: true });
  });

  test("hidden content does not block a group root", () => {
    const editor = loadStackScene();

    editor.updateNode("b", { visible: false });

    const session = dragSelection(editor, ["s0"]);

    expect(describeTargets(editor.getPreviewPresentationPlan())).toEqual([
      "layer:s0",
    ]);

    editor.endSelectionDrag(session, { cancel: true });
  });

  test("an artboard moves as a layer only when it is dragged itself", () => {
    const editor = loadStackScene();
    const artboardDrag = dragSelection(editor, ["art"]);

    expect(describeTargets(editor.getPreviewPresentationPlan())).toEqual([
      "layer:art",
    ]);

    editor.endSelectionDrag(artboardDrag, { cancel: true });

    const contentsDrag = dragSelection(editor, ["s0", "s1", "f"]);

    expect(describeTargets(editor.getPreviewPresentationPlan())).toEqual([
      "layer:s0",
      "layer:s1",
      "shell:f",
    ]);

    editor.endSelectionDrag(contentsDrag, { cancel: true });
  });

  test("resize and rotation previews keep per-shell targets", () => {
    const editor = loadStackScene();
    const { delta, ...membership } = move(["s0"], ["a", "b", "c"]);

    expect(
      describeTargets(
        editor.getPreviewPresentationPlan({
          ...membership,
          resize: { anchorCanvas: { x: 0, y: 0 }, scale: 2 },
        })
      )
    ).toEqual(["shell:a", "shell:b", "shell:c"]);
    expect(
      describeTargets(
        editor.getPreviewPresentationPlan({
          ...membership,
          rotate: { centerCanvas: { x: 0, y: 0 }, deltaRotation: 30 },
        })
      )
    ).toEqual(["shell:a", "shell:b", "shell:c"]);
    expect(delta).toBeTruthy();
  });

  test("vectors stay atomic and contour edits never move a group", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        group("g", "root"),
        vector("v", "g"),
        { ...createDefaultPathNode("v"), id: "p1" },
        { ...createDefaultPathNode("v"), id: "p2" },
        shape("x", "g"),
      ] as never);

    expect(
      describeTargets(
        editor.getPreviewPresentationPlan(move(["g"], ["p1", "p2", "x"]))
      )
    ).toEqual(["layer:g"]);
    // A partial child selection does not stand in for the whole vector.
    expect(
      describeTargets(editor.getPreviewPresentationPlan(move(["p1"], ["p1"])))
    ).toEqual([]);

    editor.startPathEditing("v");

    expect(
      describeTargets(
        editor.getPreviewPresentationPlan(move(["g"], ["p1", "p2", "x"]))
      )
    ).toEqual(["shell:x"]);
  });

  test("dense groups move as their layer; partly committed surfaces stay put", () => {
    const editor = new Editor();
    const leaves = Array.from({ length: 301 }, (_, index) =>
      shape(`l${index}`, "inner", index, 0)
    );

    editor
      .getState()
      .loadNodes([
        group("outer", "root"),
        group("inner", "outer"),
        ...leaves,
        shape("x", "outer"),
        shape("y", "root"),
      ] as never);

    const leafIds = leaves.map((leaf) => leaf.id);

    // Unfocused, `outer` is one dense surface; its layer carries it.
    expect(editor.getRenderTree().placedNodeIds).toEqual(["outer", "y"]);
    expect(
      describeTargets(
        editor.getPreviewPresentationPlan(
          move(["outer", "y"], [...leafIds, "x", "y"])
        )
      )
    ).toEqual(["layer:outer", "shell:y"]);
    // Selections inside a collapsed surface never move the whole surface.
    expect(
      describeTargets(
        editor.getPreviewPresentationPlan(move(["inner"], leafIds))
      )
    ).toEqual([]);

    editor.getState().setFocusedGroupId("outer");

    expect(editor.getRenderTree().placedNodeIds).toEqual(["inner", "x", "y"]);
    expect(
      describeTargets(
        editor.getPreviewPresentationPlan(move(["outer"], [...leafIds, "x"]))
      )
    ).toEqual(["layer:outer"]);
    expect(
      describeTargets(
        editor.getPreviewPresentationPlan(move(["outer"], ["l0", "x"]))
      )
    ).toEqual(["shell:x"]);
  });

  test("delta-only updates reuse one plan; representation and membership changes rebuild it", () => {
    const editor = loadStackScene();
    const tree = editor.getRenderTree();
    const session = dragSelection(editor, ["s0", "s1"]);
    const first = editor.getPreviewPresentationPlan();

    editor.updateSelectionDrag(session, { delta: { x: 1, y: 0 } });

    expect(editor.getPreviewPresentationPlan()).toBe(first);
    expect(editor.getRenderTree()).toBe(tree);

    editor.endSelectionDrag(session, { cancel: true });

    const preview = move(["s0"], ["a", "b", "c"]);
    const warmed = editor.getPreviewPresentationPlan(preview);

    expect(editor.getPreviewPresentationPlan({ ...preview })).toBe(warmed);

    editor.updateNode("c", { visible: false });

    const hidden = editor.getPreviewPresentationPlan(preview);

    expect(hidden).not.toBe(warmed);
    expect([...hidden.movedPlacedNodeIds].sort()).toEqual(["a", "b"]);

    // `f` joins s0-2 uncommitted, so s0-2 can no longer move as a layer.
    editor.moveNodeToParent("f", "s0-2");

    expect(describeTargets(editor.getPreviewPresentationPlan(preview))).toEqual(
      ["shell:a", "shell:b"]
    );

    editor.undo();
    editor.getState().setFocusedGroupId("s0");

    expect(editor.getPreviewPresentationPlan(preview)).not.toBe(hidden);
  });

  test("carried effects keep their identity; stationary ancestors widen once per step", () => {
    const editor = loadStackScene();
    const items = editor.getRenderTree().items;
    const s0 = findLayer(items, "s0")?.effects ?? null;
    const s01 = findLayer(items, "s0-1")?.effects ?? null;
    const preview = move(["s0"], ["a", "b", "c"]);

    editor.setSelectionDragPreview(preview);

    expect(editor.getLayerPreviewEffects("s0", s0)).toBe(s0);
    expect(editor.getLayerPreviewEffects("s0-1", s01)).toBe(s01);

    // Moving only `a` leaves s0 and s0-1 stationary with moving content.
    const leafMove = move(["a"], ["a"]);

    editor.setSelectionDragPreview(leafMove);

    const widened = editor.getLayerPreviewEffects("s0", s0);

    expect(widened).not.toBe(s0);
    expect(widened?.ink.maxX).toBe((s0?.ink.maxX ?? 0) + 512);

    editor.setSelectionDragPreview({ ...leafMove, delta: { x: 20, y: 5 } });

    expect(editor.getLayerPreviewEffects("s0", s0)).toBe(widened);

    editor.setSelectionDragPreview(null);

    expect(editor.getLayerPreviewEffects("s0", s0)).toBe(s0);
  });

  test("commit moves every leaf once in one undo step; cancel leaves no step", () => {
    const editor = loadStackScene();
    const nodesBefore = editor.nodes;
    const cancelled = dragSelection(editor, ["s0"]);

    editor.updateSelectionDrag(cancelled, { delta: { x: 30, y: 0 } });

    expect(editor.nodes).toBe(nodesBefore);

    editor.endSelectionDrag(cancelled, { cancel: true });

    expect(editor.nodes).toEqual(nodesBefore);
    expect(editor.undo()).toBeFalsy();

    const nodesBeforeCommit = editor.nodes;
    const committed = dragSelection(editor, ["s0"]);

    editor.updateSelectionDrag(committed, { delta: { x: 30, y: 0 } });

    expect(editor.nodes).toBe(nodesBeforeCommit);

    editor.endSelectionDrag(committed);

    expect(editor.selectionDragPreview).toBeNull();
    expect(
      ["a", "b", "c", "d"].map((nodeId) => editor.getNode(nodeId)?.transform.x)
    ).toEqual([140, 240, 340, 100]);

    editor.undo();

    expect(editor.getNode("a")?.transform.x).toBe(100);
    expect(editor.undo()).toBeFalsy();
  });
});
