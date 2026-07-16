import { expect, test } from "@playwright/test";
import type { DesignDocument } from "@punchpress/punch-schema";
import {
  createDesignDocument,
  createPunchPackage,
  loadPunchPackageContents,
  PUNCH_DOCUMENT_MIME_TYPE,
  PUNCH_DOCUMENT_VERSION,
  parseDesignDocument,
  serializeDesignDocument,
} from "@punchpress/punch-schema";
import { createZipArchive } from "../../../../packages/punch-schema/src/zip";
import {
  gotoEditor,
  loadDocument,
  resetViewport,
  serializeDocument,
  waitForNodeReady,
} from "./helpers/editor";

const ARIAL_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
};

const BLOB_URL_PATTERN = /^blob:/;
const PNG_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lhL1WQAAAABJRU5ErkJggg==";
const textEncoder = new TextEncoder();

const decodeBase64DataUrl = (src: string) => {
  const payload = src.split(",")[1] || "";

  return Uint8Array.from(Buffer.from(payload, "base64"));
};

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
  contours: [rectangleContour(96, 72)],
  fill,
  fillRule: "evenodd" as const,
  id,
  opacity: 0.9,
  parentId,
  stroke: "#111111",
  strokeLineCap: "round" as const,
  strokeLineJoin: "bevel" as const,
  strokeMiterLimit: 8,
  strokeWidth: 4,
  transform: transform(0, 0, 0),
  type: "path" as const,
  visible: true,
});

const createPackageLoadNodes = () => [
  {
    background: "#f8f8f8",
    height: 420,
    id: "artboard-layer",
    locked: false,
    name: "Loaded Artboard",
    opacity: 1,
    parentId: "root",
    transform: transform(160, 130),
    type: "artboard" as const,
    visible: true,
    width: 540,
  },
  {
    id: "empty-layer",
    name: "Loaded Empty Layer",
    opacity: 1,
    parentId: "root",
    type: "empty" as const,
    visible: true,
  },
  {
    id: "group-layer",
    name: "Loaded Group",
    opacity: 0.92,
    parentId: "root",
    transform: transform(48, 56, -6),
    type: "group" as const,
    visible: true,
  },
  {
    fill: "#202020",
    font: ARIAL_FONT,
    fontSize: 72,
    id: "text-layer",
    opacity: 1,
    parentId: "root",
    stroke: "#ffffff",
    strokeWidth: 2,
    text: "Loaded Text",
    tracking: 12,
    transform: transform(260, 220, 4),
    type: "text" as const,
    visible: true,
    warp: {
      kind: "none" as const,
    },
  },
  {
    cornerRadius: 10,
    fill: "#ffcc00",
    height: 140,
    id: "hidden-shape-layer",
    opacity: 0.75,
    parentId: "root",
    shape: "polygon" as const,
    stroke: "#222222",
    strokeWidth: 6,
    transform: transform(520, 290, 15),
    type: "shape" as const,
    visible: false,
    width: 210,
  },
  {
    assetId: "asset_image_layer",
    height: 96,
    id: "image-layer",
    mimeType: "image/png" as const,
    name: "Loaded Image",
    opacity: 0.82,
    parentId: "root",
    src: PNG_SRC,
    transform: transform(420, 360, 22),
    type: "image" as const,
    visible: true,
    width: 128,
  },
  {
    id: "vector-layer",
    name: "Loaded Vector",
    opacity: 0.87,
    parentId: "root",
    pathComposition: "compound-fill" as const,
    transform: transform(650, 250, 11),
    type: "vector" as const,
    visible: true,
  },
  createPathNode("vector-child-path", "vector-layer", "#00aaff"),
  {
    ...createPathNode("standalone-path-layer", "root", "#aa00ff"),
    transform: transform(780, 400, -8),
  },
];

const createHydratedPunchPackageContents = () => {
  const document = createDesignDocument(createPackageLoadNodes());
  const packageBytes = createPunchPackage(serializeDesignDocument(document));

  return loadPunchPackageContents(packageBytes);
};

