import { describe, expect, test } from "bun:test";
import {
  buildEffectFilter,
  createDefaultPathNode,
  createDefaultShapeNode,
  Editor,
  getEffectRegion,
  getLeafEffectPresentation,
  withPathNodeContours,
} from "@punchpress/engine";
import {
  PUNCH_DOCUMENT_VERSION,
  parseDesignDocument,
} from "@punchpress/punch-schema";

const IDENTITY = { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 };
const FILTER_REF = /filter="url\(#pp-g\d+\)"/;

const shadow = (id: string, extra = {}) => ({
  blur: 0,
  color: "#000000",
  enabled: true,
  id,
  kind: "drop-shadow" as const,
  opacity: 1,
  x: 8,
  y: 8,
  ...extra,
});

const rect = (id = "rect", extra = {}) => ({
  ...createDefaultShapeNode("polygon"),
  height: 100,
  id,
  transform: IDENTITY,
  width: 200,
  ...extra,
});

const vector = (id: string) => ({
  id,
  name: "Vector",
  opacity: 1,
  parentId: "root",
  pathComposition: "independent",
  transform: IDENTITY,
  type: "vector",
  visible: true,
});

const corner = (x: number, y: number) => ({
  handleIn: { x: 0, y: 0 },
  handleOut: { x: 0, y: 0 },
  point: { x, y },
  pointType: "corner" as const,
});

const childPath = (id: string, parentId: string, extra = {}) => ({
  ...withPathNodeContours({ ...createDefaultPathNode(parentId), id }, [
    {
      closed: true,
      segments: [corner(0, 0), corner(50, 0), corner(50, 50)],
    },
  ]),
  transform: IDENTITY,
  ...extra,
});

const load = (nodes: unknown[]) => {
  const editor = new Editor();

  editor.getState().loadNodes(nodes as never);

  return editor;
};

describe("drop shadows", () => {
  test("new shadows are a hard 8/8 black shadow, and the stack caps at four", () => {
    const editor = load([rect()]);

    editor.setSelectedNodes(["rect"]);

    for (let index = 0; index < 5; index += 1) {
      editor.addEffect();
    }

    const effects = editor.getNode("rect")?.effects;

    expect(effects).toHaveLength(4);
    expect(effects?.[0]).toMatchObject({
      blur: 0,
      color: "#000000",
      enabled: true,
      opacity: 1,
      x: 8,
      y: 8,
    });
    expect(new Set(effects?.map((effect) => effect.id)).size).toBe(4);
  });

  test("patches are validated and clamped, and each edit is one undo step", () => {
    const editor = load([rect("rect", { effects: [shadow("s")] })]);

    editor.setSelectedNodes(["rect"]);
    editor.updateEffect(0, { blur: -4, color: "#FF0000", opacity: 3, x: 12 });

    expect(editor.getNode("rect")?.effects?.[0]).toMatchObject({
      blur: 0,
      color: "#ff0000",
      opacity: 1,
      x: 12,
    });
    expect(editor.updateEffect(0, { color: "not a color" })).toBe(false);

    editor.undo();
    expect(editor.getNode("rect")?.effects?.[0].x).toBe(8);
  });

  test("a vector owns the shadow; its child paths never carry effects", () => {
    const editor = load([vector("v"), childPath("p", "v")]);

    editor.setSelectedNodes(["p"]);
    editor.addEffect();

    expect(editor.getNode("v")?.effects).toHaveLength(1);
    expect(editor.getNode("p")?.effects).toBe(undefined);

    // Moving a path with effects into a vector drops them.
    const loose = childPath("loose", "root", { effects: [shadow("s")] });

    editor.insertNodes([loose] as never);
    editor.updateNodes(["loose"], () => ({ parentId: "v" }));
    expect(editor.getNode("loose")?.effects).toBe(undefined);
  });

  test("documents reject effects on vector children and accept 1.11", () => {
    const base = {
      assets: {},
      nodes: [vector("v"), { ...childPath("p", "v"), effects: [shadow("s")] }],
      version: PUNCH_DOCUMENT_VERSION,
    };

    expect(() => parseDesignDocument(JSON.stringify(base))).toThrow();

    const upgraded = parseDesignDocument(
      JSON.stringify({
        assets: {},
        nodes: [{ ...rect(), parentId: "root" }],
        version: "1.11",
      })
    );

    expect(upgraded.version).toBe(PUNCH_DOCUMENT_VERSION);
  });

  test("one filter graph branches every shadow from the source alpha", () => {
    const editor = load([
      rect("rect", {
        effects: [
          shadow("a"),
          shadow("b", { blur: 10, color: "#ff0000", opacity: 0.5, x: -4 }),
          shadow("off", { enabled: false }),
        ],
      }),
    ]);
    const node = editor.getNode("rect");
    const presentation = getLeafEffectPresentation(
      node,
      editor.getNodeRenderGeometry("rect")
    );

    expect(presentation?.effects.map((effect) => effect.id)).toEqual([
      "a",
      "b",
    ]);

    const filter = buildEffectFilter(presentation as never, "f");
    const tags = (filter.children ?? []).map((child) => child.tag);

    // Hard shadow: no blur primitive. Blurred shadow: stdDeviation = blur / 2.
    expect(tags).toEqual([
      "feOffset",
      "feFlood",
      "feComposite",
      "feOffset",
      "feGaussianBlur",
      "feFlood",
      "feComposite",
      "feMerge",
    ]);
    expect(filter.children?.[4].attributes.stdDeviation).toBe("5");
    expect(filter.attributes).toMatchObject({
      "color-interpolation-filters": "sRGB",
      filterUnits: "userSpaceOnUse",
    });

    // The region covers the ink and each shadow's 4σ support.
    const region = getEffectRegion(
      presentation?.effects ?? [],
      presentation?.ink as never
    );

    expect(region.maxX).toBeGreaterThanOrEqual(
      (presentation?.ink.maxX ?? 0) + 8
    );
    expect(region.minX).toBeLessThanOrEqual(
      (presentation?.ink.minX ?? 0) - 4 - 20
    );
  });

  test("disabled and transparent shadows produce no filter", () => {
    const editor = load([
      rect("rect", {
        effects: [shadow("a", { enabled: false }), shadow("b", { opacity: 0 })],
      }),
    ]);

    expect(
      getLeafEffectPresentation(
        editor.getNode("rect"),
        editor.getNodeRenderGeometry("rect")
      )
    ).toBe(null);
  });

  test("export wraps the owner in its filter, inside its opacity", async () => {
    const editor = load([
      rect("rect", { effects: [shadow("a")], opacity: 0.5 }),
    ]);
    const body = (await editor.exportDocument()).split("<metadata>")[0];

    expect(body).toContain("<filter");
    expect(body).toMatch(FILTER_REF);
    expect(body.indexOf('opacity="0.5"')).toBeLessThan(body.indexOf("filter="));
  });
});
