import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createSquarePathNode = () => ({
  closed: true,
  fill: "#111111",
  fillRule: "nonzero" as const,
  id: "square",
  parentId: "root",
  segments: [
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: -80, y: -80 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 80, y: -80 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 80, y: 80 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: -80, y: 80 },
      pointType: "corner" as const,
    },
  ],
  stroke: "#111111",
  strokeLineCap: "round" as const,
  strokeLineJoin: "round" as const,
  strokeMiterLimit: 4,
  strokeWidth: 0,
  transform: {
    rotation: 32,
    scaleX: 1.35,
    scaleY: 1.35,
    x: 458,
    y: 328,
  },
  type: "path" as const,
  visible: true,
});

describe("node geometry hit testing", () => {
  test("path hits use transformed node geometry instead of stale local bounds", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createSquarePathNode()]);

    expect(editor.hitTestNodePoint("square", { x: 377.86, y: 277.92 })).toBe(
      true
    );
    expect(editor.hitTestNodePoint("square", { x: 350, y: 220 })).toBe(false);
  });
});
