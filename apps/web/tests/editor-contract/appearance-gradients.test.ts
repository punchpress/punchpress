import { describe, expect, test } from "bun:test";
import {
  buildAppearanceObjects,
  createDefaultNode,
  createDefaultPathNode,
  createDefaultShapeNode,
  createSolidAppearance,
  Editor,
  insertGradientStop,
  resolveDrawPaint,
  sampleGradient,
  withPathNodeContours,
} from "@punchpress/engine";
import {
  DEFAULT_LOCAL_FONT,
  linearGradientPaintSchema,
  PUNCH_DOCUMENT_VERSION,
  parseDesignDocument,
} from "@punchpress/punch-schema";

const gradient = (overrides = {}) => ({
  end: { x: 1, y: 0.5 },
  kind: "linear-gradient" as const,
  start: { x: 0, y: 0.5 },
  stops: [
    { color: "#000000", id: "s1", offset: 0, opacity: 1 },
    { color: "#ffffff", id: "s2", offset: 1, opacity: 1 },
  ],
  ...overrides,
});

const gradientShape = (id: string, paint = gradient(), extra = {}) => ({
  ...createDefaultShapeNode("polygon"),
  appearance: {
    fills: [{ enabled: true, id: "fill-1", opacity: 1, paint }],
    strokes: [],
  },
  height: 100,
  id,
  width: 200,
  ...extra,
});

const getObjects = (editor: Editor, nodeId: string) => {
  return buildAppearanceObjects(
    editor.getNode(nodeId),
    editor.getNodeRenderGeometry(nodeId),
    (id) => editor.getNode(id)
  );
};

