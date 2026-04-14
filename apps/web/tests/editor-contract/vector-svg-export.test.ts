import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createVectorNode = () => {
  return {
    contours: [
      {
        closed: true,
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -120, y: -90 },
            pointType: "corner" as const,
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 120, y: -90 },
            pointType: "corner" as const,
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 120, y: 90 },
            pointType: "corner" as const,
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -120, y: 90 },
            pointType: "corner" as const,
          },
        ],
      },
    ],
    fill: "rgba(255, 0, 0, 0.4)",
    fillRule: "evenodd" as const,
    id: "vector-node",
    parentId: "root",
    stroke: "rgba(0, 0, 0, 0.6)",
    strokeLineCap: "square" as const,
    strokeLineJoin: "miter" as const,
    strokeMiterLimit: 12,
    strokeWidth: 14,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 320,
      y: 220,
    },
    type: "vector" as const,
    visible: true,
  };
};

describe("vector svg export", () => {
  test("exports vector paint and stroke style attributes", async () => {
    const editor = new Editor();

    editor.getState().loadNodes([createVectorNode()]);

    const svg = await editor.exportDocument();

    expect(svg).toContain('fill="rgba(255, 0, 0, 0.4)"');
    expect(svg).toContain('stroke="rgba(0, 0, 0, 0.6)"');
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain('stroke-linecap="square"');
    expect(svg).toContain('stroke-linejoin="miter"');
    expect(svg).toContain('stroke-miterlimit="12"');
  });
});
