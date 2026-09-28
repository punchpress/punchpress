import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import {
  createPunchPackage,
  DEFAULT_LOCAL_FONT,
  loadPunchPackageContents,
  PUNCH_DOCUMENT_VERSION,
  parseDesignDocument,
} from "@punchpress/punch-schema";
import { readZipArchive } from "../../../../../packages/punch-schema/src/zip";

const PNG_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lhL1WQAAAABJRU5ErkJggg==";
const CURRENT_RASTER_SRC = "data:image/png,current-raster-state";
const UNDONE_RASTER_SRC = "data:image/png,undone-raster-state";
const textDecoder = new TextDecoder();

const transform = (x: number, y: number, rotation = 0) => ({
  rotation,
  scaleX: 1,
  scaleY: 1,
  x,
  y,
});

const rectangleContour = (width: number, height: number) => ({
  closed: true,
  segments: [
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 0, y: 0 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: width, y: 0 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: width, y: height },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 0, y: height },
      pointType: "corner" as const,
    },
  ],
});

const createPathNode = (id: string, parentId: string, fill: string) => ({
  contours: [rectangleContour(90, 60)],
  fill,
  fillRule: "evenodd" as const,
  id,
  opacity: 0.8,
  parentId,
  stroke: "#111111",
  strokeLineCap: "round" as const,
  strokeLineJoin: "bevel" as const,
  strokeMiterLimit: 8,
  strokeWidth: 3,
  transform: transform(20, 30, 8),
  type: "path" as const,
  visible: true,
});

const createLayerRoundTripNodes = () => [
  {
    background: "#f8f8f8",
    height: 900,
    id: "artboard-layer",
    locked: false,
    name: "Artboard Layer",
    opacity: 1,
    parentId: "root",
    transform: transform(100, 120),
    type: "artboard" as const,
    visible: true,
    width: 1200,
  },
  {
    id: "empty-layer",
    name: "Empty Layer",
    opacity: 1,
    parentId: "root",
    type: "empty" as const,
    visible: true,
  },
  {
    id: "group-layer",
    name: "Group Layer",
    opacity: 0.92,
    parentId: "root",
    transform: transform(40, 55, -6),
    type: "group" as const,
    visible: true,
  },
  {
    fill: "#202020",
    font: DEFAULT_LOCAL_FONT,
    fontSize: 72,
    id: "text-layer",
    opacity: 1,
    parentId: "group-layer",
    stroke: "#ffffff",
    strokeWidth: 2,
    text: "Punch",
    tracking: 14,
    transform: transform(12, 18, 4),
    type: "text" as const,
    visible: true,
    warp: {
      amplitude: 8,
      cycles: 2,
      kind: "wave" as const,
    },
  },
  {
    cornerRadii: [4, 8, 12, 16],
    fill: "#ffcc00",
    height: 180,
    id: "shape-layer",
    opacity: 0.75,
    parentId: "artboard-layer",
    points: [
      { x: -90, y: -60 },
      { x: 90, y: -60 },
      { x: 90, y: 60 },
      { x: -90, y: 60 },
    ],
    shape: "polygon" as const,
    stroke: "#222222",
    strokeWidth: 6,
    transform: transform(320, 260, 15),
    type: "shape" as const,
    visible: false,
    width: 240,
  },
  {
    assetId: "asset_image_layer",
    height: 64,
    id: "image-layer",
    mimeType: "image/png" as const,
    name: "Image Layer",
    opacity: 0.65,
    parentId: "root",
    src: PNG_SRC,
    transform: transform(500, 360, 22),
    type: "image" as const,
    visible: true,
    width: 128,
  },
  {
    id: "vector-layer",
    name: "Vector Layer",
    opacity: 0.87,
    parentId: "root",
    pathComposition: "compound-fill" as const,
    transform: transform(720, 180, 11),
    type: "vector" as const,
    visible: true,
  },
  createPathNode("vector-child-path", "vector-layer", "#00aaff"),
  createPathNode("standalone-path-layer", "root", "#aa00ff"),
];

const getLayerSignature = (
  nodes: ReturnType<typeof createLayerRoundTripNodes>
) =>
  nodes.map((node) => ({
    id: node.id,
    parentId: node.parentId,
    type: node.type,
    visible: node.visible,
  }));

const createHistoryRasterNode = (src: string) => ({
  assetId: "asset_history_image",
  height: 24,
  id: "history-image-layer",
  mimeType: "image/png" as const,
  name: "History Image Layer",
  opacity: 1,
  parentId: "root",
  src,
  transform: transform(40, 60),
  type: "image" as const,
  visible: true,
  width: 32,
});

const getPackagedRasterState = (packageBytes: Uint8Array) => {
  const entries = readZipArchive(packageBytes);
  const packagedDocumentBytes = entries.get("document.json");

  if (!packagedDocumentBytes) {
    throw new Error("Expected packaged document.json");
  }

  const packagedDocument = parseDesignDocument(
    textDecoder.decode(packagedDocumentBytes)
  );
  const rasterEntries = [...entries.keys()].filter((path) =>
    path.startsWith("assets/raster/")
  );
  const rasterBytes = entries.get("assets/raster/asset_history_image.png");

  if (!rasterBytes) {
    throw new Error("Expected packaged history raster asset");
  }

  return {
    document: packagedDocument,
    rasterEntries,
    rasterPayload: textDecoder.decode(rasterBytes),
  };
};

