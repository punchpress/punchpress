import { expect, test } from "@playwright/test";
import {
  createDesignDocument,
  createPunchPackage,
  loadPunchPackageContents,
  parseDesignDocument,
  serializeDesignDocument,
} from "@punchpress/punch-schema";
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

const PNG_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lhL1WQAAAABJRU5ErkJggg==";

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
      hasResidentCanvas: Boolean(
        shell?.querySelector('canvas[data-raster-source-canvas="true"]')
      ),
      imageHref: image?.getAttribute("href") || null,
      pathCount: shell?.querySelectorAll("path").length || 0,
    };
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
    .toMatchObject({ hasResidentCanvas: true });
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
