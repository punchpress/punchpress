import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createCompoundVectorNodes = () => {
  return [
    {
      id: "vector-node",
      name: "Vector",
      pathComposition: "compound-fill" as const,
      parentId: "root",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      },
      type: "vector" as const,
      visible: true,
    },
    {
      closed: true,
      fill: "#000000",
      fillRule: "evenodd" as const,
      id: "vector-node-path-1",
      parentId: "vector-node",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -120, y: -120 },
          pointType: "corner" as const,
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 120, y: -120 },
          pointType: "corner" as const,
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 120, y: 120 },
          pointType: "corner" as const,
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -120, y: 120 },
          pointType: "corner" as const,
        },
      ],
      stroke: null,
      strokeLineCap: "butt" as const,
      strokeLineJoin: "miter" as const,
      strokeMiterLimit: 4,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 320,
        y: 220,
      },
      type: "path" as const,
      visible: true,
    },
    {
      closed: true,
      fill: "#000000",
      fillRule: "evenodd" as const,
      id: "vector-node-path-2",
      parentId: "vector-node",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -60, y: -60 },
          pointType: "corner" as const,
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 60, y: -60 },
          pointType: "corner" as const,
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 60, y: 60 },
          pointType: "corner" as const,
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -60, y: 60 },
          pointType: "corner" as const,
        },
      ],
      stroke: null,
      strokeLineCap: "butt" as const,
      strokeLineJoin: "miter" as const,
      strokeMiterLimit: 4,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 320,
        y: 220,
      },
      type: "path" as const,
      visible: true,
    },
  ];
};

describe("vector compound path rendering", () => {
  test("renders and exports sibling compound contours as one painted path", async () => {
    const editor = new Editor();

    editor.getState().loadNodes(createCompoundVectorNodes() as never);

    const geometry = editor.getNodeRenderGeometry("vector-node");
    const svg = await editor.exportDocument();

    expect(geometry?.paths).toHaveLength(1);
    expect(geometry?.paths[0]).toMatchObject({
      fill: "#000000",
      fillRule: "evenodd",
    });
    expect(geometry?.paths[0]?.d.match(/M/g)?.length).toBe(2);
    expect(svg.match(/<path /g)?.length).toBe(1);
    expect(svg).toContain('fill-rule="evenodd"');
  });

  test("updates compound render geometry live while preview-dragging one child path", () => {
    const editor = new Editor();

    editor.getState().loadNodes(createCompoundVectorNodes() as never);

    const beforeGeometry = editor.getNodeRenderGeometry("vector-node");

    editor.setSelectionDragPreview({
      delta: { x: 80, y: 40 },
      nodeIds: ["vector-node-path-2"],
    });

    const previewGeometry = editor.getNodeRenderGeometry("vector-node");

    expect(beforeGeometry?.paths).toHaveLength(1);
    expect(previewGeometry?.paths).toHaveLength(1);
    expect(previewGeometry?.paths[0]?.d).not.toBe(beforeGeometry?.paths[0]?.d);
    expect(previewGeometry?.bbox).not.toEqual(beforeGeometry?.bbox);
  });

  test("reuses the compiled vector surface when the render inputs have not changed", () => {
    const editor = new Editor();
    let compileCount = 0;

    editor.getState().loadNodes(createCompoundVectorNodes() as never);
    editor.vectorRenderSurfaces.buildSurface = () => {
      compileCount += 1;

      return {
        bbox: {
          height: 240,
          maxX: 440,
          maxY: 340,
          minX: 200,
          minY: 100,
          width: 240,
        },
        guide: null,
        paths: [],
        ready: true,
        selectionBounds: {
          height: 240,
          maxX: 440,
          maxY: 340,
          minX: 200,
          minY: 100,
          width: 240,
        },
      };
    };

    editor.getNodeRenderGeometry("vector-node");
    editor.getNodeRenderGeometry("vector-node");
    editor.getNodeRenderGeometry("vector-node");

    expect(compileCount).toBe(1);
  });

  test("keeps whole-vector drag preview on the shell path without recompiling compound geometry", () => {
    const editor = new Editor();
    let compileCount = 0;

    editor.getState().loadNodes(createCompoundVectorNodes() as never);
    editor.vectorRenderSurfaces.buildSurface = () => {
      compileCount += 1;

      return {
        bbox: {
          height: 240,
          maxX: 440,
          maxY: 340,
          minX: 200,
          minY: 100,
          width: 240,
        },
        guide: null,
        paths: [],
        ready: true,
        selectionBounds: {
          height: 240,
          maxX: 440,
          maxY: 340,
          minX: 200,
          minY: 100,
          width: 240,
        },
      };
    };

    editor.getNodeRenderGeometry("vector-node");
    editor.setSelectionDragPreview({
      delta: { x: 40, y: 20 },
      nodeIds: ["vector-node-path-1", "vector-node-path-2"],
    });
    editor.getNodeRenderGeometry("vector-node");

    expect(compileCount).toBe(1);
  });

  test("recompiles a compound vector only when preview changes the internal child arrangement", () => {
    const editor = new Editor();
    let compileCount = 0;

    editor.getState().loadNodes(createCompoundVectorNodes() as never);
    editor.vectorRenderSurfaces.buildSurface = () => {
      compileCount += 1;

      return {
        bbox: {
          height: 240,
          maxX: 440,
          maxY: 340,
          minX: 200,
          minY: 100,
          width: 240,
        },
        guide: null,
        paths: [],
        ready: true,
        selectionBounds: {
          height: 240,
          maxX: 440,
          maxY: 340,
          minX: 200,
          minY: 100,
          width: 240,
        },
      };
    };

    editor.getNodeRenderGeometry("vector-node");
    editor.setSelectionDragPreview({
      delta: { x: 40, y: 20 },
      nodeIds: ["vector-node-path-2"],
    });
    editor.getNodeRenderGeometry("vector-node");
    editor.getNodeRenderGeometry("vector-node");
    editor.setSelectionDragPreview({
      delta: { x: 44, y: 24 },
      nodeIds: ["vector-node-path-2"],
    });
    editor.getNodeRenderGeometry("vector-node");

    expect(compileCount).toBe(3);
  });
});
