import { describe, expect, test } from "bun:test";
import {
  createDefaultShapeNode,
  Editor,
  type RenderItem,
  type RenderLayer,
} from "@punchpress/engine";

const IDENTITY = { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 };

const shadow = (id: string, color: string, extra = {}) => ({
  blur: 0,
  color,
  enabled: true,
  id,
  kind: "drop-shadow" as const,
  opacity: 1,
  x: 8,
  y: 8,
  ...extra,
});

const group = (id: string, extra = {}) => ({
  id,
  name: id,
  opacity: 1,
  parentId: "root",
  transform: IDENTITY,
  type: "group",
  visible: true,
  ...extra,
});

const square = (id: string, parentId: string, x: number, extra = {}) => ({
  ...createDefaultShapeNode("polygon"),
  height: 100,
  id,
  parentId,
  transform: { ...IDENTITY, x, y: 100 },
  width: 100,
  ...extra,
});

const load = (nodes: unknown[]) => {
  const editor = new Editor();

  editor.getState().loadNodes(nodes as never);

  return editor;
};

const findLayer = (items: RenderItem[], nodeId: string): RenderLayer | null => {
  for (const item of items) {
    if (item.kind !== "layer") {
      continue;
    }

    if (item.nodeId === nodeId) {
      return item;
    }

    const nested = findLayer(item.children, nodeId);

    if (nested) {
      return nested;
    }
  }

  return null;
};

const MAGENTA = "#ff00ff";
const LIME = "#00ff00";

// A group with its own magenta shadow, holding a square with a lime shadow
// at 50% and a square with a magenta shadow.
const loadShadowedGroup = () => {
  return load([
    group("g", { effects: [shadow("gs", MAGENTA)] }),
    square("a", "g", 100, {
      effects: [shadow("as", LIME, { opacity: 0.5 })],
    }),
    square("b", "g", 300, { effects: [shadow("bs", MAGENTA)] }),
  ]);
};

const findColor = (editor: Editor, value: string) => {
  return editor
    .getSelectionPropertiesSnapshot(["g"])
    .selectionProperties.selectionColors.find((color) => color.value === value);
};

describe("shadow colors in selection colors", () => {
  test("a selected group lists its own and its descendants' shadow colors", () => {
    const editor = loadShadowedGroup();

    expect(findColor(editor, MAGENTA)?.usageCount).toBe(2);
    expect(findColor(editor, "rgba(0, 255, 0, 0.5)")?.usageCount).toBe(1);
  });

  test("editing a shadow swatch recolors every matching shadow in one step", () => {
    const editor = loadShadowedGroup();
    const magenta = findColor(editor, MAGENTA);

    expect(editor.setSelectionColor(magenta?.id, "#0000ff", ["g"])).toBe(true);
    expect(editor.getNode("g")?.effects?.[0].color).toBe("#0000ff");
    expect(editor.getNode("b")?.effects?.[0].color).toBe("#0000ff");
    expect(editor.getNode("a")?.effects?.[0].color).toBe(LIME);

    editor.undo();

    expect(editor.getNode("g")?.effects?.[0].color).toBe(MAGENTA);
    expect(editor.getNode("b")?.effects?.[0].color).toBe(MAGENTA);
  });

  test("a swatch's alpha writes the shadow opacity", () => {
    const editor = loadShadowedGroup();
    const lime = findColor(editor, "rgba(0, 255, 0, 0.5)");

    editor.setSelectionColor(lime?.id, "rgba(255, 0, 0, 0.25)", ["g"]);

    expect(editor.getNode("a")?.effects?.[0]).toMatchObject({
      color: "#ff0000",
      opacity: 0.25,
    });
  });

  test("disabled shadows are not listed", () => {
    const editor = load([
      group("g"),
      square("a", "g", 100, {
        effects: [shadow("as", LIME, { enabled: false })],
      }),
    ]);

    expect(findColor(editor, LIME)).toBeUndefined();
  });

  test("a live preview recolors leaf and group shadows without writing", () => {
    const editor = loadShadowedGroup();
    const session = editor.beginSelectionColorChange(
      findColor(editor, MAGENTA)?.id,
      ["g"]
    );

    editor.updateSelectionColorChange(session, "#0000ff");

    expect(editor.getPaintNode("b")?.effects?.[0].color).toBe("#0000ff");
    expect(editor.getNode("b")?.effects?.[0].color).toBe(MAGENTA);

    const layer = findLayer(editor.getRenderTree().items, "g");
    const previewed = editor.getLayerPreviewEffects(
      "g",
      layer?.effects ?? null
    );

    expect(previewed?.effects[0].color).toBe("#0000ff");
    expect(previewed?.ink).toBe(layer?.effects?.ink);

    editor.cancelSelectionColorChange();

    expect(
      editor.getLayerPreviewEffects("g", layer?.effects ?? null)?.effects[0]
        .color
    ).toBe(MAGENTA);
  });
});
