import { describe, expect, test } from "bun:test";
import { Editor, getDefaultWarp } from "@punchpress/engine";
import {
  createLocalFontDescriptor,
  getLocalFontId,
  MissingDocumentFontsError,
} from "@punchpress/punch-schema";

const AVAILABLE_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

const MISSING_FONT = {
  family: "Missing Font",
  fullName: "Missing Font",
  postscriptName: "MissingFont-Regular",
  style: "Regular",
} as const;

const createDocument = (
  id: string,
  text: string,
  font = MISSING_FONT,
  version = "1.1"
) => {
  return JSON.stringify({
    nodes: [
      {
        fill: "#000000",
        fontSize: 120,
        font,
        id,
        stroke: null,
        strokeWidth: 0,
        text,
        tracking: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 100,
          y: 200,
        },
        type: "text",
        visible: true,
        warp: {
          kind: "none",
        },
      },
    ],
    version,
  });
};

const createCircleDocument = (id: string, pathPosition?: number) => {
  return JSON.stringify({
    nodes: [
      {
        fill: "#000000",
        font: AVAILABLE_FONT,
        fontSize: 120,
        id,
        parentId: "root",
        stroke: null,
        strokeWidth: 0,
        text: "CIRCLE",
        tracking: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 100,
          y: 200,
        },
        type: "text",
        visible: true,
        warp: {
          kind: "circle",
          ...(pathPosition === undefined ? {} : { pathPosition }),
          radius: 900,
          sweepDeg: 140,
        },
      },
    ],
    version: "1.3",
  });
};

const createFakeLoadedFont = () => {
  return {
    charToGlyph: () => ({
      advanceWidth: 800,
      getPath: (_x: number, _y: number, fontSize: number) => {
        const scale = fontSize / 100;

        return {
          commands: [
            { type: "M", x: 0, y: -260 * scale },
            { type: "L", x: 50 * scale, y: -260 * scale },
            { type: "L", x: 50 * scale, y: 40 * scale },
            { type: "L", x: 0, y: 40 * scale },
            { type: "Z" },
          ],
          toPathData: () => "",
        };
      },
    }),
    unitsPerEm: 1000,
  };
};

describe("Editor.loadDocument", () => {
  test("replaces the current document and clears transient selection state", () => {
    const editor = new Editor();

    editor.loadDocument(createDocument("first-node", "FIRST", AVAILABLE_FONT));
    editor.select("first-node");
    editor.addTextNode({ x: 320, y: 240 });

    expect(editor.nodes).toHaveLength(2);
    expect(editor.selectedNodeIds.length).toBeGreaterThan(0);

    editor.loadDocument(
      createDocument("second-node", "SECOND", AVAILABLE_FONT)
    );

    expect(
      editor.nodes.map((node) => ({
        id: node.id,
        text: node.text,
      }))
    ).toEqual([
      {
        id: "second-node",
        text: "SECOND",
      },
    ]);
    expect(editor.getNode("first-node")).toBeNull();
    expect(editor.selectedNodeIds).toEqual([]);
    expect(editor.selectedNodeId).toBeNull();
  });

  test("replaces missing fonts with the resolved default font on import", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });

    const resolution = editor.loadDocument(
      createDocument("missing-font-node", "TEST")
    );

    expect(resolution.missingFonts).toEqual([MISSING_FONT]);
    expect(resolution.replacementFont).toEqual(AVAILABLE_FONT);
    expect(editor.nodes[0]?.font).toEqual(AVAILABLE_FONT);
  });

  test("fills in the default circle path position when older documents omit it", () => {
    const editor = new Editor();

    editor.loadDocument(createCircleDocument("circle-node"));

    expect(editor.nodes[0]?.warp).toEqual({
      kind: "circle",
      pathPosition: 0,
      radius: 900,
      sweepDeg: 140,
    });
  });
});

