import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import type { DesignDocument } from "@punchpress/punch-schema";
import {
  createPunchPackage,
  DEFAULT_LOCAL_FONT,
  loadPunchPackageContents,
  PUNCH_DOCUMENT_MIME_TYPE,
  PUNCH_DOCUMENT_VERSION,
  parseDesignDocument,
  serializeDesignDocument,
} from "@punchpress/punch-schema";
import {
  createZipArchive,
  readZipArchive,
} from "../../../../../packages/punch-schema/src/zip";

const PNG_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lhL1WQAAAABJRU5ErkJggg==";
const CURRENT_RASTER_SRC = "data:image/png,current-raster-state";
const UNDONE_RASTER_SRC = "data:image/png,undone-raster-state";
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

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

  test("hydrates tiled raster package assets as image tile sources", () => {
    const tileRefs = [
      "assets/raster/asset_tiled_image/tiles/0_0.png",
      "assets/raster/asset_tiled_image/tiles/1_0.png",
    ];
    const packagedDocument = {
      assets: {
        asset_tiled_image: {
          colorSpace: "srgb",
          currentMimeType: "image/png",
          hasAlpha: true,
          height: 64,
          id: "asset_tiled_image",
          kind: "raster",
          name: "Tiled Image",
          originalMimeType: "image/png",
          preferredExportMimeType: "image/png",
          storage: "tiled",
          tileSize: 32,
          tiles: [
            {
              col: 0,
              height: 64,
              ref: tileRefs[0],
              row: 0,
              width: 32,
              x: 0,
              y: 0,
            },
            {
              col: 1,
              height: 64,
              ref: tileRefs[1],
              row: 0,
              width: 32,
              x: 32,
              y: 0,
            },
          ],
          width: 64,
        },
      },
      nodes: [
        {
          assetId: "asset_tiled_image",
          height: 64,
          id: "tiled-image-layer",
          name: "Tiled Image",
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
    const packageBytes = createZipArchive([
      {
        data: textEncoder.encode(PUNCH_DOCUMENT_MIME_TYPE),
        path: "mimetype",
      },
      {
        data: textEncoder.encode(
          serializeDesignDocument(packagedDocument as DesignDocument)
        ),
        path: "document.json",
      },
      {
        data: textEncoder.encode("left-tile"),
        path: tileRefs[0],
      },
      {
        data: textEncoder.encode("right-tile"),
        path: tileRefs[1],
      },
    ]);

    const hydratedDocument = parseDesignDocument(
      loadPunchPackageContents(packageBytes)
    );
    const hydratedNode = hydratedDocument.nodes[0];

    expect(hydratedNode.type).toBe("image");
    if (hydratedNode.type !== "image") {
      throw new Error("Expected hydrated image node");
    }
    expect(hydratedNode.src).toBeUndefined();
    expect(hydratedNode.tileSources?.map((tile) => tile.ref)).toEqual(tileRefs);
    expect(hydratedNode.tileSources?.[0].src).toBe(
      "data:image/png;base64,bGVmdC10aWxl"
    );

    const roundTripPackageBytes = createPunchPackage(
      serializeDesignDocument(hydratedDocument)
    );
    const roundTripEntries = readZipArchive(roundTripPackageBytes);
    const roundTripDocumentBytes = roundTripEntries.get("document.json");

    if (!roundTripDocumentBytes) {
      throw new Error("Expected round-tripped package document");
    }

    const roundTripDocument = parseDesignDocument(
      textDecoder.decode(roundTripDocumentBytes)
    );
    const roundTripNode = roundTripDocument.nodes[0];

    expect(roundTripNode.type).toBe("image");
    expect(
      roundTripNode.type === "image" ? roundTripNode.tileSources : null
    ).toBeUndefined();
    expect(roundTripDocument.assets.asset_tiled_image).toMatchObject({
      storage: "tiled",
      tileSize: 32,
      tiles: [
        expect.objectContaining({ ref: tileRefs[0] }),
        expect.objectContaining({ ref: tileRefs[1] }),
      ],
    });
    expect(textDecoder.decode(roundTripEntries.get(tileRefs[1]))).toBe(
      "right-tile"
    );
  });

  test("packages sparse tiled edits with a base raster payload", () => {
    const document = {
      assets: {
        asset_sparse_tile_image: {
          colorSpace: "srgb",
          currentMimeType: "image/png",
          hasAlpha: true,
          height: 1024,
          id: "asset_sparse_tile_image",
          kind: "raster",
          name: "Sparse Tile Image",
          originalMimeType: "image/png",
          preferredExportMimeType: "image/png",
          ref: "assets/raster/asset_sparse_tile_image.png",
          storage: "single",
          width: 1024,
        },
      },
      nodes: [
        {
          assetId: "asset_sparse_tile_image",
          baseHeight: 1024,
          baseWidth: 1024,
          baseX: 64,
          baseY: 32,
          height: 1100,
          id: "sparse-tile-image-layer",
          mimeType: "image/png",
          name: "Sparse Tile Image",
          opacity: 1,
          parentId: "root",
          src: PNG_SRC,
          tileSources: [
            {
              col: 1,
              height: 512,
              ref: "assets/raster/sparse-tile-image-layer/tiles/1_0.png",
              row: 0,
              src: "data:image/png;base64,ZGlydHktdGlsZQ==",
              width: 88,
              x: 1088,
              y: 96,
            },
          ],
          transform: transform(0, 0),
          type: "image",
          visible: true,
          width: 1200,
          writableHeight: 1400,
          writableWidth: 1600,
          writableX: -200,
          writableY: -100,
        },
      ],
      version: PUNCH_DOCUMENT_VERSION,
    };

    const packageBytes = createPunchPackage(
      serializeDesignDocument(document as DesignDocument)
    );
    const entries = readZipArchive(packageBytes);
    const packagedDocumentBytes = entries.get("document.json");

    if (!packagedDocumentBytes) {
      throw new Error("Expected packaged document.json");
    }

    const packagedDocument = parseDesignDocument(
      textDecoder.decode(packagedDocumentBytes)
    );
    const packagedAsset = packagedDocument.assets.asset_sparse_tile_image;
    const packagedNode = packagedDocument.nodes[0];

    expect(packagedAsset).toMatchObject({
      baseRef: "assets/raster/asset_sparse_tile_image/base.png",
      storage: "tiled",
      tileSize: 512,
      tiles: [
        expect.objectContaining({
          ref: "assets/raster/sparse-tile-image-layer/tiles/1_0.png",
          width: 88,
          x: 1088,
          y: 96,
        }),
      ],
    });
    expect(packagedNode).toMatchObject({
      baseHeight: 1024,
      baseWidth: 1024,
      baseX: 64,
      baseY: 32,
      height: 1100,
      width: 1200,
      writableHeight: 1400,
      writableWidth: 1600,
      writableX: -200,
      writableY: -100,
    });
    expect(entries.has("assets/raster/asset_sparse_tile_image/base.png")).toBe(
      true
    );
    expect(
      entries.has("assets/raster/sparse-tile-image-layer/tiles/1_0.png")
    ).toBe(true);

    const hydratedDocument = parseDesignDocument(
      loadPunchPackageContents(packageBytes)
    );
    const hydratedNode = hydratedDocument.nodes[0];

    expect(hydratedNode.type).toBe("image");
    if (hydratedNode.type !== "image") {
      throw new Error("Expected hydrated image node");
    }
    expect(hydratedNode.src).toBe(PNG_SRC);
    expect(hydratedNode).toMatchObject({
      baseHeight: 1024,
      baseWidth: 1024,
      baseX: 64,
      baseY: 32,
      height: 1100,
      width: 1200,
      writableHeight: 1400,
      writableWidth: 1600,
      writableX: -200,
      writableY: -100,
    });
    expect(hydratedNode.tileSources?.[0].src).toBe(
      "data:image/png;base64,ZGlydHktdGlsZQ=="
    );
    expect(hydratedNode.tileSources?.[0]).toMatchObject({
      height: 512,
      width: 88,
      x: 1088,
      y: 96,
    });
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
