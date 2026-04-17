import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const AVAILABLE_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

const createShapeNode = (id: string) => {
  return {
    cornerRadius: 24,
    fill: "#000000",
    height: 160,
    id,
    parentId: "root",
    shape: "polygon",
    stroke: null,
    strokeWidth: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 600,
      y: 450,
    },
    type: "shape",
    visible: true,
    width: 260,
  } as const;
};

const createIrregularShapeNode = (id: string) => {
  return {
    cornerRadius: 0,
    fill: "#000000",
    height: 160,
    id,
    parentId: "root",
    points: [
      { x: -130, y: 0 },
      { x: -10, y: -110 },
      { x: 110, y: -90 },
      { x: 110, y: -20 },
      { x: 10, y: 120 },
    ],
    shape: "polygon",
    stroke: null,
    strokeWidth: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 600,
      y: 450,
    },
    type: "shape",
    visible: true,
    width: 240,
  } as const;
};

const createEllipseShapeNode = (id: string) => {
  return {
    fill: "#000000",
    height: 160,
    id,
    parentId: "root",
    shape: "ellipse",
    stroke: null,
    strokeWidth: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 600,
      y: 450,
    },
    type: "shape",
    visible: true,
    width: 260,
  } as const;
};

const createTextNode = (id: string) => {
  return {
    fill: "#ffffff",
    font: AVAILABLE_FONT,
    fontSize: 320,
    id,
    parentId: "root",
    stroke: "#000000",
    strokeWidth: 12,
    text: "Hello",
    tracking: 10,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 120,
      y: 160,
    },
    type: "text",
    visible: true,
    warp: {
      kind: "none",
    },
  } as const;
};

const createGroupNode = (id: string, parentId = "root") => {
  return {
    id,
    parentId,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 0,
      y: 0,
    },
    type: "group" as const,
    visible: true,
  };
};

const createPathNode = (id: string, parentId = "root", overrides = {}) => {
  return {
    closed: true,
    fill: "rgba(255, 0, 0, 0.4)",
    fillRule: "evenodd" as const,
    id,
    parentId,
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -100, y: -80 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 100, y: -80 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 100, y: 80 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -100, y: 80 },
        pointType: "corner" as const,
      },
    ],
    stroke: "rgba(0, 0, 0, 0.6)",
    strokeLineCap: "square" as const,
    strokeLineJoin: "miter" as const,
    strokeMiterLimit: 12,
    strokeWidth: 14,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 420,
      y: 320,
    },
    type: "path" as const,
    visible: true,
    ...overrides,
  };
};

