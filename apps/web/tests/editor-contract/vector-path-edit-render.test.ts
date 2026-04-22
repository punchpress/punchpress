import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

describe("vector path edit render", () => {
  test("keeps a compound vector render visible while editing a child path session", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "vector-1",
        name: "Vector",
        pathComposition: "compound-fill",
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
        fill: "#ff0000",
        fillRule: "evenodd",
        id: "path-1",
        parentId: "vector-1",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 0, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 100, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 100, y: 100 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 0, y: 100 },
            pointType: "corner",
          },
        ],
        stroke: "#111111",
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 6,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 200,
          y: 150,
        },
        type: "path",
        visible: true,
      },
      {
        closed: true,
        fill: "#ff0000",
        fillRule: "evenodd",
        id: "path-2",
        parentId: "vector-1",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 20, y: 20 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 80, y: 20 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 80, y: 80 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 20, y: 80 },
            pointType: "corner",
          },
        ],
        stroke: "#111111",
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 6,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 200,
          y: 150,
        },
        type: "path",
        visible: true,
      },
    ]);

    const before = editor.getNodeRenderGeometry("vector-1");

    expect(before?.paths).toHaveLength(1);
    expect(before?.paths[0]?.fillRule).toBe("evenodd");
    expect(before?.paths[0]?.d.match(/M/g)?.length).toBe(2);

    editor.startPathEditing("vector-1");

    const during = editor.getNodeRenderGeometry("vector-1");

    expect(editor.pathEditingNodeId).toBe("path-2");
    expect(during?.paths).toHaveLength(1);
    expect(during?.paths[0]?.fillRule).toBe("evenodd");
    expect(during?.paths[0]?.d.match(/M/g)?.length).toBe(2);
  });
});
