import { describe, expect, test } from "bun:test";
import {
  createDefaultPathNode,
  createDefaultShapeNode,
  createSolidAppearance,
  Editor,
  withPathNodeContours,
} from "@punchpress/engine";

// Inspector rows hold layer and effect ids, and resolve them to the slot the
// commands address when they dispatch. These queries are the engine side of
// that contract.

const IDENTITY = { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 };

const stroke = (id: string, width = 2) => ({
  align: "center" as const,
  cap: "butt" as const,
  enabled: true,
  id,
  join: "miter" as const,
  miterLimit: 4,
  opacity: 1,
  paint: { color: "#000000", kind: "solid" as const },
  width,
});

const shadow = (id: string, blur = 0) => ({
  blur,
  color: "#000000",
  enabled: true,
  id,
  kind: "drop-shadow" as const,
  opacity: 1,
  x: 8,
  y: 8,
});

const shape = (id: string, strokes = [stroke(`${id}-s1`)], extra = {}) => ({
  ...createDefaultShapeNode("polygon"),
  appearance: { ...createSolidAppearance({ fill: "#ff0000" }), strokes },
  id,
  transform: IDENTITY,
  ...extra,
});

const square = (x: number) => ({
  closed: true,
  segments: [
    [x, 0],
    [x + 100, 0],
    [x + 100, 100],
    [x, 100],
  ].map(([px, py]) => ({
    handleIn: { x: 0, y: 0 },
    handleOut: { x: 0, y: 0 },
    point: { x: px, y: py },
    pointType: "corner" as const,
  })),
});

const vectorWithChildren = () => {
  const vector = {
    effects: [shadow("v-shadow", 4)],
    id: "vector",
    name: "Vector",
    opacity: 1,
    parentId: "root",
    pathComposition: "independent",
    transform: IDENTITY,
    type: "vector",
    visible: true,
  };
  const child = (id: string, x: number) => ({
    ...withPathNodeContours({ ...createDefaultPathNode("vector"), id }, [
      square(x),
    ]),
    appearance: {
      ...createSolidAppearance({ fill: "#00ff00" }),
      strokes: [stroke(`${id}-s1`, 3)],
    },
    transform: IDENTITY,
  });

  return [vector, child("p1", 0), child("p2", 200)];
};

const load = (nodes: unknown[], selectedNodeIds: string[]) => {
  const editor = new Editor();

  editor.getState().loadNodes(nodes as never);
  editor.setSelectedNodes(selectedNodeIds);

  return editor;
};

// Resolves a stroke id the way a mounted control does at dispatch.
const strokeSlot = (editor: Editor, layerId: string) => {
  const resolved = editor.getAppearanceLayer("strokes", layerId);

  if (!resolved) {
    throw new Error(`Stroke ${layerId} is not in the shared stack.`);
  }

  return resolved.slot;
};

const effectIndex = (editor: Editor, effectId: string) => {
  const resolved = editor.getEffect(effectId);

  if (!resolved) {
    throw new Error(`Effect ${effectId} is not in the shared stack.`);
  }

  return resolved.index;
};

