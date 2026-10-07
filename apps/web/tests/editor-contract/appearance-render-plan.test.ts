import { describe, expect, test } from "bun:test";
import {
  buildAppearanceObjects,
  createDefaultPathNode,
  createDefaultShapeNode,
  Editor,
  getAppearanceDraws,
  getAppearancePasses,
  withPathNodeContours,
} from "@punchpress/engine";

const solidFill = (id: string, color: string, extra = {}) => ({
  enabled: true,
  id,
  opacity: 1,
  paint: { color, kind: "solid" as const },
  ...extra,
});

const solidStroke = (id: string, color: string, width: number, extra = {}) => ({
  ...solidFill(id, color),
  align: "center" as const,
  cap: "round" as const,
  join: "round" as const,
  miterLimit: 4,
  width,
  ...extra,
});

const square = (x: number, closed = true) => ({
  closed,
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

const withAppearance = (node, appearance) => {
  const {
    fill: _fill,
    stroke: _stroke,
    strokeLineCap: _cap,
    strokeLineJoin: _join,
    strokeMiterLimit: _miter,
    strokeWidth: _width,
    ...rest
  } = node;

  return { ...rest, appearance };
};

const createPath = (id: string, parentId: string, appearance, contour) => {
  return withAppearance(
    withPathNodeContours({ ...createDefaultPathNode(parentId), id }, [contour]),
    appearance
  );
};

const getObjects = (editor: Editor, nodeId: string) => {
  return buildAppearanceObjects(
    editor.getNode(nodeId),
    editor.getNodeRenderGeometry(nodeId)?.paths,
    (id) => editor.getNode(id)
  );
};

describe("appearance render plan", () => {
  test("paints enabled fills bottom-to-top, then strokes", () => {
    const editor = new Editor();
    const shape = withAppearance(
      { ...createDefaultShapeNode("polygon"), id: "shape" },
      {
        fills: [
          solidFill("f1", "#ff0000"),
          solidFill("f2", "#00ff00", { enabled: false }),
          solidFill("f3", "#0000ff", { opacity: 0.5 }),
        ],
        strokes: [
          solidStroke("s1", "#000000", 0),
          solidStroke("s2", "#111111", 6, { opacity: 0 }),
          solidStroke("s3", "#222222", 4),
        ],
      }
    );

    editor.getState().loadNodes([shape] as never);

    const [object] = getObjects(editor, "shape");

    expect(object.opacity).toBe(1);
    expect(object.draws.map((draw) => [draw.kind, draw.layerId])).toEqual([
      ["fill", "f1"],
      ["fill", "f3"],
      ["stroke", "s3"],
    ]);
  });

  test("a fill directly followed by a stroke shares one paint pass", () => {
    const fill = solidFill("f", "#ff0000");
    const draws = getAppearanceDraws({
      fills: [solidFill("a", "#00ff00"), fill],
      strokes: [
        solidStroke("s1", "#000000", 2),
        solidStroke("s2", "#111111", 1),
      ],
    });
    const pair = getAppearancePasses(draws, true);

    expect(
      pair.map((pass) => [
        pass.fill?.layerId ?? null,
        pass.stroke?.layerId ?? null,
      ])
    ).toEqual([
      ["a", null],
      ["f", "s1"],
      [null, "s2"],
    ]);
    expect(getAppearancePasses(draws, false)).toHaveLength(4);
  });

  test("vector children paint with their own stacks and opacity", () => {
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
    const red = createPath(
      "red",
      "vector",
      { fills: [solidFill("f", "#ff0000")], strokes: [] },
      square(0)
    );
    const blue = {
      ...createPath(
        "blue",
        "vector",
        { fills: [solidFill("f", "#0000ff")], strokes: [] },
        square(200)
      ),
      opacity: 0.25,
    };

    editor.getState().loadNodes([vector, red, blue] as never);

    const objects = getObjects(editor, "vector");

    expect(
      objects.map((object) => [object.styleNodeId, object.opacity])
    ).toEqual([
      ["red", 1],
      ["blue", 0.25],
    ]);
    expect(objects[1].draws[0]).toMatchObject({ color: "#0000ff" });
  });

  test("compound vectors paint the compiled result with the last child stack", () => {
    const editor = new Editor();
    const vector = {
      id: "vector",
      name: "Vector",
      opacity: 1,
      parentId: "root",
      pathComposition: "unite",
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      type: "vector",
      visible: true,
    };
    const first = createPath(
      "first",
      "vector",
      { fills: [solidFill("f", "#ff0000")], strokes: [] },
      square(0)
    );
    const last = createPath(
      "last",
      "vector",
      {
        fills: [solidFill("f", "#00aa00")],
        strokes: [solidStroke("s", "#000000", 3)],
      },
      square(50)
    );

    editor.getState().loadNodes([vector, first, last] as never);

    const objects = getObjects(editor, "vector");

    expect(objects).toHaveLength(1);
    expect(objects[0].styleNodeId).toBe("last");
    expect(objects[0].draws.map((draw) => draw.color)).toEqual([
      "#00aa00",
      "#000000",
    ]);
  });

  test("open contours fill with SVG implicit closure, matching the canvas", () => {
    const editor = new Editor();
    const path = withPathNodeContours(
      {
        ...createDefaultPathNode("root"),
        fill: "#ff0000",
        id: "open",
        stroke: "#000000",
        strokeWidth: 2,
      },
      [square(0, false)]
    );

    editor.getState().loadNodes([path] as never);

    const svg = editor.exportDocument();

    return svg.then((markup) => {
      const body = markup.split("<metadata>")[0];

      expect(body).toContain('fill="#ff0000"');
      expect(body).toContain('stroke="#000000"');
    });
  });

  test("plans are reused until the node or its geometry changes", () => {
    const editor = new Editor();
    const shape = withAppearance(
      { ...createDefaultShapeNode("ellipse"), id: "shape" },
      { fills: [solidFill("f", "#ff0000")], strokes: [] }
    );
    const other = withAppearance(
      { ...createDefaultShapeNode("ellipse"), id: "other" },
      { fills: [solidFill("f", "#ff0000")], strokes: [] }
    );

    editor.getState().loadNodes([shape, other] as never);

    const before = getObjects(editor, "shape");

    editor.updateNode("other", { opacity: 0.5 });
    expect(getObjects(editor, "shape")).toBe(before);

    editor.updateNode("shape", {
      appearance: { fills: [solidFill("f", "#0000ff")], strokes: [] },
    });
    expect(getObjects(editor, "shape")[0].draws[0]).toMatchObject({
      color: "#0000ff",
    });
  });

  test("export wraps node opacity times ancestor opacity once", async () => {
    const editor = new Editor();
    const group = {
      id: "group",
      name: "Group",
      opacity: 0.5,
      parentId: "root",
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      type: "group",
      visible: true,
    };
    const shape = {
      ...createDefaultShapeNode("polygon"),
      fill: "#ff0000",
      id: "shape",
      opacity: 0.5,
      parentId: "group",
      stroke: "#000000",
      strokeWidth: 4,
    };

    editor.getState().loadNodes([group, shape] as never);

    const body = (await editor.exportDocument()).split("<metadata>")[0];

    expect(body).toContain('<g opacity="0.25"><path');
    expect(body.match(/opacity="/g)).toHaveLength(1);
  });
});
