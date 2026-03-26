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
    fill: "#000000",
    height: 160,
    id,
    parentId: "root",
    shape: "rectangle",
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

describe("Editor selection properties", () => {
  test("exposes shape-specific and shared properties for a single shape selection", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createShapeNode("shape-node")]);
    editor.select("shape-node");

    const selectionProperties = editor.getSelectionProperties();

    expect(selectionProperties.selectionKind).toBe("single");
    expect(Object.keys(selectionProperties.properties).sort()).toEqual([
      "fill",
      "height",
      "shape",
      "stroke",
      "strokeWidth",
      "width",
      "x",
      "y",
    ]);
    expect(selectionProperties.properties.shape?.value).toBe("rectangle");
    expect(selectionProperties.properties.width?.value).toBe(260);
    expect(selectionProperties.properties.text).toBeUndefined();
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
});