const createHydratedTiledRasterPackageContents = () => {
  const tileRefs = [
    "assets/raster/asset_tiled_image/tiles/0_0.png",
    "assets/raster/asset_tiled_image/tiles/1_0.png",
  ];
  const document = {
    assets: {
      asset_tiled_image: {
        colorSpace: "srgb",
        currentMimeType: "image/png",
        hasAlpha: true,
        height: 64,
        id: "asset_tiled_image",
        kind: "raster",
        name: "Loaded Tiled Image",
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
        name: "Loaded Tiled Image",
        opacity: 1,
        parentId: "root",
        transform: transform(320, 280),
        type: "image",
        visible: true,
        width: 64,
      },
    ],
    version: PUNCH_DOCUMENT_VERSION,
  };
  const tileBytes = decodeBase64DataUrl(PNG_SRC);
  const packageBytes = createZipArchive([
    {
      data: textEncoder.encode(PUNCH_DOCUMENT_MIME_TYPE),
      path: "mimetype",
    },
    {
      data: textEncoder.encode(
        serializeDesignDocument(document as DesignDocument)
      ),
      path: "document.json",
    },
    {
      data: tileBytes,
      path: tileRefs[0],
    },
    {
      data: tileBytes,
      path: tileRefs[1],
    },
  ]);

  return loadPunchPackageContents(packageBytes);
};

const getRenderedCanvasNodeIds = (page) => {
  return page
    .locator(".canvas-node[data-node-id]")
    .evaluateAll((elements) =>
      elements
        .map((element) => element.getAttribute("data-node-id"))
        .filter(Boolean)
    );
};

const getCanvasNodeArtSummary = (page, nodeId: string) => {
  return page.evaluate((targetNodeId) => {
    const hitTarget = document.querySelector(
      `.canvas-node[data-node-id="${targetNodeId}"]`
    );
    const shell = hitTarget?.closest('[data-node-shell="true"]');
    const image = shell?.querySelector("image");

    return {
      imageHref: image?.getAttribute("href") || null,
      pathCount: shell?.querySelectorAll("path").length || 0,
    };
  }, nodeId);
};

const getCanvasNodeTileSummary = (page, nodeId: string) => {
  return page.evaluate((targetNodeId) => {
    const hitTarget = document.querySelector(
      `.canvas-node[data-node-id="${targetNodeId}"]`
    );
    const shell = hitTarget?.closest('[data-node-shell="true"]');
    const tiles = [
      ...(shell?.querySelectorAll("[data-raster-tile-ref]") || []),
    ];

    return tiles.map((tile) => ({
      height: tile.getAttribute("height"),
      href: tile.getAttribute("href"),
      ref: tile.getAttribute("data-raster-tile-ref"),
      width: tile.getAttribute("width"),
      x: tile.getAttribute("x"),
      y: tile.getAttribute("y"),
    }));
  }, nodeId);
};