describe("Editor.exportDocument", () => {
  test("throws a missing-font error before export when a node uses an unavailable font", async () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });
    editor.getState().loadNodes([
      {
        fill: "#000000",
        font: MISSING_FONT,
        fontSize: 120,
        id: "missing-font-node",
        stroke: null,
        strokeWidth: 0,
        text: "TEST",
        tracking: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 100,
          y: 200,
        },
        type: "text",
        visible: true,
        warp: {
          kind: "none",
        },
      },
    ]);

    await expect(editor.exportDocument()).rejects.toThrow(
      MissingDocumentFontsError
    );
  });
});

describe("Editor.getSelectionFrameKey", () => {
  test("updates the selection frame key when selected text geometry changes", () => {
    const editor = new Editor();

    editor.loadDocument(createDocument("selected-node", "HEYHEYHEYHEY"));
    editor.select("selected-node");

    const beforeKey = editor.getSelectionFrameKey();

    editor.updateSelectedNode({ text: "HEY" });

    expect(editor.getSelectionFrameKey()).not.toBe(beforeKey);
  });
});

describe("Editor.getNodeTransformFrame", () => {
  test("bakes vector scale into overlay bounds instead of scaling the transform wrapper", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        contours: [
          {
            closed: true,
            segments: [
              {
                handleIn: { x: 0, y: 0 },
                handleOut: { x: 0, y: 0 },
                point: { x: -100, y: -60 },
              },
              {
                handleIn: { x: 0, y: 0 },
                handleOut: { x: 0, y: 0 },
                point: { x: 100, y: -60 },
              },
              {
                handleIn: { x: 0, y: 0 },
                handleOut: { x: 0, y: 0 },
                point: { x: 100, y: 60 },
              },
              {
                handleIn: { x: 0, y: 0 },
                handleOut: { x: 0, y: 0 },
                point: { x: -100, y: 60 },
              },
            ],
          },
        ],
        fill: "#ffffff",
        fillRule: "nonzero",
        id: "scaled-vector-node",
        parentId: "root",
        stroke: null,
        strokeWidth: 0,
        transform: {
          rotation: 30,
          scaleX: 2,
          scaleY: 0.5,
          x: 100,
          y: 200,
        },
        type: "vector",
        visible: true,
      },
    ]);

    expect(editor.getNodeTransformFrame("scaled-vector-node")).toEqual({
      bounds: {
        height: 60,
        maxX: 300,
        maxY: 230,
        minX: -100,
        minY: 170,
        width: 400,
      },
      transform: "rotate(30deg)",
    });
  });

  test("uses the same overlay-frame normalization for scaled text nodes", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        fill: "#000000",
        font: AVAILABLE_FONT,
        fontSize: 120,
        id: "scaled-text-node",
        parentId: "root",
        stroke: null,
        strokeWidth: 0,
        text: "TEST",
        tracking: 0,
        transform: {
          rotation: 20,
          scaleX: 1.5,
          scaleY: 0.75,
          x: 100,
          y: 200,
        },
        type: "text",
        visible: true,
        warp: {
          kind: "none",
        },
      },
    ]);

    const frame = editor.getNodeTransformFrame("scaled-text-node");

    expect(frame?.transform).toBe("rotate(20deg)");
  });
});

describe("Editor vector resize behavior", () => {
  test("keeps vector stroke width stable while object resize changes transform scale", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        contours: [
          {
            closed: true,
            segments: [
              {
                handleIn: { x: 0, y: 0 },
                handleOut: { x: 0, y: 0 },
                point: { x: -100, y: -60 },
              },
              {
                handleIn: { x: 0, y: 0 },
                handleOut: { x: 0, y: 0 },
                point: { x: 100, y: -60 },
              },
              {
                handleIn: { x: 0, y: 0 },
                handleOut: { x: 0, y: 0 },
                point: { x: 100, y: 60 },
              },
              {
                handleIn: { x: 0, y: 0 },
                handleOut: { x: 0, y: 0 },
                point: { x: -100, y: 60 },
              },
            ],
          },
        ],
        fill: "#ffffff",
        fillRule: "nonzero",
        id: "vector-resize-node",
        parentId: "root",
        stroke: "#000000",
        strokeWidth: 12,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 100,
          y: 200,
        },
        type: "vector",
        visible: true,
      },
    ]);

    editor.select("vector-resize-node");
    editor.resizeSelectionFromCorner({
      corner: "se",
      scale: 1.5,
    });

    expect(editor.getNode("vector-resize-node")).toMatchObject({
      strokeWidth: 12,
      transform: {
        scaleX: 1.5,
        scaleY: 1.5,
      },
      type: "vector",
    });
  });
});

