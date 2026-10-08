import { describe, expect, test } from "bun:test";
import {
  createDefaultPathNode,
  createSolidAppearance,
  Editor,
  withPathNodeContours,
} from "@punchpress/engine";

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

const loadPaths = () => {
  const editor = new Editor();
  const path = (id: string) =>
    withPathNodeContours(
      {
        ...createDefaultPathNode("root"),
        appearance: createSolidAppearance({
          fill: "#ff0000",
          stroke: "#000000",
          strokeWidth: 4,
        }),
        id,
      },
      [square(0), square(200)]
    );

  editor.getState().loadNodes([path("moved"), path("other")] as never);

  return editor;
};

describe("path geometry reuse", () => {
  test("moving and recoloring reuse geometry; width and contours rebuild it", () => {
    const editor = loadPaths();
    const geometry = editor.getNodeGeometry("moved");
    const otherGeometry = editor.getNodeGeometry("other");

    editor.updateNode("moved", { transform: { x: 50, y: 25 } });
    expect(editor.getNodeGeometry("moved")).toBe(geometry);
    expect(editor.getNodeGeometry("other")).toBe(otherGeometry);

    editor.updateNode("moved", (node) => ({
      appearance: {
        ...node.appearance,
        fills: [{ ...node.appearance.fills[0], opacity: 0.5 }],
      },
    }));
    expect(editor.getNodeGeometry("moved")).toBe(geometry);

    editor.updateNode("moved", (node) => ({
      appearance: {
        ...node.appearance,
        strokes: [{ ...node.appearance.strokes[0], width: 20 }],
      },
    }));

    const widened = editor.getNodeGeometry("moved");

    expect(widened).not.toBe(geometry);

    editor.updateNode("moved", { contours: [square(0)] });
    expect(editor.getNodeGeometry("moved")).not.toBe(widened);
    expect(editor.getNodeGeometry("other")).toBe(otherGeometry);
  });

  test("a font revision change re-signs every node", () => {
    const editor = loadPaths();
    const geometry = editor.getNodeGeometry("other");

    editor.getState().bumpFontRevision();

    const rebuilt = editor.getNodeGeometry("other");

    expect(rebuilt).not.toBe(geometry);
    expect(rebuilt?.bbox).toEqual(geometry?.bbox);
  });
});