const createVectorNodes = (id: string, pathOverrides: object[] = [{}]) => {
  return [
    {
      id,
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
    ...pathOverrides.map((overrides, index) =>
      createPathNode(`${id}-path-${index + 1}`, id, overrides)
    ),
  ];
};

const createVectorWithSinglePath = (id: string, overrides = {}) => {
  return createVectorNodes(id, [overrides]);
};

const createVectorWithTwoPaths = (
  id: string,
  firstOverrides = {},
  secondOverrides = {}
) => {
  return createVectorNodes(id, [firstOverrides, secondOverrides]);
};

const createGroupedNodes = (...nodes: Record<string, unknown>[]) => {
  return [createGroupNode("group-node"), ...nodes];
};

const loadNodes = (editor: Editor, nodes: Record<string, unknown>[]) => {
  editor.getState().loadNodes(nodes as never);
};

describe("Editor selection properties", () => {
  test("exposes shape-specific and shared properties for a single shape selection", () => {
    const editor = new Editor();

    loadNodes(editor, [createShapeNode("shape-node")]);
    editor.select("shape-node");

    const selectionProperties = editor.getSelectionProperties();

    expect(selectionProperties.selectionKind).toBe("single");
    expect(Object.keys(selectionProperties.properties).sort()).toEqual([
      "cornerRadius",
      "fill",
      "height",
      "shape",
      "stroke",
      "strokeWidth",
      "width",
      "x",
      "y",
    ]);
    expect(selectionProperties.properties.cornerRadius?.value).toBe(24);
    expect(selectionProperties.properties.shape?.value).toBe("polygon");
    expect(selectionProperties.properties.width?.value).toBe(260);
    expect(selectionProperties.properties.text).toBeUndefined();
  });

  test("does not expose corner radius for a non-polygon shape", () => {
    const editor = new Editor();

    loadNodes(editor, [createEllipseShapeNode("ellipse-node")]);
    editor.select("ellipse-node");

    const selectionProperties = editor.getSelectionProperties();

    expect(selectionProperties.properties.cornerRadius).toBeUndefined();
  });

  test("exposes only shared appearance controls for a mixed text and shape selection", () => {
    const editor = new Editor();

    loadNodes(editor, [
      createTextNode("text-node"),
      createShapeNode("shape-node"),
    ]);
    editor.setSelectedNodes(["text-node", "shape-node"]);

    const selectionProperties = editor.getSelectionProperties();

    expect(selectionProperties.selectionKind).toBe("multi");
    expect(Object.keys(selectionProperties.properties).sort()).toEqual([
      "fill",
      "stroke",
      "strokeWidth",
    ]);
    expect(selectionProperties.properties.fill).toEqual({
      id: "fill",
      isMixed: true,
      value: null,
    });
    expect(selectionProperties.properties.stroke).toEqual({
      id: "stroke",
      isMixed: true,
      value: null,
    });
    expect(selectionProperties.properties.strokeWidth).toEqual({
      id: "strokeWidth",
      isMixed: true,
      value: null,
    });
    expect(selectionProperties.properties.shape).toBeUndefined();
    expect(selectionProperties.properties.text).toBeUndefined();
  });

  test("applies a shared descriptor across a mixed multi-selection", () => {
    const editor = new Editor();

    loadNodes(editor, [
      createTextNode("text-node"),
      createShapeNode("shape-node"),
    ]);
    editor.setSelectedNodes(["text-node", "shape-node"]);

    const didApply = editor.setSelectionProperty("fill", "#123456");

    expect(didApply).toBe(true);
    expect(editor.getNode("text-node")?.fill).toBe("#123456");
    expect(editor.getNode("shape-node")?.fill).toBe("#123456");
  });

  test("applies a single-node descriptor patch through transform-aware updates", () => {
    const editor = new Editor();

    loadNodes(editor, [createShapeNode("shape-node")]);
    editor.select("shape-node");

    const didApply = editor.setSelectionProperty("x", 720);

    expect(didApply).toBe(true);
    expect(editor.getNode("shape-node")?.transform.x).toBe(720);
  });

  test("applies polygon corner radius through selection properties", () => {
    const editor = new Editor();

    loadNodes(editor, [createShapeNode("shape-node")]);
    editor.select("shape-node");

    const didApply = editor.setSelectionProperty("cornerRadius", 36);

    expect(didApply).toBe(true);
    expect(editor.getNode("shape-node")).toMatchObject({
      cornerRadius: 36,
      shape: "polygon",
      type: "shape",
    });
  });

  test("clamps irregular polygon corner radius through selection properties to the shared live-shape maximum", () => {
    const editor = new Editor();

    loadNodes(editor, [createIrregularShapeNode("shape-node")]);
    editor.select("shape-node");
    const maxCornerRadius = editor.getPathCornerRadiusSummary("shape-node")?.max || 0;

    const didApply = editor.setSelectionProperty("cornerRadius", 999);
    const nextNode = editor.getNode("shape-node");
    const selectionProperties = editor.getSelectionProperties();

    expect(didApply).toBe(true);
    expect(nextNode?.type).toBe("shape");
    expect(
      nextNode?.type === "shape" ? nextNode.cornerRadius : null
    ).toBeCloseTo(maxCornerRadius, 6);
    expect(selectionProperties.properties.cornerRadius).toEqual({
      id: "cornerRadius",
      isMixed: false,
      value: maxCornerRadius,
    });
  });

  test("exposes path fill and stroke style properties for a selected single-path vector", () => {
    const editor = new Editor();

    loadNodes(editor, createVectorWithSinglePath("vector-node"));
    editor.select("vector-node");

    const selectionProperties = editor.getSelectionProperties();

    expect(Object.keys(selectionProperties.properties).sort()).toEqual([
      "fill",
      "fillRule",
      "stroke",
      "strokeLineCap",
      "strokeLineJoin",
      "strokeMiterLimit",
      "strokeWidth",
      "x",
      "y",
    ]);
    expect(selectionProperties.properties.fill?.value).toBe(
      "rgba(255, 0, 0, 0.4)"
    );
    expect(selectionProperties.properties.fillRule?.value).toBe("evenodd");
    expect(selectionProperties.properties.strokeLineCap?.value).toBe("square");
    expect(selectionProperties.properties.strokeLineJoin?.value).toBe("miter");
    expect(selectionProperties.properties.strokeMiterLimit?.value).toBe(12);
  });

  test("exposes selection colors for a selected multi-path vector", () => {
    const editor = new Editor();

    loadNodes(
      editor,
      createVectorWithTwoPaths(
        "vector-node",
        { fill: "#F63F3F", stroke: "#000000" },
        { fill: "#FFFFFF", stroke: "#F63F3F" }
      )
    );
    editor.select("vector-node");

    const selectionProperties = editor.getSelectionProperties();

    expect(selectionProperties.selectionKind).toBe("group");
    expect(selectionProperties.properties.fill).toBeUndefined();
    expect(selectionProperties.selectionColors).toEqual([
      {
        id: JSON.stringify("#F63F3F"),
        usageCount: 2,
        value: "#F63F3F",
      },
      {
        id: JSON.stringify("#000000"),
        usageCount: 1,
        value: "#000000",
      },
      {
        id: JSON.stringify("#FFFFFF"),
        usageCount: 1,
        value: "#FFFFFF",
      },
    ]);
  });

  test("applies a selection color across matching descendant fill and stroke paints for a selected group", () => {
    const editor = new Editor();

    loadNodes(
      editor,
      createGroupedNodes(
        {
          ...createShapeNode("shape-node"),
          fill: "#E81D1D",
          parentId: "group-node",
          stroke: "#0ACEFF",
        },
        {
          ...createTextNode("text-node"),
          fill: "#FFFFFF",
          parentId: "group-node",
          stroke: "#E81D1D",
        },
        {
          ...createPathNode("path-node", "group-node"),
          fill: "#6842FF",
          stroke: "#E81D1D",
        }
      )
    );
    editor.select("group-node");

    const redColorId = JSON.stringify("#E81D1D");

    expect(editor.setSelectionColor(redColorId, "#123456")).toBe(true);

    expect(editor.getNode("shape-node")).toMatchObject({
      fill: "#123456",
      stroke: "#0ACEFF",
    });
    expect(editor.getNode("text-node")).toMatchObject({
      fill: "#FFFFFF",
      stroke: "#123456",
    });
    expect(editor.getNode("path-node")).toMatchObject({
      fill: "#6842FF",
      stroke: "#123456",
    });
  });

  test("applies path stroke style descriptors across a multi-selection", () => {
    const editor = new Editor();

    loadNodes(editor, [
      createPathNode("first-path"),
      createPathNode("second-path", "root", {
        strokeLineCap: "round",
        strokeLineJoin: "bevel",
        strokeMiterLimit: 4,
      }),
    ]);
    editor.setSelectedNodes(["first-path", "second-path"]);

    expect(editor.getSelectionProperties().properties.strokeLineJoin).toEqual({
      id: "strokeLineJoin",
      isMixed: true,
      value: null,
    });

    expect(editor.setSelectionProperty("strokeLineJoin", "round")).toBe(true);
    expect(editor.setSelectionProperty("strokeMiterLimit", 18)).toBe(true);

    expect(editor.getNode("first-path")).toMatchObject({
      strokeLineJoin: "round",
      strokeMiterLimit: 18,
      type: "path",
    });
    expect(editor.getNode("second-path")).toMatchObject({
      strokeLineJoin: "round",
      strokeMiterLimit: 18,
      type: "path",
    });
  });
});
