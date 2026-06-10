import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createComposedVectorDocument = () => ({
  nodes: [
    {
      id: "vector-a",
      name: "Vector A",
      parentId: "root",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      },
      type: "vector",
      visible: true,
    },
    {
      closed: true,
      fill: "#ffffff",
      fillRule: "nonzero",
      id: "vector-a-path-1",
      parentId: "vector-a",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -120, y: -90 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 120, y: -90 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 120, y: 90 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -120, y: 90 },
          pointType: "corner",
        },
      ],
      stroke: "#000000",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 12,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 420,
        y: 280,
      },
      type: "path",
      visible: true,
    },
  ],
  version: "1.8",
});

describe("vector render surface hit testing", () => {
  test("composed vector containers hit-test painted child path pixels", () => {
    const editor = new Editor();

    editor.loadDocument(JSON.stringify(createComposedVectorDocument()));

    expect(editor.getNodeRenderFrame("vector-a")?.bounds).toMatchObject({
      maxX: 546,
      maxY: 376,
      minX: 294,
      minY: 184,
    });
    expect(editor.hitTestNodePoint("vector-a", { x: 420, y: 280 })).toBe(true);
    expect(editor.hitTestNodePoint("vector-a", { x: 600, y: 280 })).toBe(false);
  });
});
