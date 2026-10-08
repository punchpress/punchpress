import { describe, expect, test } from "bun:test";
import {
  buildAppearanceElements,
  buildAppearanceObjects,
  createDefaultPathNode,
  createDefaultShapeNode,
  Editor,
  type SvgElement,
  withPathNodeContours,
} from "@punchpress/engine";
import {
  getLocalFontId,
  PUNCH_DOCUMENT_VERSION,
  parseDesignDocument,
} from "@punchpress/punch-schema";

const URL_REF = /url\(#(.+)\)/;
const URL_PREFIX = /^url\(#/;
const MOVE_COMMAND = /[Mm]/g;
const IDENTITY = { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 };
const EXPORT_CLIP_REF = /clip-path="url\(#pp-g\d+\)"/;
const EXPORT_MASK_REF = /mask="url\(#pp-g\d+\)"/;

const solidFill = (id: string, color: string, opacity = 1) => ({
  enabled: true,
  id,
  opacity,
  paint: { color, kind: "solid" as const },
});

const stroke = (
  id: string,
  align: "center" | "inside" | "outside",
  width: number,
  extra = {}
) => ({
  ...solidFill(id, "#0000ff"),
  align,
  cap: "butt" as const,
  join: "miter" as const,
  miterLimit: 4,
  width,
  ...extra,
});

// A 200 × 100 rectangle centered on the origin.
const rect = (appearance, extra = {}) => ({
  ...createDefaultShapeNode("polygon"),
  appearance,
  height: 100,
  id: "rect",
  transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
  width: 200,
  ...extra,
});

const corner = (x: number, y: number) => ({
  handleIn: { x: 0, y: 0 },
  handleOut: { x: 0, y: 0 },
  point: { x, y },
  pointType: "corner" as const,
});

const squareAt = (x: number, y: number, size: number, closed = true) => ({
  closed,
  segments: [
    corner(x, y),
    corner(x + size, y),
    corner(x + size, y + size),
    corner(x, y + size),
  ],
});

const square = (x: number, size: number, closed = true) => {
  return squareAt(x, 0, size, closed);
};

const load = (nodes: unknown[]) => {
  const editor = new Editor();

  editor.getState().loadNodes(nodes as never);

  return editor;
};

const elementsFor = (editor: Editor, nodeId: string) => {
  let next = 0;
  const ids = new Map<string, string>();
  const objects = buildAppearanceObjects(
    editor.getNode(nodeId),
    editor.getNodeRenderGeometry(nodeId),
    (id) => editor.getNode(id)
  );

  return buildAppearanceElements(objects, (key) => {
    if (!ids.has(key)) {
      ids.set(key, `id${next++}`);
    }

    return ids.get(key) as string;
  });
};

const flatten = (elements: readonly SvgElement[]): SvgElement[] => {
  return elements.flatMap((element) => [
    element,
    ...flatten(element.children ?? []),
  ]);
};

// Painted paths (not definition contents) in document order.
const paintedPaths = (elements: readonly SvgElement[]) => {
  const painted: SvgElement[] = [];
  const visit = (element: SvgElement) => {
    if (
      element.tag === "defs" ||
      element.tag === "clipPath" ||
      element.tag === "mask"
    ) {
      return;
    }

    if (element.tag === "path") {
      painted.push(element);
    }

    for (const child of element.children ?? []) {
      visit(child);
    }
  };

  for (const element of elements) {
    visit(element);
  }

  return painted;
};

const byId = (elements: readonly SvgElement[], id: string) => {
  return flatten(elements).find((element) => element.attributes.id === id);
};

const refId = (value: string | undefined) => value?.match(URL_REF)?.[1];

describe("stroke alignment", () => {
  test("paints outside strokes under fills and inside strokes over them", () => {
    const editor = load([
      rect({
        fills: [solidFill("f", "#ff0000", 0.5)],
        strokes: [
          stroke("in", "inside", 4),
          stroke("out", "outside", 6),
          stroke("mid", "center", 2),
        ],
      }),
    ]);
    const painted = paintedPaths(elementsFor(editor, "rect"));

    expect(painted.map((path) => path.key.split(":")[0])).toEqual([
      "out",
      "f",
      "in",
      "mid",
    ]);

    const [outside, fill, inside, center] = painted;

    expect(outside.attributes["stroke-width"]).toBe("12");
    expect(outside.attributes.fill).toBe("none");
    expect(outside.attributes.mask).toMatch(URL_PREFIX);
    expect(inside.attributes["stroke-width"]).toBe("8");
    expect(inside.attributes["clip-path"]).toMatch(URL_PREFIX);
    expect(center.attributes["stroke-width"]).toBe("2");
    expect(center.attributes.mask ?? center.attributes["clip-path"]).toBe(
      undefined
    );
    expect(fill.attributes["fill-opacity"]).toBe("0.5");
  });

  test("updateAppearanceLayer sets a valid alignment as one undo step", () => {
    const editor = load([
      rect({ fills: [], strokes: [stroke("s", "center", 4)] }),
    ]);
    const slot = { index: 0, list: "strokes" as const };
    const align = () => editor.getNode("rect")?.appearance.strokes[0].align;

    editor.setSelectedNodes(["rect"]);
    editor.updateAppearanceLayer(slot, { align: "outside" });
    expect(align()).toBe("outside");
    editor.updateAppearanceLayer(slot, { align: "sideways" as never });
    expect(align()).toBe("outside");
    editor.undo();
    expect(align()).toBe("center");
  });

  test("only a center stroke shares its fill's element", () => {
    const paired = load([
      rect({
        fills: [solidFill("f", "#ff0000")],
        strokes: [stroke("s", "center", 2)],
      }),
    ]);
    const separate = load([
      rect({
        fills: [solidFill("f", "#ff0000")],
        strokes: [stroke("s", "inside", 2)],
      }),
    ]);

    expect(paintedPaths(elementsFor(paired, "rect"))).toHaveLength(1);
    expect(paintedPaths(elementsFor(separate, "rect"))).toHaveLength(2);
  });

  test("clips and masks honor the fill rule and cover the outside reach", () => {
    const path = withPathNodeContours(
      {
        ...createDefaultPathNode("root"),
        appearance: {
          fills: [solidFill("f", "#ff0000")],
          strokes: [stroke("in", "inside", 3), stroke("out", "outside", 5)],
        },
        fillRule: "evenodd",
        id: "ring",
      },
      [square(0, 100), square(25, 50)]
    );
    const elements = elementsFor(load([path]), "ring");
    const [outside, , inside] = paintedPaths(elements);
    const clip = byId(elements, refId(inside.attributes["clip-path"]) ?? "");
    const mask = byId(elements, refId(outside.attributes.mask) ?? "");

    expect(clip?.tag).toBe("clipPath");
    expect(clip?.children?.[0].attributes["clip-rule"]).toBe("evenodd");
    expect(clip?.children?.[0].attributes.d).toBe(inside.attributes.d);
    expect(mask?.tag).toBe("mask");
    expect(mask?.attributes).toMatchObject({
      "color-interpolation": "sRGB",
      maskContentUnits: "userSpaceOnUse",
      maskUnits: "userSpaceOnUse",
      "mask-type": "luminance",
    });

    const [reach, shape] = mask?.children ?? [];

    expect(reach.attributes.fill).toBe("#ffffff");
    expect(shape.attributes).toMatchObject({
      fill: "#000000",
      "fill-rule": "evenodd",
      stroke: "none",
    });
    // Miter joins reach up to miterLimit × w (4 × 5 = 20) past the bounds.
    expect(Number(mask?.attributes.x)).toBeLessThanOrEqual(-20);
    expect(Number(mask?.attributes.width)).toBeGreaterThanOrEqual(140);
  });

  test("open-only paths stroke on center; mixed paths align to the fill region", () => {
    const open = withPathNodeContours(
      {
        ...createDefaultPathNode("root"),
        appearance: { fills: [], strokes: [stroke("s", "outside", 4)] },
        id: "open",
      },
      [square(0, 100, false)]
    );
    const mixed = withPathNodeContours(
      {
        ...createDefaultPathNode("root"),
        appearance: { fills: [], strokes: [stroke("s", "outside", 4)] },
        id: "mixed",
      },
      [square(0, 100, false), square(200, 50)]
    );
    const editor = load([open, mixed]);
    const [openStroke] = paintedPaths(elementsFor(editor, "open"));
    const [mixedStroke] = paintedPaths(elementsFor(editor, "mixed"));

    expect(openStroke.attributes["stroke-width"]).toBe("4");
    expect(openStroke.attributes.mask).toBe(undefined);
    expect(mixedStroke.attributes["stroke-width"]).toBe("8");
    expect(mixedStroke.attributes.mask).toMatch(URL_PREFIX);
  });

  test("boolean results mask holes as holes", () => {
    const outside = {
      fills: [],
      strokes: [stroke("s", "outside", 10)],
    };
    const child = (id: string, x: number, size: number) => ({
      ...withPathNodeContours(
        { ...createDefaultPathNode("v"), id, transform: IDENTITY },
        [squareAt(x, x, size)]
      ),
      appearance: outside,
    });
    const editor = load([
      {
        id: "v",
        name: "Vector",
        opacity: 1,
        parentId: "root",
        pathComposition: "subtract",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "vector",
        visible: true,
      },
      child("outer", 0, 100),
      child("hole", 25, 50),
    ]);
    const painted = paintedPaths(elementsFor(editor, "v"));

    // One element whose mask carries both contours.
    expect(painted).toHaveLength(1);
    expect(painted[0].attributes.d.match(MOVE_COMMAND)).toHaveLength(2);
  });

  test("open and closed children of a compound can still align", () => {
    const editor = load([
      {
        id: "v",
        name: "Vector",
        opacity: 1,
        parentId: "root",
        pathComposition: "unite",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "vector",
        visible: true,
      },
      {
        ...withPathNodeContours({ ...createDefaultPathNode("v"), id: "open" }, [
          square(200, 50, false),
        ]),
        appearance: { fills: [], strokes: [stroke("s", "outside", 4)] },
      },
      {
        ...withPathNodeContours(
          { ...createDefaultPathNode("v"), id: "closed" },
          [square(0, 100)]
        ),
        appearance: { fills: [], strokes: [stroke("s", "outside", 4)] },
      },
    ]);

    expect(editor.canAlignStrokes(["closed"])).toBe(true);
  });

  test("hits around an even-odd hole follow the whole fill region", () => {
    const editor = load([
      withPathNodeContours(
        {
          ...createDefaultPathNode("root"),
          appearance: { fills: [], strokes: [stroke("s", "outside", 10)] },
          fillRule: "evenodd",
          id: "ring",
          transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        },
        [square(0, 100), square(25, 50)]
      ),
    ]);

    // Inside the material near the hole: unpainted. Inside the hole near its
    // edge: the outside ring.
    expect(editor.hitTestNodePoint("ring", { x: 17, y: 50 })).toBe(false);
    expect(editor.hitTestNodePoint("ring", { x: 33, y: 50 })).toBe(true);
  });

  test("the selection frame grows by the outside reach only", () => {
    const frameWidth = (align: "center" | "inside" | "outside") => {
      const editor = load([
        rect({ fills: [], strokes: [stroke("s", align, 10)] }),
      ]);

      return editor.getNodeRenderGeometry("rect")?.bbox.width;
    };

    expect(frameWidth("inside")).toBeCloseTo(200);
    expect(frameWidth("center")).toBeCloseTo(210);
    expect(frameWidth("outside")).toBeCloseTo(220);
  });

  test("strokes hit on the side they paint", () => {
    const hits = (align: "inside" | "outside", x: number) => {
      const editor = load([
        rect({ fills: [], strokes: [stroke("s", align, 10)] }),
      ]);

      return editor.hitTestNodePoint("rect", { x, y: 0 });
    };

    // The right edge is at x = 100; 8 units in or out is past the
    // 3-unit interaction tolerance but within the 10-unit stroke.
    expect(hits("inside", 92)).toBe(true);
    expect(hits("inside", 108)).toBe(false);
    expect(hits("outside", 108)).toBe(true);
    expect(hits("outside", 92)).toBe(false);
  });

  test("gradients on aligned strokes span the unstroked paint box", () => {
    const editor = load([
      rect({
        fills: [],
        strokes: [
          {
            ...stroke("s", "outside", 10),
            paint: {
              end: { x: 1, y: 0.5 },
              kind: "linear-gradient" as const,
              start: { x: 0, y: 0.5 },
              stops: [
                { color: "#000000", id: "a", offset: 0, opacity: 1 },
                { color: "#ffffff", id: "b", offset: 1, opacity: 1 },
              ],
            },
          },
        ],
      }),
    ]);
    const elements = elementsFor(editor, "rect");
    const gradient = flatten(elements).find(
      (element) => element.tag === "linearGradient"
    );

    expect(gradient?.attributes).toMatchObject({
      x1: "-100",
      x2: "100",
    });
    expect(paintedPaths(elements)[0].attributes.stroke).toBe(
      `url(#${gradient?.attributes.id})`
    );
  });

  test("glyph masks are sized to one glyph and shared by identical glyphs", () => {
    const editor = new Editor();
    const font = {
      family: "Arial",
      fullName: "Arial",
      postscriptName: "ArialMT",
      style: "Regular",
    } as const;

    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...font, id: "arialmt" }],
      state: "ready",
    });
    editor.fonts.cache.set(getLocalFontId(font), {
      descriptor: font,
      // Every glyph is a 40 × 100 box.
      font: {
        charToGlyph: () => ({
          advanceWidth: 500,
          getPath: (_x: number, _y: number, size: number) => ({
            commands: [
              { type: "M", x: 0, y: -0.8 * size },
              { type: "L", x: 40, y: -0.8 * size },
              { type: "L", x: 40, y: 0.2 * size },
              { type: "L", x: 0, y: 0.2 * size },
              { type: "Z" },
            ],
            toPathData: () => "M0 -80L40 -80L40 20L0 20Z",
          }),
        }),
        unitsPerEm: 1000,
      },
      status: "ready",
    } as never);
    editor.getState().loadNodes([
      {
        appearance: {
          fills: [solidFill("f", "#000000")],
          strokes: [stroke("s", "outside", 2, { join: "round" })],
        },
        font,
        fontSize: 100,
        id: "text",
        parentId: "root",
        text: "AAAAAAAAAA",
        tracking: 0,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "text",
        visible: true,
        warp: { kind: "none" },
      },
    ] as never);

    const elements = elementsFor(editor, "text");
    const masks = flatten(elements).filter((element) => element.tag === "mask");

    // Ten identical glyphs share one mask.
    expect(masks).toHaveLength(1);

    for (const mask of masks) {
      // One 40-unit glyph plus reach and slack, not the 500-unit line.
      expect(Number(mask.attributes.width)).toBeLessThan(60);
    }
  });

  test("export serializes the same clip and mask definitions", async () => {
    const editor = load([
      rect({
        fills: [solidFill("f", "#ff0000")],
        strokes: [stroke("in", "inside", 4), stroke("out", "outside", 4)],
      }),
    ]);
    const body = (await editor.exportDocument()).split("<metadata>")[0];

    expect(body).toContain("<clipPath");
    expect(body).toContain('mask-type="luminance"');
    expect(body).toMatch(EXPORT_CLIP_REF);
    expect(body).toMatch(EXPORT_MASK_REF);
  });

  test("schema 1.11 accepts alignment and 1.10 documents pass through", () => {
    expect(PUNCH_DOCUMENT_VERSION).toBe("1.11");

    const document = parseDesignDocument(
      JSON.stringify({
        assets: {},
        nodes: [
          {
            ...rect({
              fills: [],
              strokes: [stroke("s", "outside", 3)],
            }),
            parentId: "root",
          },
        ],
        version: "1.10",
      })
    );

    expect(document.version).toBe("1.11");
    expect(document.nodes[0].appearance.strokes[0].align).toBe("outside");
  });
});