describe("inspector layer slot resolution", () => {
  test("equal stacks with different ids share the first stack's ids and edit by index", () => {
    const editor = load(
      [
        shape("a", [stroke("a-s1"), stroke("a-s2")]),
        shape("b", [stroke("b-s1"), stroke("b-s2")]),
      ],
      ["a", "b"]
    );

    expect(editor.getSelectionAppearance()?.isMixed).toBe(false);
    expect(editor.getAppearanceLayerIds("strokes")).toEqual(["a-s1", "a-s2"]);

    expect(strokeSlot(editor, "a-s2")).toEqual({ index: 1, list: "strokes" });
    expect(editor.getAppearanceLayer("strokes", "b-s2")).toBeNull();

    editor.updateAppearanceLayer(strokeSlot(editor, "a-s2"), { width: 9 });

    expect(editor.getNode("a")?.appearance.strokes[1].width).toBe(9);
    expect(editor.getNode("b")?.appearance.strokes[1].width).toBe(9);
  });

  test("a genuinely mixed selection lists no layers and offers the first stack", () => {
    const editor = load(
      [shape("a", [stroke("a-s1", 2)]), shape("b", [stroke("b-s1", 5)])],
      ["a", "b"]
    );
    const selection = editor.getSelectionAppearance();
    const first = selection?.appearance;

    expect(selection?.isMixed).toBe(true);
    expect(first?.strokes[0].id).toBe("a-s1");
    expect(editor.getAppearanceLayerIds("strokes")).toEqual([]);
    expect(editor.getAppearanceLayer("strokes", "a-s1")).toBeNull();

    // "Use first" copies the offered stack onto the whole selection.
    expect(first && editor.setAppearance(first)).toBe(true);
    expect(editor.getSelectionAppearance()?.isMixed).toBe(false);
    expect(editor.getNode("b")?.appearance.strokes[0].width).toBe(2);
  });

  test("a multi-path vector inspects its child stacks; its effects stay on the vector", () => {
    const editor = load(vectorWithChildren(), ["vector"]);

    expect(editor.getAppearanceLayerIds("strokes")).toEqual(["p1-s1"]);
    expect(editor.getEffectIds()).toEqual(["v-shadow"]);

    editor.updateAppearanceLayer(strokeSlot(editor, "p1-s1"), { width: 7 });

    expect(editor.getNode("p1")?.appearance.strokes[0].width).toBe(7);
    expect(editor.getNode("p2")?.appearance.strokes[0].width).toBe(7);

    // A selected child path routes effects to its vector owner.
    editor.setSelectedNodes(["p1"]);
    expect(editor.getEffect("v-shadow")?.index).toBe(0);
  });

  test("ids re-resolve after reorder, removal, and undo", () => {
    const editor = load(
      [shape("a", [stroke("s1"), stroke("s2"), stroke("s3")])],
      ["a"]
    );

    editor.moveAppearanceLayer({ index: 0, list: "strokes" }, 2);
    expect(editor.getAppearanceLayerIds("strokes")).toEqual(["s2", "s3", "s1"]);
    expect(editor.getAppearanceLayer("strokes", "s1")?.slot.index).toBe(2);

    editor.removeAppearanceLayer(strokeSlot(editor, "s3"));
    expect(editor.getAppearanceLayer("strokes", "s3")).toBeNull();
    expect(editor.getAppearanceLayer("strokes", "s1")?.slot.index).toBe(1);

    editor.undo();
    expect(editor.getAppearanceLayer("strokes", "s3")?.slot.index).toBe(1);

    editor.undo();
    expect(editor.getAppearanceLayer("strokes", "s1")?.slot.index).toBe(0);
  });

  test("effect ids re-resolve after reorder and removal", () => {
    const editor = load(
      [shape("a", [], { effects: [shadow("e1"), shadow("e2", 4)] })],
      ["a"]
    );

    editor.moveEffect(0, 1);
    expect(editor.getEffectIds()).toEqual(["e2", "e1"]);
    expect(editor.getEffect("e1")?.index).toBe(1);

    editor.removeEffect(effectIndex(editor, "e2"));
    expect(editor.getEffect("e2")).toBeNull();
    expect(editor.getEffect("e1")?.index).toBe(0);
  });

  test("a scrub on one marked gesture undoes in one step", () => {
    const editor = load(
      [shape("a", [stroke("s1", 2)], { effects: [shadow("e1")] })],
      ["a"]
    );
    const mark = editor.markHistoryStep("edit stroke width");

    for (const width of [4, 8, 16]) {
      editor.updateAppearanceLayer(strokeSlot(editor, "s1"), { width });
      editor.updateEffect(effectIndex(editor, "e1"), { blur: width });
    }

    editor.commitHistoryStep(mark);
    expect(editor.getNode("a")?.appearance.strokes[0].width).toBe(16);

    editor.undo();
    expect(editor.getNode("a")?.appearance.strokes[0].width).toBe(2);
    expect(editor.getNode("a")?.effects[0].blur).toBe(0);
  });
});

describe("inspector structure", () => {
  test("value edits leave the inspection structure and layer ids unchanged", () => {
    const editor = load([shape("a", [stroke("s1")])], ["a"]);
    const before = editor.getSelectionInspection();
    const idsBefore = editor.getAppearanceLayerIds("strokes");

    editor.updateAppearanceLayer({ index: 0, list: "strokes" }, { width: 12 });

    expect(editor.getSelectionInspection()).toEqual(before);
    expect(editor.getAppearanceLayerIds("strokes")).toEqual(idsBefore);
    expect(editor.getSelectionProperty("appearance")?.isMixed).toBe(false);
  });

  test("effects reads share one result until the document changes", () => {
    const editor = load([shape("a", [], { effects: [shadow("e1")] })], ["a"]);
    const first = editor.getSelectionEffects();

    expect(editor.getSelectionEffects()).toBe(first);

    editor.updateEffect(0, { blur: 3 });

    const next = editor.getSelectionEffects();

    expect(next).not.toBe(first);
    expect(next.effects[0].blur).toBe(3);
  });

  test("strokes align on closed paths and fall back to center on open-only paths", () => {
    const path = (id: string, closed: boolean) => ({
      ...withPathNodeContours({ ...createDefaultPathNode("root"), id }, [
        { ...square(0), closed },
      ]),
      appearance: { fills: [], strokes: [stroke(`${id}-s1`, 4)] },
      transform: IDENTITY,
    });
    const editor = load([path("closed", true), path("open", false)], []);

    expect(editor.canAlignStrokes(["closed"])).toBe(true);
    expect(editor.canAlignStrokes(["open"])).toBe(false);
    expect(editor.canAlignStrokes(["closed", "open"])).toBe(false);
  });

  test("corner inspection is reused until the inspected node changes", () => {
    const editor = load([shape("a")], ["a"]);
    const first = editor.getPathEditingInspectorState("a");

    expect(editor.getPathEditingInspectorState("a")).toBe(first);

    editor.updateNodes(["a"], (node) => ({ ...node, width: 300 }));
    expect(editor.getPathEditingInspectorState("a")).not.toBe(first);
  });
});
