import { describe, expect, test } from "bun:test";
import {
  createDefaultPathNode,
  createDefaultShapeNode,
  Editor,
  withPathNodeContours,
} from "@punchpress/engine";

const fill = (color: string) => ({
  enabled: true,
  id: "fill-1",
  opacity: 1,
  paint: { color, kind: "solid" as const },
});

const stroke = (color: string, width: number) => ({
  align: "center" as const,
  cap: "round" as const,
  enabled: true,
  id: "stroke-1",
  join: "round" as const,
  miterLimit: 4,
  opacity: 1,
  paint: { color, kind: "solid" as const },
  width,
});

const stripFlatPaint = (node) => {
  const {
    fill: _fill,
    stroke: _stroke,
    strokeLineCap: _cap,
    strokeLineJoin: _join,
    strokeMiterLimit: _miter,
    strokeWidth: _width,
    ...rest
  } = node;

  return rest;
};

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

describe("appearance edits and geometry", () => {
  test("color and opacity edits reuse shape geometry; width edits rebuild it", () => {
    const editor = new Editor();
    const shape = {
      ...stripFlatPaint({ ...createDefaultShapeNode("polygon"), id: "shape" }),
      appearance: { fills: [fill("#ff0000")], strokes: [stroke("#000000", 4)] },
    };

    editor.getState().loadNodes([shape] as never);

    const geometry = editor.getNodeGeometry("shape");

    editor.updateNode("shape", {
      appearance: {
        fills: [{ ...fill("#00ff00"), opacity: 0.5 }],
        strokes: [stroke("#123456", 4)],
      },
    });
    expect(editor.getNodeGeometry("shape")).toBe(geometry);

    editor.updateNode("shape", {
      appearance: {
        fills: [fill("#00ff00")],
        strokes: [stroke("#123456", 20)],
      },
    });

    const widened = editor.getNodeGeometry("shape");

    expect(widened).not.toBe(geometry);
    expect(widened?.bbox.width).toBeCloseTo((geometry?.bbox.width ?? 0) + 16);
  });

  test("recoloring a vector child keeps the compiled vector surface", () => {
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
    const child = (id: string, x: number, color: string) => ({
      ...stripFlatPaint(
        withPathNodeContours({ ...createDefaultPathNode("vector"), id }, [
          square(x),
        ])
      ),
      appearance: { fills: [fill(color)], strokes: [] },
    });

    editor
      .getState()
      .loadNodes([
        vector,
        child("a", 0, "#ff0000"),
        child("b", 50, "#0000ff"),
      ] as never);

    const surface = editor.getNodeRenderGeometry("vector");

    editor.updateNode("b", {
      appearance: { fills: [fill("#00ff00")], strokes: [] },
    });

    expect(editor.getNodeRenderGeometry("vector")).toBe(surface);
  });
});

describe("hit testing without paint", () => {
  test("a node with every layer disabled stays clickable by its area", () => {
    const editor = new Editor();
    const shape = {
      ...stripFlatPaint({ ...createDefaultShapeNode("polygon"), id: "shape" }),
      appearance: {
        fills: [{ ...fill("#ff0000"), enabled: false }],
        strokes: [],
      },
    };

    editor.getState().loadNodes([shape] as never);

    const bounds = editor.getNodeRenderFrame("shape")?.bounds;
    const center = {
      x: ((bounds?.minX ?? 0) + (bounds?.maxX ?? 0)) / 2,
      y: ((bounds?.minY ?? 0) + (bounds?.maxY ?? 0)) / 2,
    };

    expect(editor.hitTestNodePoint("shape", center)).toBe(true);
  });
});
