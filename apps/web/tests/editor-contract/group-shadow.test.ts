import { describe, expect, test } from "bun:test";
import {
  createDefaultPathNode,
  createDefaultShapeNode,
  Editor,
  getLeafEffectPresentation,
  type RenderItem,
  type RenderLayer,
  withPathNodeContours,
} from "@punchpress/engine";

const GROUP_FILTER_TAG = /<g filter="url\(#pp-g\d+\)" opacity="0.5">/;
const FILTER_TAG = /<filter /g;
const IDENTITY = { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 };

const shadow = (extra = {}) => ({
  blur: 0,
  color: "#000000",
  enabled: true,
  id: "shadow-1",
  kind: "drop-shadow" as const,
  opacity: 1,
  x: 8,
  y: 8,
  ...extra,
});

const group = (id: string, parentId = "root", extra = {}) => ({
  id,
  name: id,
  opacity: 1,
  parentId,
  transform: IDENTITY,
  type: "group",
  visible: true,
  ...extra,
});

const artboard = (id: string) => ({
  background: "#ffffff",
  height: 600,
  id,
  locked: false,
  name: id,
  opacity: 1,
  parentId: "root",
  transform: IDENTITY,
  type: "artboard",
  visible: true,
  width: 800,
});

// A 100 × 100 square centered on (x, y).
const square = (
  id: string,
  parentId: string,
  x: number,
  y: number,
  extra = {}
) => ({
  ...createDefaultShapeNode("polygon"),
  height: 100,
  id,
  parentId,
  transform: { ...IDENTITY, x, y },
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

describe("group shadows", () => {
  test("a group layer composites its shadow over its children's stage ink", () => {
    const editor = load([
      group("g", "root", { effects: [shadow({ blur: 4 })] }),
      square("a", "g", 100, 100),
      square("b", "g", 300, 100, { effects: [shadow({ x: 20, y: 0 })] }),
    ]);
    const layer = findLayer(editor.getRenderTree().items, "g");

    expect(layer?.effects?.effects).toHaveLength(1);

    // The children span 50..350 wide, plus b's own 20-unit shadow.
    const ink = layer?.effects?.ink;

    expect(ink?.minX).toBeLessThanOrEqual(50);
    expect(ink?.maxX).toBeGreaterThanOrEqual(370);
  });

  test("an artboard holding a shadowed group clips that layer", () => {
    const editor = load([
      artboard("art"),
      group("g", "art", { effects: [shadow()] }),
      square("a", "g", 100, 100),
      group("plain", "root"),
      square("b", "plain", 1000, 100),
    ]);
    const tree = editor.getRenderTree().items;

    expect(findLayer(tree, "art")?.clip).toMatchObject({ width: 800 });
    expect(findLayer(tree, "plain")?.clip).toBe(null);
    expect(findLayer(tree, "plain")?.effects).toBe(null);
  });

  test("the layer filter widens to follow a drag preview of its children", () => {
    const editor = load([
      group("g", "root", { effects: [shadow()] }),
      square("a", "g", 100, 100),
    ]);
    const layer = findLayer(editor.getRenderTree().items, "g");

    editor.setSelectionDragPreview({
      delta: { x: 500, y: 0 },
      effectiveNodeIdSet: new Set(["a"]),
      nodeIdSet: new Set(["a"]),
      nodeIds: ["a"],
    });

    const preview = editor.getLayerPreviewEffects("g", layer?.effects ?? null);

    expect(preview?.ink.maxX).toBeGreaterThanOrEqual(650);
    editor.setSelectionDragPreview(null);
  });

  test("a preview widens shadowed ancestors of moved leaves only", () => {
    const editor = load([
      group("outer", "root", { effects: [shadow()] }),
      group("inner", "outer"),
      square("a", "inner", 100, 100),
      group("still", "root", { effects: [shadow()] }),
      square("b", "still", 400, 100),
    ]);
    const items = editor.getRenderTree().items;
    const outer = findLayer(items, "outer")?.effects ?? null;
    const still = findLayer(items, "still")?.effects ?? null;
    const nodeIdSet = new Set(["a"]);
    const drag = (x: number) => {
      editor.setSelectionDragPreview({
        delta: { x, y: 0 },
        effectiveNodeIdSet: nodeIdSet,
        nodeIdSet,
        nodeIds: ["a"],
      });
    };

    drag(500);
    expect(editor.getLayerPreviewEffects("outer", outer)?.ink.maxX).toBe(
      (outer?.ink.maxX ?? 0) + 512
    );
    expect(editor.getLayerPreviewEffects("still", still)).toBe(still);

    // Later frames of the same gesture reuse the previewed ancestry.
    drag(1100);
    expect(editor.getLayerPreviewEffects("outer", outer)?.ink.maxX).toBe(
      (outer?.ink.maxX ?? 0) + 1536
    );
    editor.setSelectionDragPreview(null);
  });

  test("export applies a group's filter with its opacity, once", async () => {
    const editor = load([
      group("g", "root", { effects: [shadow()], opacity: 0.5 }),
      square("a", "g", 100, 100),
    ]);
    const body = (await editor.exportDocument()).split("<metadata>")[0];
    const groupTag = body.match(GROUP_FILTER_TAG);

    expect(groupTag).not.toBe(null);
    expect(body.match(FILTER_TAG)).toHaveLength(1);
  });

  test("group resize scales shape and group shadows; rotation turns group shadows", () => {
    const editor = load([
      group("g", "root", { effects: [shadow({ blur: 4 })] }),
      square("a", "g", 100, 100, { effects: [shadow()] }),
      square("b", "g", 300, 100),
    ]);

    editor.setSelectedNodes(["g"]);
    editor.resizeSelectionFromCorner({ corner: "se", scale: 2 });

    expect(editor.getNode("a")?.effects?.[0]).toMatchObject({ x: 16, y: 16 });
    expect(editor.getNode("g")?.effects?.[0]).toMatchObject({
      blur: 8,
      x: 16,
      y: 16,
    });

    editor.rotateSelectionBy({ deltaRotation: 90 });

    const rotated = editor.getNode("g")?.effects?.[0];

    expect(rotated?.x).toBeCloseTo(-16);
    expect(rotated?.y).toBeCloseTo(16);
    // The shape's own shadow is node-local: its rotation carries it.
    expect(editor.getNode("a")?.effects?.[0]).toMatchObject({ x: 16, y: 16 });
  });

  test("export keeps an outer group's shadow over nested groups", async () => {
    const editor = load([
      group("outer", "root", { effects: [shadow()] }),
      group("inner", "outer"),
      square("a", "inner", 100, 100),
    ]);
    const body = (await editor.exportDocument()).split("<metadata>")[0];

    expect(body.match(FILTER_TAG)).toHaveLength(1);
  });

  test("a vector's shadow covers children scaled beyond its frame", () => {
    const editor = load([
      {
        id: "v",
        name: "V",
        opacity: 1,
        parentId: "root",
        pathComposition: "independent",
        transform: IDENTITY,
        type: "vector",
        visible: true,
      },
      {
        ...withPathNodeContours({ ...createDefaultPathNode("v"), id: "p" }, [
          {
            closed: true,
            segments: [
              [0, 0],
              [100, 0],
              [100, 100],
              [0, 100],
            ].map(([x, y]) => ({
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x, y },
              pointType: "corner" as const,
            })),
          },
        ]),
        transform: { ...IDENTITY, scaleX: 3, scaleY: 3 },
      },
    ]);

    editor.updateNodes(["v"], () => ({ effects: [shadow()] }));

    const presentation = getLeafEffectPresentation(
      editor.getNode("v"),
      editor.getNodeRenderGeometry("v")
    );

    // The 100-unit child scaled 3× about its center spans -100..200.
    expect(presentation?.ink.minX).toBeLessThanOrEqual(-100);
    expect(presentation?.ink.maxX).toBeGreaterThanOrEqual(200);
  });

  test("a whole-group resize preview scales the group's shadow like the commit", () => {
    const editor = load([
      group("g", "root", { effects: [shadow({ blur: 4 })] }),
      square("a", "g", 100, 100),
    ]);
    const layer = findLayer(editor.getRenderTree().items, "g");

    editor.setSelectionDragPreview({
      effectiveNodeIdSet: new Set(["a"]),
      nodeIdSet: new Set(["a", "g"]),
      nodeIds: ["g"],
      resize: { anchorCanvas: { x: 50, y: 50 }, scale: 2 },
    });

    const preview = editor.getLayerPreviewEffects("g", layer?.effects ?? null);

    expect(preview?.effects[0]).toMatchObject({ blur: 8, x: 16, y: 16 });
    editor.setSelectionDragPreview(null);
  });
});