test("packaged .punch files hydrate and render each loaded layer kind", async ({
  page,
}) => {
  const hydratedContents = createHydratedPunchPackageContents();

  await gotoEditor(page);
  await loadDocument(page, hydratedContents);
  await resetViewport(page);

  for (const nodeId of [
    "artboard-layer",
    "empty-layer",
    "group-layer",
    "text-layer",
    "hidden-shape-layer",
    "image-layer",
    "vector-layer",
    "vector-child-path",
    "standalone-path-layer",
  ]) {
    await expect(
      page.locator(`[data-layer-node-id="${nodeId}"]`)
    ).toBeVisible();
  }

  await waitForNodeReady(page, "text-layer");
  await waitForNodeReady(page, "image-layer");
  await waitForNodeReady(page, "standalone-path-layer");

  await expect(
    page.locator('[data-artboard-body="artboard-layer"]')
  ).toBeVisible();
  await expect(
    page.locator('.canvas-node[data-node-id="artboard-layer"]')
  ).toBeVisible();
  await expect(
    page.locator('.canvas-node[data-node-id="text-layer"]')
  ).toBeVisible();
  await expect(
    page.locator('.canvas-node[data-node-id="image-layer"]')
  ).toBeVisible();
  await expect(
    page.locator('.canvas-node[data-node-id="vector-layer"]')
  ).toBeVisible();
  await expect(
    page.locator('.canvas-node[data-node-id="standalone-path-layer"]')
  ).toBeVisible();
  await expect(
    page.locator('.canvas-node[data-node-id="hidden-shape-layer"]')
  ).toHaveCount(0);
  await expect(
    page.locator('.canvas-node[data-node-id="empty-layer"]')
  ).toHaveCount(0);
  await expect(
    page.locator('.canvas-node[data-node-id="group-layer"]')
  ).toHaveCount(0);

  await expect
    .poll(async () => await getCanvasNodeArtSummary(page, "image-layer"))
    .toMatchObject({ imageHref: PNG_SRC });
  expect(
    (await getCanvasNodeArtSummary(page, "text-layer")).pathCount
  ).toBeGreaterThan(0);
  expect((await getCanvasNodeArtSummary(page, "vector-layer")).pathCount).toBe(
    1
  );
  expect(
    (await getCanvasNodeArtSummary(page, "standalone-path-layer")).pathCount
  ).toBe(1);

  await expect
    .poll(async () => (await getRenderedCanvasNodeIds(page)).sort())
    .toEqual(
      [
        "artboard-layer",
        "image-layer",
        "standalone-path-layer",
        "text-layer",
        "vector-layer",
      ].sort()
    );

  const browserSerialized = await serializeDocument(page);

  expect(parseDesignDocument(browserSerialized)).toEqual(
    parseDesignDocument(hydratedContents)
  );

  const imageNode = await page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.getNode("image-layer") || null;
  });

  expect(imageNode?.type).toBe("image");
  expect(imageNode?.src).toBe(PNG_SRC);
});

test("packaged tiled raster assets hydrate and render as image tiles", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, createHydratedTiledRasterPackageContents());
  await resetViewport(page);
  await waitForNodeReady(page, "tiled-image-layer");

  await expect(
    page.locator('.canvas-node[data-node-id="tiled-image-layer"]')
  ).toBeVisible();
  // Tile pixel bytes live in the editor's raster asset store; the DOM
  // fallback renders them through cached object URLs, never inline data URLs.
  await expect
    .poll(async () => await getCanvasNodeTileSummary(page, "tiled-image-layer"))
    .toEqual([
      {
        height: "64",
        href: expect.stringMatching(BLOB_URL_PATTERN),
        ref: "assets/raster/asset_tiled_image/tiles/0_0.png",
        width: "32",
        x: "0",
        y: "0",
      },
      {
        height: "64",
        href: expect.stringMatching(BLOB_URL_PATTERN),
        ref: "assets/raster/asset_tiled_image/tiles/1_0.png",
        width: "32",
        x: "32",
        y: "0",
      },
    ]);

  const tileAssetBytesMatchPackage = await page.evaluate(async (pngSrc) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("tiled-image-layer");
    const refs = (node?.tileSources || []).map((tile) => tile.ref);
    const expected = await (await fetch(pngSrc)).arrayBuffer();
    const expectedBytes = new Uint8Array(expected);

    return refs.every((ref) => {
      const entry = editor?.rasterAssets?.get(ref);

      return (
        entry &&
        entry.bytes.length === expectedBytes.length &&
        entry.bytes.every((byte, index) => byte === expectedBytes[index])
      );
    });
  }, PNG_SRC);

  expect(tileAssetBytesMatchPackage).toBe(true);

  const serializedDocument = parseDesignDocument(await serializeDocument(page));
  const tiledNode = serializedDocument.nodes[0];

  expect(tiledNode.type).toBe("image");
  expect(tiledNode.type === "image" ? tiledNode.src : null).toBeUndefined();
  expect(tiledNode.type === "image" ? tiledNode.tileSources?.length : 0).toBe(
    2
  );
});
