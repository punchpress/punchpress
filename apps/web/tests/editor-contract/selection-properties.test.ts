import { describe, expect, test } from "bun:test";
import {
  createDefaultImageNode,
  createSolidAppearance,
  Editor,
  getNodeWorldPoint,
} from "@punchpress/engine";

const AVAILABLE_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

const createShapeNode = (id: string) => {
  return {
    cornerRadius: 24,
    appearance: createSolidAppearance({ fill: "#000000" }),
    height: 160,
    id,
    parentId: "root",
    shape: "polygon",
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
    appearance: createSolidAppearance({ fill: "#000000" }),
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
    appearance: createSolidAppearance({ fill: "#000000" }),
    height: 160,
    id,
    parentId: "root",
    shape: "ellipse",
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

const createStarShapeNode = (id: string) => {
  return {
    cornerRadius: 18,
    appearance: createSolidAppearance({ fill: "#000000" }),
    height: 200,
    id,
    parentId: "root",
    shape: "star",
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 600,
      y: 450,
    },
    type: "shape",
    visible: true,
    width: 200,
  } as const;
};

const createTextNode = (id: string) => {
  return {
    appearance: createSolidAppearance({
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 12,
    }),
    font: AVAILABLE_FONT,
    fontSize: 320,
    id,
    parentId: "root",
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

const createImageNode = (id: string) => {
  return {
    ...createDefaultImageNode({
      height: 120,
      name: "Layer",
      src: "data:image/png;base64,test",
      width: 240,
    }),
    id,
    transform: {
      rotation: 32,
      scaleX: 1,
      scaleY: 1,
      x: 420,
      y: 280,
    },
  } as const;
};

const getImageWorldCenter = (node: ReturnType<typeof createImageNode>) => {
  return getNodeWorldPoint(
    node,
    {
      height: node.height,
      maxX: node.width,
      maxY: node.height,
      minX: 0,
      minY: 0,
      width: node.width,
    },
    { x: node.width / 2, y: node.height / 2 }
  );
};

const createArtboardNode = (id: string) => {
  return {
    background: "#ffffff",
    height: 5400,
    id,
    locked: false,
    name: "Artboard 1",
    parentId: "root",
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 100,
      y: 120,
    },
    type: "artboard" as const,
    visible: true,
    width: 4500,
  };
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

const createPathAppearance = (
  paint: Parameters<typeof createSolidAppearance>[0] = {}
) => {
  return createSolidAppearance({
    cap: "square",
    fill: "rgba(255, 0, 0, 0.4)",
    join: "miter",
    miterLimit: 12,
    stroke: "rgba(0, 0, 0, 0.6)",
    strokeWidth: 14,
    ...paint,
  });
};

const createPathNode = (id: string, parentId = "root", overrides = {}) => {
  return {
    appearance: createPathAppearance(),
    closed: true,
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

const getPaintColors = (node) => {
  return {
    fill: node?.appearance?.fills[0]?.paint.color ?? null,
    stroke: node?.appearance?.strokes[0]?.paint.color ?? null,
  };
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
      "appearance",
      "cornerRadius",
      "height",
      "opacity",
      "shape",
      "width",
      "x",
      "y",
    ]);
    expect(selectionProperties.properties.appearance?.value).toEqual(
      createSolidAppearance({ fill: "#000000" })
    );
    expect(selectionProperties.properties.cornerRadius?.value).toBe(24);
    expect(selectionProperties.properties.shape?.value).toBe("polygon");
    expect(selectionProperties.properties.width?.value).toBe(260);
    expect(selectionProperties.properties.text).toBeUndefined();
  });

  test("exposes size and background properties for a single artboard selection", () => {
    const editor = new Editor();

    loadNodes(editor, [createArtboardNode("artboard-node")]);
    editor.select("artboard-node");

    const selectionProperties = editor.getSelectionProperties();

    expect(selectionProperties.selectionKind).toBe("single");
    expect(Object.keys(selectionProperties.properties).sort()).toEqual([
      "background",
      "height",
      "width",
    ]);
    expect(selectionProperties.properties.background).toEqual({
      id: "background",
      isMixed: false,
      value: "#ffffff",
    });
    expect(selectionProperties.properties.width?.value).toBe(4500);
    expect(selectionProperties.properties.height?.value).toBe(5400);
  });

  test("applies artboard size and background through selection properties", () => {
    const editor = new Editor();

    loadNodes(editor, [createArtboardNode("artboard-node")]);
    editor.select("artboard-node");

    expect(editor.setSelectionProperty("width", 3200)).toBe(true);
    expect(editor.setSelectionProperty("height", 2400)).toBe(true);
    expect(editor.setSelectionProperty("background", "#f6d365")).toBe(true);

    expect(editor.getNode("artboard-node")).toMatchObject({
      background: "#f6d365",
      height: 2400,
      type: "artboard",
      width: 3200,
    });
  });

  test("resizes a rotated image around its center through selection properties", () => {
    const editor = new Editor();

    loadNodes(editor, [createImageNode("image-node")]);
    editor.select("image-node");

    const beforeNode = editor.getNode("image-node");
    if (!beforeNode || beforeNode.type !== "image") {
      throw new Error("Expected image node");
    }
    const beforeCenter = getImageWorldCenter(beforeNode);

    expect(editor.setSelectionProperty("height", 240)).toBe(true);
    const afterHeightNode = editor.getNode("image-node");
    if (!afterHeightNode || afterHeightNode.type !== "image") {
      throw new Error("Expected image node");
    }
    const afterHeightCenter = getImageWorldCenter(afterHeightNode);

    expect(afterHeightNode.width).toBe(240);
    expect(afterHeightNode.height).toBe(240);
    expect(afterHeightNode.baseWidth).toBe(240);
    expect(afterHeightNode.baseHeight).toBe(240);
    expect(afterHeightNode.transform.rotation).toBe(32);
    expect(afterHeightCenter.x).toBeCloseTo(beforeCenter.x, 2);
    expect(afterHeightCenter.y).toBeCloseTo(beforeCenter.y, 2);

    expect(editor.setSelectionProperty("width", 360)).toBe(true);
    const afterWidthNode = editor.getNode("image-node");
    if (!afterWidthNode || afterWidthNode.type !== "image") {
      throw new Error("Expected image node");
    }
    const afterWidthCenter = getImageWorldCenter(afterWidthNode);

    expect(afterWidthNode.width).toBe(360);
    expect(afterWidthNode.height).toBe(240);
    expect(afterWidthNode.baseWidth).toBe(360);
    expect(afterWidthNode.baseHeight).toBe(240);
    expect(afterWidthNode.transform.rotation).toBe(32);
    expect(afterWidthCenter.x).toBeCloseTo(beforeCenter.x, 2);
    expect(afterWidthCenter.y).toBeCloseTo(beforeCenter.y, 2);
  });

  test("does not expose corner radius for a non-polygon shape", () => {
    const editor = new Editor();

    loadNodes(editor, [createEllipseShapeNode("ellipse-node")]);
    editor.select("ellipse-node");

    const selectionProperties = editor.getSelectionProperties();

    expect(selectionProperties.properties.cornerRadius).toBeUndefined();
  });

  test("exposes corner radius for a star shape selection", () => {
    const editor = new Editor();

    loadNodes(editor, [createStarShapeNode("star-node")]);
    editor.select("star-node");

    const selectionProperties = editor.getSelectionProperties();

    expect(selectionProperties.properties.cornerRadius?.value).toBe(18);
    expect(selectionProperties.properties.shape?.value).toBe("star");
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
      "appearance",
      "opacity",
    ]);
    expect(selectionProperties.properties.appearance).toEqual({
      id: "appearance",
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

    const didApply = editor.updateAppearanceLayer(
      { index: 0, list: "fills" },
      { color: "#123456" }
    );

    expect(didApply).toBe(true);
    expect(getPaintColors(editor.getNode("text-node")).fill).toBe("#123456");
    expect(getPaintColors(editor.getNode("shape-node")).fill).toBe("#123456");
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

  test("clamps shape corner radius when switching shape type", () => {
    const editor = new Editor();

    loadNodes(editor, [createShapeNode("shape-node")]);
    editor.select("shape-node");
    const polygonMax =
      editor.getPathCornerRadiusSummary("shape-node")?.max || 0;

    expect(editor.setSelectionProperty("cornerRadius", 999)).toBe(true);
    expect(editor.setSelectionProperty("shape", "star")).toBe(true);

    const nextNode = editor.getNode("shape-node");
    const nextSummary = editor.getPathCornerRadiusSummary("shape-node");

    expect(nextNode?.type).toBe("shape");
    expect(nextNode?.type === "shape" ? nextNode.shape : null).toBe("star");
    expect(nextSummary?.max).toBeGreaterThan(0);
    expect(nextSummary?.max).toBeLessThan(polygonMax);
    expect(nextSummary?.isMixed).toBe(false);
    expect(nextSummary?.value).toBe(nextSummary?.max);
    expect(
      nextNode?.type === "shape" ? nextNode.cornerRadius : null
    ).toBeCloseTo(nextSummary?.max || 0, 6);
  });

  test("clamps irregular polygon corner radius through selection properties to the shared live-shape maximum", () => {
    const editor = new Editor();

    loadNodes(editor, [createIrregularShapeNode("shape-node")]);
    editor.select("shape-node");
    const maxCornerRadius =
      editor.getPathCornerRadiusSummary("shape-node")?.max || 0;

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

  test("exposes path fill and stroke style properties for a selected standalone path", () => {
    const editor = new Editor();

    loadNodes(editor, [createPathNode("path-node")]);
    editor.select("path-node");

    const selectionProperties = editor.getSelectionProperties();

    expect(Object.keys(selectionProperties.properties).sort()).toEqual([
      "appearance",
      "fillRule",
      "opacity",
      "x",
      "y",
    ]);
    expect(selectionProperties.properties.fillRule?.value).toBe("evenodd");
    expect(selectionProperties.properties.appearance?.value).toMatchObject({
      fills: [{ opacity: 0.4, paint: { color: "#ff0000", kind: "solid" } }],
      strokes: [
        {
          cap: "square",
          join: "miter",
          miterLimit: 12,
          opacity: 0.6,
          paint: { color: "#000000", kind: "solid" },
          width: 14,
        },
      ],
    });
  });

  test("exposes selection colors for a selected multi-path vector", () => {
    const editor = new Editor();

    loadNodes(
      editor,
      createVectorWithTwoPaths(
        "vector-node",
        {
          appearance: createPathAppearance({
            fill: "#F63F3F",
            stroke: "#000000",
          }),
        },
        {
          appearance: createPathAppearance({
            fill: "#FFFFFF",
            stroke: "#F63F3F",
          }),
        }
      )
    );
    editor.select("vector-node");

    const selectionProperties = editor.getSelectionProperties();

    expect(selectionProperties.selectionKind).toBe("group");
    expect(Object.keys(selectionProperties.properties).sort()).toEqual([
      "appearance",
      "fillRule",
    ]);
    expect(selectionProperties.properties.appearance?.isMixed).toBe(true);
    expect(selectionProperties.properties.fillRule?.value).toBe("evenodd");
    expect(selectionProperties.selectionColors).toEqual([
      {
        fieldId: "vector-node-path-1:fills.fill-1",
        id: JSON.stringify("#f63f3f"),
        usageCount: 2,
        value: "#f63f3f",
      },
      {
        fieldId: "vector-node-path-1:strokes.stroke-1",
        id: JSON.stringify("#000000"),
        usageCount: 1,
        value: "#000000",
      },
      {
        fieldId: "vector-node-path-2:fills.fill-1",
        id: JSON.stringify("#ffffff"),
        usageCount: 1,
        value: "#ffffff",
      },
    ]);
  });

  test("applies aggregate path appearance properties for a selected multi-path vector", () => {
    const editor = new Editor();

    loadNodes(
      editor,
      createVectorWithTwoPaths(
        "vector-node",
        {
          appearance: createPathAppearance({
            cap: "round",
            fill: "#F63F3F",
            join: "round",
            miterLimit: 6,
            stroke: "#000000",
            strokeWidth: 10,
          }),
        },
        {
          appearance: createPathAppearance({
            cap: "round",
            fill: "#FFFFFF",
            join: "round",
            miterLimit: 6,
            stroke: "#F63F3F",
            strokeWidth: 10,
          }),
        }
      )
    );
    editor.select("vector-node");

    const strokeSlot = { index: 0, list: "strokes" } as const;

    expect(editor.updateAppearanceLayer(strokeSlot, { cap: "square" })).toBe(
      true
    );
    expect(editor.updateAppearanceLayer(strokeSlot, { join: "bevel" })).toBe(
      true
    );
    expect(editor.updateAppearanceLayer(strokeSlot, { width: 22 })).toBe(true);

    for (const nodeId of ["vector-node-path-1", "vector-node-path-2"]) {
      expect(editor.getNode(nodeId)?.appearance?.strokes).toMatchObject([
        { cap: "square", join: "bevel", miterLimit: 6, width: 22 },
      ]);
    }
    expect(getPaintColors(editor.getNode("vector-node-path-2")).stroke).toBe(
      "#f63f3f"
    );
  });

  test("applies a selection color across matching descendant fill and stroke paints for a selected group", () => {
    const editor = new Editor();

    loadNodes(
      editor,
      createGroupedNodes(
        {
          ...createShapeNode("shape-node"),
          appearance: createSolidAppearance({
            fill: "#E81D1D",
            stroke: "#0ACEFF",
            strokeWidth: 4,
          }),
          parentId: "group-node",
        },
        {
          ...createTextNode("text-node"),
          appearance: createSolidAppearance({
            fill: "#FFFFFF",
            stroke: "#E81D1D",
            strokeWidth: 12,
          }),
          parentId: "group-node",
        },
        {
          ...createPathNode("path-node", "group-node"),
          appearance: createPathAppearance({
            fill: "#6842FF",
            stroke: "#E81D1D",
          }),
        }
      )
    );
    editor.select("group-node");

    const redColorId = JSON.stringify("#e81d1d");

    expect(editor.setSelectionColor(redColorId, "#123456")).toBe(true);

    expect(getPaintColors(editor.getNode("shape-node"))).toEqual({
      fill: "#123456",
      stroke: "#0aceff",
    });
    expect(getPaintColors(editor.getNode("text-node"))).toEqual({
      fill: "#ffffff",
      stroke: "#123456",
    });
    expect(getPaintColors(editor.getNode("path-node"))).toEqual({
      fill: "#6842ff",
      stroke: "#123456",
    });
  });

  test("previews a selection color across matching descendants before committing", () => {
    const editor = new Editor();

    loadNodes(
      editor,
      createGroupedNodes(
        {
          ...createShapeNode("shape-node"),
          appearance: createSolidAppearance({
            fill: "#E81D1D",
            stroke: "#0ACEFF",
            strokeWidth: 4,
          }),
          parentId: "group-node",
        },
        {
          ...createPathNode("path-node", "group-node"),
          appearance: createPathAppearance({
            fill: "#6842FF",
            stroke: "#E81D1D",
          }),
        }
      )
    );
    editor.select("group-node");

    const redColorId = JSON.stringify("#e81d1d");
    const session = editor.beginSelectionColorChange(redColorId);

    expect(session).not.toBeNull();
    expect(editor.updateSelectionColorChange(session, "#123456")).toBe(true);
    expect(
      editor.getSelectionColorPreviewValue(
        "shape-node",
        "fills.fill-1",
        "#e81d1d"
      )
    ).toBe("#123456");
    expect(
      editor.getSelectionColorPreviewValue(
        "shape-node",
        "strokes.stroke-1",
        "#0aceff"
      )
    ).toBe("#0aceff");
    expect(getPaintColors(editor.getNode("shape-node"))).toEqual({
      fill: "#e81d1d",
      stroke: "#0aceff",
    });
    expect(getPaintColors(editor.getNode("path-node"))).toEqual({
      fill: "#6842ff",
      stroke: "#e81d1d",
    });

    expect(editor.commitSelectionColorChange(session, "#123456")).toBe(true);
    expect(getPaintColors(editor.getNode("shape-node"))).toEqual({
      fill: "#123456",
      stroke: "#0aceff",
    });
    expect(getPaintColors(editor.getNode("path-node"))).toEqual({
      fill: "#6842ff",
      stroke: "#123456",
    });
  });

  test("includes artboard backgrounds in selection colors", () => {
    const editor = new Editor();

    loadNodes(editor, [
      createArtboardNode("artboard-node"),
      {
        ...createShapeNode("shape-node"),
        appearance: createSolidAppearance({
          fill: "#ffffff",
          stroke: "#000000",
          strokeWidth: 4,
        }),
        parentId: "artboard-node",
      },
    ]);
    editor.select("artboard-node");

    const whiteColorId = JSON.stringify("#ffffff");
    const selectionProperties = editor.getSelectionProperties();

    expect(selectionProperties.selectionColors).toEqual([
      {
        fieldId: "artboard-node:background",
        id: whiteColorId,
        usageCount: 2,
        value: "#ffffff",
      },
      {
        fieldId: "shape-node:strokes.stroke-1",
        id: JSON.stringify("#000000"),
        usageCount: 1,
        value: "#000000",
      },
    ]);

    expect(editor.setSelectionColor(whiteColorId, "#123456")).toBe(true);
    expect(editor.getNode("artboard-node")).toMatchObject({
      background: "#123456",
    });
    expect(getPaintColors(editor.getNode("shape-node"))).toEqual({
      fill: "#123456",
      stroke: "#000000",
    });
  });

  test("applies path stroke style descriptors across a multi-selection", () => {
    const editor = new Editor();

    loadNodes(editor, [
      createPathNode("first-path"),
      createPathNode("second-path", "root", {
        appearance: createPathAppearance({
          cap: "round",
          join: "bevel",
          miterLimit: 4,
        }),
      }),
    ]);
    editor.setSelectedNodes(["first-path", "second-path"]);

    expect(editor.getSelectionProperties().properties.appearance).toEqual({
      id: "appearance",
      isMixed: true,
      value: null,
    });

    const strokeSlot = { index: 0, list: "strokes" } as const;

    expect(editor.updateAppearanceLayer(strokeSlot, { join: "round" })).toBe(
      true
    );
    expect(editor.updateAppearanceLayer(strokeSlot, { miterLimit: 18 })).toBe(
      true
    );

    expect(editor.getNode("first-path")).toMatchObject({
      appearance: {
        strokes: [{ cap: "square", join: "round", miterLimit: 18 }],
      },
      type: "path",
    });
    expect(editor.getNode("second-path")).toMatchObject({
      appearance: {
        strokes: [{ cap: "round", join: "round", miterLimit: 18 }],
      },
      type: "path",
    });
  });
});
