import { describe, expect, test } from "bun:test";
import {
  createDefaultPathNode,
  createDefaultShapeNode,
  createSolidAppearance,
  Editor,
  withPathNodeContours,
} from "@punchpress/engine";

const createShape = (id: string, fill = "#ff0000") => ({
  ...createDefaultShapeNode("polygon"),
  appearance: createSolidAppearance({ fill }),
  id,
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

const getAppearance = (editor: Editor, nodeId: string) => {
  return editor.getNode(nodeId)?.appearance;
};

describe("appearance commands", () => {
  test("add, update, move, and remove layers as one undo step each", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createShape("a")] as never);
    editor.setSelectedNodes(["a"]);

    expect(editor.addFill()).toBe(true);
    expect(editor.addStroke()).toBe(true);
    expect(getAppearance(editor, "a")).toMatchObject({
      fills: [
        { id: "fill-1", paint: { color: "#ff0000" } },
        { id: "fill-2", paint: { color: "#ff0000" } },
      ],
      strokes: [{ id: "stroke-1", width: 2 }],
    });

    editor.updateAppearanceLayer(
      { index: 1, list: "fills" },
      { color: "rgba(0, 0, 255, 0.5)", opacity: 0.25 }
    );
    expect(getAppearance(editor, "a").fills[1]).toMatchObject({
      opacity: 0.25,
      paint: { color: "#0000ff" },
    });

    editor.moveAppearanceLayer({ index: 1, list: "fills" }, 0);
    expect(getAppearance(editor, "a").fills.map((layer) => layer.id)).toEqual([
      "fill-2",
      "fill-1",
    ]);

    editor.removeAppearanceLayer({ index: 0, list: "strokes" });
    expect(getAppearance(editor, "a").strokes).toEqual([]);

    editor.undo();
    expect(getAppearance(editor, "a").strokes).toHaveLength(1);
    editor.undo();
    expect(getAppearance(editor, "a").fills[0].id).toBe("fill-1");
  });

  test("clamps numbers and rejects invalid colors and slots", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createShape("a")] as never);
    editor.setSelectedNodes(["a"]);
    editor.addStroke();

    const before = getAppearance(editor, "a");

    expect(
      editor.updateAppearanceLayer(
        { index: 0, list: "fills" },
        { color: "bogus" }
      )
    ).toBe(false);
    expect(
      editor.updateAppearanceLayer({ index: 3, list: "fills" }, { opacity: 0 })
    ).toBe(false);
    expect(getAppearance(editor, "a")).toBe(before);

    editor.updateAppearanceLayer(
      { index: 0, list: "strokes" },
      { miterLimit: 0, opacity: 4, width: -3 }
    );
    expect(getAppearance(editor, "a").strokes[0]).toMatchObject({
      miterLimit: 1,
      opacity: 1,
      width: 0,
    });
  });

  test("applies to every selected node at the same slot", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createShape("a"), createShape("b")] as never);
    editor.setSelectedNodes(["a", "b"]);
    editor.updateAppearanceLayer(
      { index: 0, list: "fills" },
      { color: "#00ff00" }
    );

    expect(getAppearance(editor, "a").fills[0].paint.color).toBe("#00ff00");
    expect(getAppearance(editor, "b").fills[0].paint.color).toBe("#00ff00");

    const snapshot = editor.getSelectionPropertiesSnapshot(["a", "b"]);

    expect(snapshot.selectionProperties.properties.appearance.isMixed).toBe(
      false
    );
  });

  test("structurally different stacks read as mixed until replaced", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createShape("a"), createShape("b")] as never);
    editor.addStroke(["a"]);

    const readMixed = () =>
      editor.getSelectionPropertiesSnapshot(["a", "b"]).selectionProperties
        .properties.appearance.isMixed;

    expect(readMixed()).toBe(true);
    expect(editor.setAppearance(getAppearance(editor, "a"), ["a", "b"])).toBe(
      true
    );
    expect(readMixed()).toBe(false);
    expect(editor.setAppearance({ fills: "nope" } as never, ["a"])).toBe(false);
  });

  test("a selected multi-path vector routes paint to its child paths", () => {
    const editor = new Editor();
    const vector = {
      id: "vector",
      name: "Vector",
      opacity: 1,
      parentId: "root",
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      type: "vector",
      visible: true,
    };
    const child = (id: string, x: number) =>
      withPathNodeContours({ ...createDefaultPathNode("vector"), id }, [
        square(x),
      ]);

    editor
      .getState()
      .loadNodes([vector, child("p1", 0), child("p2", 200)] as never);
    editor.setSelectedNodes(["vector"]);
    editor.updateAppearanceLayer(
      { index: 0, list: "fills" },
      { color: "#123456" }
    );

    expect(getAppearance(editor, "p1").fills[0].paint.color).toBe("#123456");
    expect(getAppearance(editor, "p2").fills[0].paint.color).toBe("#123456");
    expect(getAppearance(editor, "vector")).toBeUndefined();
  });

  test("selection colors list layer colors and replace exact matches", () => {
    const editor = new Editor();
    const shape = {
      ...createShape("a"),
      appearance: createSolidAppearance({
        fill: "#ff0000",
        stroke: "#ff0000",
        strokeWidth: 4,
      }),
    };

    editor.getState().loadNodes([shape, createShape("b", "#00ff00")] as never);

    const colors = editor.getSelectionPropertiesSnapshot(["a", "b"])
      .selectionProperties.selectionColors;
    const red = colors.find((color) => color.value === "#ff0000");

    expect(red?.usageCount).toBe(2);
    editor.setSelectionColor(red?.id, "#0000ff", ["a", "b"]);
    expect(getAppearance(editor, "a").fills[0].paint.color).toBe("#0000ff");
    expect(getAppearance(editor, "a").strokes[0].paint.color).toBe("#0000ff");
    expect(getAppearance(editor, "b").fills[0].paint.color).toBe("#00ff00");
  });

  test("rejects out-of-range and fractional slots without mutating", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createShape("a")] as never);
    editor.setSelectedNodes(["a"]);
    editor.addFill();

    const before = getAppearance(editor, "a");

    expect(editor.moveAppearanceLayer({ index: -1, list: "fills" }, 0)).toBe(
      false
    );
    expect(editor.moveAppearanceLayer({ index: 0.5, list: "fills" }, 1)).toBe(
      false
    );
    expect(editor.moveAppearanceLayer({ index: 0, list: "fills" }, 2)).toBe(
      false
    );
    expect(editor.removeAppearanceLayer({ index: -1, list: "fills" })).toBe(
      false
    );
    expect(
      editor.updateAppearanceLayer(
        { index: 1.5, list: "fills" },
        { opacity: 0 }
      )
    ).toBe(false);
    expect(getAppearance(editor, "a")).toBe(before);
  });

  test("generic property writes cannot store an invalid stack", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createShape("a")] as never);

    const before = getAppearance(editor, "a");

    editor.setSelectionProperty("appearance", { ...before, extra: true }, [
      "a",
    ]);
    expect(getAppearance(editor, "a")).toBe(before);
    expect(() => editor.serializeDocument()).not.toThrow();
  });

  test("selection colors group by color and opacity and edit both", () => {
    const editor = new Editor();
    const translucent = {
      ...createShape("a"),
      appearance: createSolidAppearance({ fill: "rgba(255, 0, 0, 0.5)" }),
    };

    editor.getState().loadNodes([translucent, createShape("b")] as never);

    const colors = editor.getSelectionPropertiesSnapshot(["a", "b"])
      .selectionProperties.selectionColors;

    expect(colors.map((color) => color.value).sort()).toEqual([
      "#ff0000",
      "rgba(255, 0, 0, 0.5)",
    ]);

    const half = colors.find((color) => color.value !== "#ff0000");

    editor.setSelectionColor(half?.id, "rgba(0, 0, 255, 0.25)", ["a", "b"]);
    expect(getAppearance(editor, "a").fills[0]).toMatchObject({
      opacity: 0.25,
      paint: { color: "#0000ff" },
    });
    expect(getAppearance(editor, "b").fills[0]).toMatchObject({
      opacity: 1,
      paint: { color: "#ff0000" },
    });
  });

  test("primary stroke style aggregates cap and join independently", () => {
    const editor = new Editor();
    const stroked = (id: string, fill: string, join: "miter" | "round") => ({
      ...createShape(id),
      appearance: createSolidAppearance({
        cap: "round",
        fill,
        join,
        stroke: "#000000",
        strokeWidth: 3,
      }),
    });

    editor
      .getState()
      .loadNodes([
        stroked("a", "#ff0000", "miter"),
        stroked("b", "#00ff00", "round"),
        createShape("c"),
      ] as never);

    expect(editor.getPrimaryStrokeStyle(["a", "b"])).toEqual({
      cap: "round",
      isCapMixed: false,
      isJoinMixed: true,
      join: null,
    });
    expect(editor.getPrimaryStrokeStyle(["a", "c"])).toBeNull();
  });
});