describe("Editor text editing mode", () => {
  test("uses the updated default wave warp preset", () => {
    expect(getDefaultWarp("wave")).toEqual({
      amplitude: 140,
      cycles: 1,
      kind: "wave",
    });
  });

  test("uses the slant warp preset", () => {
    expect(getDefaultWarp("slant")).toEqual({
      kind: "slant",
      rise: -120,
    });
  });

  test("creates new text nodes without a default warp", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });

    editor.addTextNode({ x: 320, y: 240 });

    expect(editor.selectedNode?.warp).toEqual({
      kind: "none",
    });
  });

  test("centers new text nodes on the requested point", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });

    const defaultFont = createLocalFontDescriptor(editor.getDefaultFont());
    editor.fonts.cache.set(getLocalFontId(defaultFont), {
      descriptor: defaultFont,
      font: createFakeLoadedFont(),
      status: "ready",
    });

    const point = { x: 320, y: 240 };

    editor.addTextNode(point);

    const frame = editor.selectedNodeId
      ? editor.getNodeRenderFrame(editor.selectedNodeId)
      : null;
    const centerX = frame ? (frame.bounds.minX + frame.bounds.maxX) / 2 : null;
    const centerY = frame ? (frame.bounds.minY + frame.bounds.maxY) / 2 : null;

    expect(frame).not.toBeNull();
    expect(centerX).toBeCloseTo(point.x, 2);
    expect(centerY).toBeCloseTo(point.y, 2);
  });

  test("switches back to the pointer tool when placing a text node", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });

    editor.setActiveTool("text");
    editor.addTextNode({ x: 320, y: 240 });

    expect(editor.activeTool).toBe("pointer");
    expect(editor.editingNodeId).not.toBeNull();
    expect(editor.selectedNodeIds).toEqual([editor.editingNodeId]);
    expect(editor.selectedNode?.warp).toEqual({
      kind: "none",
    });
  });

  test("switches back to the pointer tool when placing a shape node", () => {
    const editor = new Editor();

    editor.setNextShapeKind("ellipse");
    editor.setActiveTool("shape");
    editor.addShapeNode({ x: 320, y: 240 });

    expect(editor.activeTool).toBe("pointer");
    expect(editor.editingNodeId).toBeNull();
    expect(editor.selectedNodeIds).toEqual([editor.selectedNodeId]);
    expect(editor.getNode(editor.selectedNodeId)).toMatchObject({
      shape: "ellipse",
      type: "shape",
    });
  });

  test("switches back to the pointer tool when placing a vector node with the pen tool", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    const session = editor.dispatchCanvasPointerDown({
      point: { x: 420, y: 180 },
    });

    expect(session).not.toBeNull();

    session?.complete({
      dragDistancePx: 0,
      point: { x: 420, y: 180 },
    });

    expect(editor.activeTool).toBe("pointer");
    expect(editor.editingNodeId).toBeNull();
    expect(editor.selectedNodeIds).toEqual([editor.selectedNodeId]);
    expect(editor.getNode(editor.selectedNodeId)).toMatchObject({
      type: "vector",
    });
    expect(editor.getNode(editor.selectedNodeId)?.transform).toMatchObject({
      x: 420,
      y: 180,
    });
  });

  test("places a default vector with corner anchor points", () => {
    const editor = new Editor();

    editor.addVectorNode({ x: 420, y: 180 });

    expect(editor.selectedNode).toMatchObject({
      type: "vector",
    });
    expect(
      editor.selectedNode?.contours[0]?.segments.map((segment) => segment.point)
    ).toEqual([
      { x: -120, y: -90 },
      { x: 120, y: -90 },
      { x: 120, y: 90 },
      { x: -120, y: 90 },
    ]);
  });

  test("keeps the pointer tool active when opening an existing text node for editing", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });
    editor.loadDocument(createDocument("editing-node", "EDIT", AVAILABLE_FONT));
    editor.setActiveTool("text");

    editor.startEditing(editor.getNode("editing-node"));

    expect(editor.activeTool).toBe("pointer");
    expect(editor.editingNodeId).toBe("editing-node");
  });
});