describe(".punch layer persistence", () => {
  test("round-trips every layer source kind through packaged save and load", () => {
    const editor = new Editor();
    editor.getState().loadNodes(createLayerRoundTripNodes());

    const beforeDocument = editor.getDocument();
    const packageBytes = createPunchPackage(editor.serializeDocument());
    const hydratedContents = loadPunchPackageContents(packageBytes);
    const reloadedEditor = new Editor();

    reloadedEditor.loadDocument(hydratedContents);
    const afterDocument = reloadedEditor.getDocument();

    expect(getLayerSignature(afterDocument.nodes)).toEqual(
      getLayerSignature(beforeDocument.nodes)
    );
    expect(afterDocument).toEqual(beforeDocument);
  });

  test("stores image bytes as package raster assets without inline document sources", () => {
    const editor = new Editor();
    editor.getState().loadNodes(createLayerRoundTripNodes());

    const packageBytes = createPunchPackage(editor.serializeDocument());
    const entries = readZipArchive(packageBytes);
    const packagedDocumentBytes = entries.get("document.json");

    if (!packagedDocumentBytes) {
      throw new Error("Expected packaged document.json");
    }

    const packagedDocument = parseDesignDocument(
      new TextDecoder().decode(packagedDocumentBytes)
    );
    const packagedImageNode = packagedDocument.nodes.find(
      (node) => node.id === "image-layer"
    );

    expect(packagedImageNode?.type).toBe("image");
    if (packagedImageNode?.type !== "image") {
      throw new Error("Expected packaged image node");
    }
    expect(packagedImageNode.src).toBeUndefined();
    expect(packagedImageNode.mimeType).toBeUndefined();
    expect(packagedDocument.assets.asset_image_layer).toMatchObject({
      currentMimeType: "image/png",
      kind: "raster",
      ref: "assets/raster/asset_image_layer.png",
      storage: "single",
    });
    expect(entries.has("assets/raster/asset_image_layer.png")).toBe(true);
  });

  test("stores encoded Raster sample dimensions independently from resized geometry", () => {
    const editor = new Editor();
    const image = createLayerRoundTripNodes().find(
      (node) => node.id === "image-layer"
    );

    if (image?.type !== "image") {
      throw new Error("Expected image layer");
    }

    editor.getState().loadNodes([
      {
        ...image,
        baseHeight: 120,
        baseWidth: 160,
        height: 120,
        pixelHeight: 1,
        pixelWidth: 1,
        src: PNG_SRC,
        width: 160,
      },
    ]);
    const entries = readZipArchive(
      createPunchPackage(editor.serializeDocument())
    );
    const packagedDocumentBytes = entries.get("document.json");

    if (!packagedDocumentBytes) {
      throw new Error("Expected packaged document.json");
    }

    const packagedDocument = parseDesignDocument(
      textDecoder.decode(packagedDocumentBytes)
    );

    expect(packagedDocument.assets.asset_image_layer).toMatchObject({
      height: 1,
      width: 1,
    });
  });

  test("rejects unsupported tiled prototype Raster assets", () => {
    const tiledPrototype = {
      assets: {
        asset_tiled_prototype: {
          colorSpace: "srgb",
          currentMimeType: "image/png",
          hasAlpha: true,
          height: 64,
          id: "asset_tiled_prototype",
          kind: "raster",
          name: "Tiled prototype",
          originalMimeType: "image/png",
          preferredExportMimeType: "image/png",
          storage: "tiled",
          tileSize: 32,
          tiles: [
            {
              col: 0,
              height: 32,
              ref: "assets/raster/tile.png",
              row: 0,
              width: 32,
              x: 0,
              y: 0,
            },
          ],
          width: 64,
        },
      },
      nodes: [
        {
          assetId: "asset_tiled_prototype",
          height: 64,
          id: "tiled-prototype",
          name: "Tiled prototype",
          opacity: 1,
          parentId: "root",
          transform: transform(0, 0),
          type: "image",
          visible: true,
          width: 64,
        },
      ],
      version: PUNCH_DOCUMENT_VERSION,
    };

    expect(() => parseDesignDocument(JSON.stringify(tiledPrototype))).toThrow();
  });

  test("packages only the current raster payload after undo and redo", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createHistoryRasterNode(CURRENT_RASTER_SRC)]);
    editor.run(() => {
      editor.getState().updateNodeById("history-image-layer", (node) => {
        if (node.type !== "image") {
          return node;
        }

        return {
          ...node,
          src: UNDONE_RASTER_SRC,
        };
      });
    });

    expect(editor.undo()).toBe(true);

    const undoPackageState = getPackagedRasterState(
      createPunchPackage(editor.serializeDocument())
    );

    expect(undoPackageState.rasterEntries).toEqual([
      "assets/raster/asset_history_image.png",
    ]);
    expect(undoPackageState.rasterPayload).toBe("current-raster-state");
    expect(undoPackageState.document.nodes[0]).not.toHaveProperty("src");
    expect(undoPackageState.document.assets).toEqual({
      asset_history_image: expect.objectContaining({
        id: "asset_history_image",
        ref: "assets/raster/asset_history_image.png",
      }),
    });

    expect(editor.redo()).toBe(true);

    const redoPackageState = getPackagedRasterState(
      createPunchPackage(editor.serializeDocument())
    );

    expect(redoPackageState.rasterEntries).toEqual([
      "assets/raster/asset_history_image.png",
    ]);
    expect(redoPackageState.rasterPayload).toBe("undone-raster-state");
    expect(redoPackageState.document.nodes[0]).not.toHaveProperty("src");
    expect(redoPackageState.document.assets).toEqual({
      asset_history_image: expect.objectContaining({
        id: "asset_history_image",
        ref: "assets/raster/asset_history_image.png",
      }),
    });
  });
});