describe("linear gradients", () => {
  test("schema requires sorted stops with unique ids; 1.9 documents pass through", () => {
    expect(linearGradientPaintSchema.safeParse(gradient()).success).toBe(true);
    expect(
      linearGradientPaintSchema.safeParse(
        gradient({
          stops: [
            { color: "#000000", id: "a", offset: 0.8, opacity: 1 },
            { color: "#ffffff", id: "a", offset: 0.2, opacity: 1 },
          ],
        })
      ).success
    ).toBe(false);

    const document = parseDesignDocument(
      JSON.stringify({ assets: {}, nodes: [], version: "1.9" })
    );

    expect(document.version).toBe(PUNCH_DOCUMENT_VERSION);
  });

  test("gradients map through the paint box in user space", () => {
    const editor = new Editor();

    editor.getState().loadNodes([gradientShape("g")] as never);

    const [object] = getObjects(editor, "g");
    const resolved = resolveDrawPaint(
      object,
      object.draws[0],
      object.paths[0],
      (key) => `id-${key.length}`
    );

    expect(object.paintBox).toMatchObject({
      height: 100,
      minX: -100,
      minY: -50,
      width: 200,
    });
    expect(resolved.def).toMatchObject({
      transform: null,
      x1: -100,
      x2: 100,
      y1: 0,
      y2: 0,
    });
    expect(resolved.value).toBe(`url(#${resolved.def?.id})`);
  });

  test("a zero-length gradient paints its last stop with that stop's opacity", () => {
    const editor = new Editor();
    const paint = gradient({
      end: { x: 0.5, y: 0.5 },
      start: { x: 0.5, y: 0.5 },
      stops: [
        { color: "#000000", id: "s1", offset: 0, opacity: 1 },
        { color: "#ff0000", id: "s2", offset: 1, opacity: 0.5 },
      ],
    });

    editor.getState().loadNodes([gradientShape("g", paint)] as never);

    const [object] = getObjects(editor, "g");
    const resolved = resolveDrawPaint(
      object,
      object.draws[0],
      object.paths[0],
      String
    );

    expect(resolved).toEqual({ def: null, opacity: 0.5, value: "#ff0000" });
  });

  test("glyph paths undo their layout so one ramp spans the whole text", () => {
    const editor = new Editor();
    const text = {
      ...createDefaultNode(DEFAULT_LOCAL_FONT),
      appearance: {
        fills: [{ enabled: true, id: "fill-1", opacity: 1, paint: gradient() }],
        strokes: [],
      },
      id: "t",
      text: "AB",
    };

    editor.getState().loadNodes([text] as never);

    const fakeGeometry = {
      paintBox: {
        height: 10,
        maxX: 100,
        maxY: 10,
        minX: 0,
        minY: 0,
        width: 100,
      },
      paths: [
        {
          d: "M0 0 L10 0 L10 10 Z",
          key: "glyph-0",
          layoutMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          transform: "translate(0 0)",
        },
        {
          d: "M0 0 L10 0 L10 10 Z",
          key: "glyph-1",
          layoutMatrix: { a: 1, b: 0, c: 0, d: 1, e: 60, f: 0 },
          transform: "translate(60 0)",
        },
      ],
    };
    const [object] = buildAppearanceObjects(
      editor.getNode("t"),
      fakeGeometry,
      () => null
    );
    const second = resolveDrawPaint(
      object,
      object.draws[0],
      object.paths[1],
      (key) => key
    );

    expect(object.paintSpace).toBe("node");
    expect(second.def?.transform).toBe("matrix(1 0 0 1 -60 0)");
    expect(second.def?.x1).toBe(0);
    expect(second.def?.x2).toBe(100);
  });

  test("solid ↔ linear conversion and angle are engine commands", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        ...createDefaultShapeNode("polygon"),
        appearance: createSolidAppearance({ fill: "#ff0000" }),
        height: 100,
        id: "s",
        width: 200,
      },
    ] as never);
    editor.setSelectedNodes(["s"]);
    editor.setPaintKind({ index: 0, list: "fills" }, "linear-gradient");

    const fill = () => editor.getNode("s")?.appearance.fills[0];

    expect(fill().paint).toMatchObject({
      kind: "linear-gradient",
      stops: [
        { color: "#ff0000", offset: 0, opacity: 1 },
        { color: "#ff0000", offset: 1, opacity: 0 },
      ],
    });
    expect(editor.getGradientAngle({ index: 0, list: "fills" })).toBe(0);

    editor.setGradientAngle({ index: 0, list: "fills" }, 45);
    expect(editor.getGradientAngle({ index: 0, list: "fills" })).toBeCloseTo(
      45
    );

    editor.updateAppearanceLayer({ index: 0, list: "fills" }, { opacity: 0.5 });
    editor.setPaintKind({ index: 0, list: "fills" }, "solid");
    expect(fill()).toMatchObject({
      opacity: 0.5,
      paint: { color: "#ff0000", kind: "solid" },
    });
  });

  test("compound results measure the angle through the compiled result", () => {
    const editor = new Editor();
    const square = (id: string, x: number) =>
      withPathNodeContours({ ...createDefaultPathNode("vector"), id }, [
        {
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
        },
      ]);
    const last = {
      ...square("last", 100),
      appearance: {
        fills: [{ enabled: true, id: "f", opacity: 1, paint: gradient() }],
        strokes: [],
      },
    };

    editor.getState().loadNodes([
      {
        id: "vector",
        name: "Vector",
        opacity: 1,
        parentId: "root",
        pathComposition: "unite",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "vector",
        visible: true,
      },
      square("first", 0),
      last,
    ] as never);
    editor.setSelectedNodes(["last"]);
    editor.setGradientAngle({ index: 0, list: "fills" }, 45);

    const [object] = getObjects(editor, "vector");
    const { paint } = editor.getNode("last").appearance.fills[0];
    const box = object.paintBox;
    const dx = (paint.end.x - paint.start.x) * box.width;
    const dy = (paint.end.y - paint.start.y) * box.height;

    expect(box.width).toBeCloseTo(200);
    expect((Math.atan2(dy, dx) * 180) / Math.PI).toBeCloseTo(45);
    expect(editor.getGradientAngle({ index: 0, list: "fills" })).toBeCloseTo(
      45
    );
  });

  test("paint patches are normalized: clamped, sorted, ids kept or allocated", () => {
    const editor = new Editor();

    editor.getState().loadNodes([gradientShape("g")] as never);
    editor.setSelectedNodes(["g"]);
    editor.updateAppearanceLayer(
      { index: 0, list: "fills" },
      {
        paint: gradient({
          stops: [
            { color: "#FFFFFF", id: "s2", offset: 2, opacity: 1 },
            { color: "#000000", id: "", offset: -1, opacity: 4 },
          ],
        }),
      }
    );

    expect(editor.getNode("g")?.appearance.fills[0].paint.stops).toEqual([
      { color: "#000000", id: "stop-2", offset: 0, opacity: 1 },
      { color: "#ffffff", id: "s2", offset: 1, opacity: 1 },
    ]);
    expect(
      editor.updateAppearanceLayer(
        { index: 0, list: "fills" },
        { color: "#00ff00" }
      )
    ).toBe(false);
  });

  test("inserting a stop samples the ramp so the gradient looks unchanged", () => {
    const inserted = insertGradientStop(gradient(), 0.5);

    expect(inserted?.stops[1]).toMatchObject({
      color: "#808080",
      offset: 0.5,
      opacity: 1,
    });
    expect(sampleGradient(gradient(), 0.25).color).toBe("#404040");
  });

  test("a stop inserted outside the ramp copies the nearest end stop", () => {
    const inset = gradient({
      stops: [
        { color: "#ff0000", id: "s1", offset: 0.2, opacity: 1 },
        { color: "#0000ff", id: "s2", offset: 0.8, opacity: 0.5 },
      ],
    });

    expect(sampleGradient(inset, 0.9)).toEqual({
      color: "#0000ff",
      opacity: 0.5,
    });
    expect(sampleGradient(inset, 0.1)).toEqual({
      color: "#ff0000",
      opacity: 1,
    });
    expect(insertGradientStop(inset, 0.9)?.stops[2]).toMatchObject({
      color: "#0000ff",
      offset: 0.9,
    });
  });

  test("selection colors edit stops, and the preview targets only the field", () => {
    const editor = new Editor();
    const twoReds = gradient({
      stops: [
        { color: "#ff0000", id: "s1", offset: 0, opacity: 1 },
        { color: "#ff0000", id: "s2", offset: 1, opacity: 0.5 },
      ],
    });

    editor
      .getState()
      .loadNodes([gradientShape("a", twoReds), gradientShape("b")] as never);

    const colors = editor.getSelectionPropertiesSnapshot(["a", "b"])
      .selectionProperties.selectionColors;
    const opaqueRed = colors.find((color) => color.value === "#ff0000");
    const session = editor.beginSelectionColorChange(opaqueRed?.id, ["a", "b"]);

    editor.updateSelectionColorChange(session, "#00ff00");

    const previewStops =
      editor.getPaintNode("a").appearance.fills[0].paint.stops;

    expect(previewStops.map((stop) => stop.color)).toEqual([
      "#00ff00",
      "#ff0000",
    ]);
    expect(editor.getNode("a")?.appearance.fills[0].paint.stops[0].color).toBe(
      "#ff0000"
    );

    editor.commitSelectionColorChange(session, "#00ff00");
    expect(
      editor.getNode("a")?.appearance.fills[0].paint.stops.map((s) => s.color)
    ).toEqual(["#00ff00", "#ff0000"]);
  });

  test("export allocates unique gradient ids across the document", async () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      gradientShape("a"),
      gradientShape("b", gradient(), {
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 400, y: 0 },
      }),
    ] as never);

    const body = (await editor.exportDocument()).split("<metadata>")[0];
    const ids = [...body.matchAll(/<linearGradient id="([^"]+)"/g)].map(
      (match) => match[1]
    );
    const refs = [...body.matchAll(/url\(#([^)]+)\)/g)].map(
      (match) => match[1]
    );

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(new Set(refs)).toEqual(new Set(ids));
    expect(body).toContain('gradientUnits="userSpaceOnUse"');
  });
});
