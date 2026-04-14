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

const createVectorNode = (id: string, overrides = {}) => {
  return {
    contours: [
      {
        closed: true,
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
      },
    ],
    fill: "rgba(255, 0, 0, 0.4)",
    fillRule: "evenodd" as const,
    id,
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
      x: 420,
      y: 320,
    },
    type: "vector" as const,
    visible: true,
    ...overrides,
  };
};

describe("Editor selection properties", () => {
  test("exposes shape-specific and shared properties for a single shape selection", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createShapeNode("shape-node")]);
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

    editor.getState().loadNodes([createEllipseShapeNode("ellipse-node")]);
    editor.select("ellipse-node");

    const selectionProperties = editor.getSelectionProperties();

    expect(selectionProperties.properties.cornerRadius).toBeUndefined();
  });

  test("exposes only shared appearance properties for a text and shape multi-selection", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([createTextNode("text-node"), createShapeNode("shape-node")]);
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

    editor
      .getState()
      .loadNodes([createTextNode("text-node"), createShapeNode("shape-node")]);
    editor.setSelectedNodes(["text-node", "shape-node"]);

    const didApply = editor.setSelectionProperty("fill", "#123456");

    expect(didApply).toBe(true);
    expect(editor.getNode("text-node")?.fill).toBe("#123456");
    expect(editor.getNode("shape-node")?.fill).toBe("#123456");
  });

  test("applies a single-node descriptor patch through transform-aware updates", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createShapeNode("shape-node")]);
    editor.select("shape-node");

    const didApply = editor.setSelectionProperty("x", 720);

    expect(didApply).toBe(true);
    expect(editor.getNode("shape-node")?.transform.x).toBe(720);
  });

  test("applies polygon corner radius through selection properties", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createShapeNode("shape-node")]);
    editor.select("shape-node");

    const didApply = editor.setSelectionProperty("cornerRadius", 36);

    expect(didApply).toBe(true);
    expect(editor.getNode("shape-node")).toMatchObject({
      cornerRadius: 36,
      shape: "polygon",
      type: "shape",
    });
  });

  test("exposes vector fill and stroke style properties for a single vector selection", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createVectorNode("vector-node")]);
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

  test("applies vector stroke style descriptors across a multi-selection", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      createVectorNode("first-vector"),
      createVectorNode("second-vector", {
        strokeLineCap: "round",
        strokeLineJoin: "bevel",
        strokeMiterLimit: 4,
      }),
    ]);
    editor.setSelectedNodes(["first-vector", "second-vector"]);

    expect(editor.getSelectionProperties().properties.strokeLineJoin).toEqual({
      id: "strokeLineJoin",
      isMixed: true,
      value: null,
    });

    expect(editor.setSelectionProperty("strokeLineJoin", "round")).toBe(true);
    expect(editor.setSelectionProperty("strokeMiterLimit", 18)).toBe(true);

    expect(editor.getNode("first-vector")).toMatchObject({
      strokeLineJoin: "round",
      strokeMiterLimit: 18,
      type: "vector",
    });
    expect(editor.getNode("second-vector")).toMatchObject({
      strokeLineJoin: "round",
      strokeMiterLimit: 18,
      type: "vector",
    });
  });
});