describe("Editor shape export", () => {
  test("exports visible shape nodes without requiring fonts", async () => {
    const editor = new Editor();

    editor.setNextShapeKind("star");
    editor.addShapeNode({ x: 480, y: 360 });

    const svg = await editor.exportDocument();

    expect(svg).toContain("<path");
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('"shape":"star"');
  });

  test("exports visible vector nodes without requiring fonts", async () => {
    const editor = new Editor();

    editor.addVectorNode({ x: 480, y: 360 });

    const svg = await editor.exportDocument();

    expect(svg).toContain("<path");
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('"type":"vector"');
  });
});

describe("Editor.getDebugDump", () => {
  test("returns a normalized snapshot of document, node, and selection state", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });
    editor.loadDocument(createDocument("debug-node", "DEBUG", AVAILABLE_FONT));
    editor.select("debug-node");

    const dump = editor.getDebugDump();

    expect(dump.bootstrap.fontCatalogState).toBe("ready");
    expect(dump.document.nodeCount).toBe(1);
    expect(dump.document.version).toBe("1.4");
    expect(dump.nodes).toHaveLength(1);
    expect(dump.nodes[0]?.id).toBe("debug-node");
    expect(dump.nodes[0]?.text).toBe("DEBUG");
    expect(dump.nodes[0]?.transform).toEqual({
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 100,
      y: 200,
    });
    expect(dump.nodes[0]?.frame).not.toBeNull();
    expect(dump.selection.ids).toEqual(["debug-node"]);
    expect(dump.selection.primaryId).toBe("debug-node");
    expect(dump.selection.bounds?.minX).toBeCloseTo(
      dump.nodes[0]?.frame?.bounds.minX ?? 0,
      6
    );
    expect(dump.selection.bounds?.minY).toBeCloseTo(
      dump.nodes[0]?.frame?.bounds.minY ?? 0,
      6
    );
    expect(dump.selection.bounds?.maxX).toBeCloseTo(
      dump.nodes[0]?.frame?.bounds.maxX ?? 0,
      6
    );
    expect(dump.selection.bounds?.maxY).toBeCloseTo(
      dump.nodes[0]?.frame?.bounds.maxY ?? 0,
      6
    );
    expect(dump.selection.handleRects).toEqual({
      ne: null,
      nw: null,
      se: null,
      sw: null,
    });
  });

  test("does not finalize editing when producing the dump", () => {
    const editor = new Editor();
    editor.loadDocument(
      createDocument("editing-node", "ORIGINAL", AVAILABLE_FONT)
    );

    editor.startEditing(editor.getNode("editing-node"));
    editor.setEditingText("WORK IN PROGRESS");

    const dump = editor.getDebugDump();

    expect(editor.editingNodeId).toBe("editing-node");
    expect(dump.editing.nodeId).toBe("editing-node");
    expect(dump.editing.text).toBe("WORK IN PROGRESS");
    expect(JSON.parse(dump.document.serialized).nodes[0]?.text).toBe(
      "WORK IN PROGRESS"
    );
  });
});
