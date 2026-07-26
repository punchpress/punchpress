import { expect, type Page, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocument,
  resetViewport,
  setViewport,
} from "./helpers/editor";
import { decodePng } from "./helpers/png";

const MAX_EXACT_ALIGNMENT_ERROR_PHYSICAL_PIXELS = 0.01;
const MAX_NATIVE_PRESENTATION_EDGE_ERROR_PHYSICAL_PIXELS = 1;

const createRasterSource = (page: Page) => {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");

    canvas.width = 2;
    canvas.height = 2;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Expected Canvas2D");
    }

    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = "#00ff00";
    context.fillRect(1, 0, 1, 1);
    context.fillStyle = "#0000ff";
    context.fillRect(0, 1, 1, 1);
    context.clearRect(1, 1, 1, 1);
    return canvas.toDataURL("image/png");
  });
};

const createContrastRasterSource = (page: Page) => {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");

    canvas.width = 2;
    canvas.height = 1;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Expected Canvas2D");
    }

    context.fillStyle = "#000";
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = "#fff";
    context.fillRect(1, 0, 1, 1);
    return canvas.toDataURL("image/png");
  });
};

const createTransparentRasterSource = (page: Page) => {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");

    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/png");
  });
};

const createNativeJpegSource = (page: Page) => {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");

    canvas.width = 16;
    canvas.height = 8;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Expected Canvas2D");
    }

    for (let x = 0; x < canvas.width; x += 1) {
      context.fillStyle = Math.floor(x / 4) % 2 === 0 ? "#000" : "#fff";
      context.fillRect(x, 0, 1, canvas.height);
    }

    return canvas.toDataURL("image/jpeg", 1);
  });
};

const setConvergedViewport = async (
  page: Page,
  viewport: { x: number; y: number; zoom: number }
) => {
  await setViewport(page, viewport);
  await page.evaluate((nextViewport) => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.setViewportInteracting(false);
    editor?.getState().setViewport(nextViewport);
  }, viewport);
  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getState().viewport.zoom;
      });
    })
    .toBe(viewport.zoom);
};

const captureRasterPresentation = (page: Page, nodeId: string) => {
  return page.evaluate((id) => {
    const nodeRoot = document.querySelector(`[data-node-id="${id}"]`);
    const samplingSurface = nodeRoot?.querySelector("[data-raster-sampling]");
    const sourceCanvas = nodeRoot?.querySelector<HTMLCanvasElement>(
      '[data-testid="raster-resident-canvas"] canvas[data-raster-source-canvas="true"]'
    );
    const presentationCanvas = nodeRoot?.querySelector<HTMLCanvasElement>(
      '[data-testid="raster-resident-canvas"] canvas[data-raster-exact-backing="true"]'
    );
    const visibleCanvas = presentationCanvas || sourceCanvas;
    const tiledSurface = nodeRoot?.querySelector("[data-raster-node-id]");
    const importedImage = nodeRoot?.querySelector("image, img");

    return {
      gridCount: document.querySelectorAll("[data-pixel-grid-kind]").length,
      imageRendering: visibleCanvas
        ? getComputedStyle(visibleCanvas).imageRendering
        : null,
      pixelOutput: sourceCanvas?.toDataURL() || null,
      renderedSource: sourceCanvas
        ? {
            height: sourceCanvas.height,
            kind: "resident-canvas",
            width: sourceCanvas.width,
          }
        : {
            href:
              importedImage?.getAttribute("href") ||
              importedImage?.getAttribute("src") ||
              null,
            kind:
              tiledSurface?.getAttribute("data-raster-preview-active") ===
              "true"
                ? "tile-preview"
                : "svg-source",
            previewActive:
              tiledSurface?.getAttribute("data-raster-preview-active") || null,
            previewEligible:
              tiledSurface?.getAttribute("data-raster-preview-eligible") ||
              null,
            renderKey:
              tiledSurface?.getAttribute("data-raster-render-key") || null,
            visibleTileCount:
              tiledSurface?.getAttribute("data-raster-visible-tile-count") ||
              null,
          },
      sampling: samplingSurface?.getAttribute("data-raster-sampling") || null,
    };
  }, nodeId);
};

const createFrameDocument = (src: string) =>
  JSON.stringify({
    nodes: [
      {
        background: "#ffffff",
        height: 120,
        id: "frame",
        locked: false,
        name: "Frame",
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 200,
          y: 180,
        },
        type: "artboard",
        visible: true,
        width: 160,
      },
      {
        assetId: "asset-frame-raster",
        baseHeight: 32,
        baseWidth: 48,
        baseX: 0,
        baseY: 0,
        height: 32,
        id: "frame-raster",
        mimeType: "image/png",
        name: "Frame Raster",
        opacity: 1,
        parentId: "frame",
        src,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 240,
          y: 220,
        },
        type: "image",
        visible: true,
        width: 48,
      },
      {
        assetId: "asset-frame-tiled-raster",
        baseHeight: 1,
        baseWidth: 129,
        baseX: 0,
        baseY: 0,
        height: 1,
        id: "frame-tiled-raster",
        mimeType: "image/png",
        name: "Frame Tiled Raster",
        opacity: 1,
        parentId: "frame",
        tileSources: Array.from({ length: 129 }, (_, index) => ({
          col: index,
          height: 1,
          ref: `assets/raster/frame-tile-${index}.png`,
          row: 0,
          src,
          width: 1,
          x: index,
          y: 0,
        })),
        transform: {
          rotation: 0,
          scaleX: 0.01,
          scaleY: 0.01,
          x: 220,
          y: 200,
        },
        type: "image",
        visible: true,
        width: 129,
      },
    ],
    version: "1.8",
  });

const createStandaloneRasterDocument = (src: string) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-standalone-raster",
        baseHeight: 64,
        baseWidth: 96,
        baseX: 0,
        baseY: 0,
        height: 64,
        id: "standalone-raster",
        mimeType: "image/png",
        name: "Standalone Raster",
        opacity: 1,
        parentId: "root",
        src,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 320,
          y: 220,
        },
        type: "image",
        visible: true,
        width: 96,
      },
    ],
    version: "1.8",
  });

const createSolidFrameDocument = (src: string) =>
  JSON.stringify({
    nodes: [
      {
        background: "#808080",
        height: 8,
        id: "solid-frame",
        locked: false,
        name: "Solid Frame",
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 320,
          y: 220,
        },
        type: "artboard",
        visible: true,
        width: 8,
      },
      {
        assetId: "asset-solid-raster",
        baseHeight: 1,
        baseWidth: 1,
        baseX: 0,
        baseY: 0,
        height: 1,
        id: "solid-raster",
        mimeType: "image/png",
        name: "Solid Raster",
        opacity: 1,
        parentId: "solid-frame",
        src,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 320,
          y: 220,
        },
        type: "image",
        visible: true,
        width: 1,
      },
    ],
    version: "1.8",
  });

const createNativeJpegDocument = (src: string) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-native-jpeg",
        baseHeight: 8.41,
        baseWidth: 16.37,
        baseX: 0,
        baseY: 0,
        height: 8.41,
        id: "native-jpeg",
        mimeType: "image/jpeg",
        name: "Imported native JPEG",
        opacity: 1,
        parentId: "root",
        src,
        transform: {
          rotation: 0,
          scaleX: 1.25,
          scaleY: 0.9,
          x: 320.3,
          y: 220.6,
        },
        type: "image",
        visible: true,
        width: 16.37,
      },
    ],
    version: "1.8",
  });

const createDenseTiledDocument = (src: string) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-tiled-raster",
        baseHeight: 1,
        baseWidth: 129,
        baseX: 0,
        baseY: 0,
        height: 1,
        id: "tiled-raster",
        mimeType: "image/png",
        name: "Tiled Raster",
        opacity: 1,
        parentId: "root",
        tileSources: Array.from({ length: 129 }, (_, index) => ({
          col: index,
          height: 1,
          ref: `assets/raster/tile-${index}.png`,
          row: 0,
          src,
          width: 1,
          x: index,
          y: 0,
        })),
        transform: {
          rotation: 0,
          scaleX: 0.01,
          scaleY: 0.01,
          x: 320,
          y: 220,
        },
        type: "image",
        visible: true,
        width: 129,
      },
    ],
    version: "1.8",
  });

const createFractionalRasterDocument = (src: string) =>
  JSON.stringify({
    nodes: [
      {
        id: "fractional-render-root",
        name: "Rendered Raster group",
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "group",
        visible: true,
      },
      {
        id: "fractional-group",
        name: "Scaled Raster group",
        parentId: "fractional-render-root",
        transform: {
          rotation: 0,
          scaleX: 4,
          scaleY: 4,
          x: 0,
          y: 0,
        },
        type: "group",
        visible: true,
      },
      {
        assetId: "asset-fractional-raster",
        baseHeight: 3.6,
        baseWidth: 7.4,
        baseX: 0.4,
        baseY: -0.45,
        height: 3.6,
        id: "fractional-raster",
        mimeType: "image/png",
        name: "Fractional Raster",
        opacity: 1,
        parentId: "fractional-group",
        src,
        transform: {
          rotation: 0,
          scaleX: 1.25,
          scaleY: 0.8,
          x: 320.3,
          y: 220.6,
        },
        type: "image",
        visible: true,
        width: 7.4,
      },
      ...Array.from({ length: 300 }, (_, index) => ({
        cornerRadius: 0,
        fill: "#000000",
        height: 1,
        id: `fractional-density-${index}`,
        opacity: 0,
        parentId: "fractional-render-root",
        shape: "polygon",
        stroke: null,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 320 + (index % 20),
          y: 220 + Math.floor(index / 20),
        },
        type: "shape",
        visible: true,
        width: 1,
      })),
    ],
    version: "1.8",
  });

test("shows only the active finite pixel grid above 500 percent", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createRasterSource(page);

  await loadDocument(page, createFrameDocument(src));
  await resetViewport(page);
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("frame-raster");
  });
  const belowGridZoom = 4.999;
  const aboveGridZoom = 5.001;

  await setConvergedViewport(page, {
    x: 180,
    y: 160,
    zoom: belowGridZoom,
  });
  await expect(
    page.locator(
      '[data-node-id="frame-raster"] [data-testid="raster-resident-canvas"] canvas' +
        '[data-raster-exact-backing="true"]'
    )
  ).toBeVisible();
  const frameTiledRaster = page.locator(
    '[data-node-id="frame-tiled-raster"] [data-raster-node-id="frame-tiled-raster"]'
  );

  await expect(frameTiledRaster).toHaveAttribute(
    "data-raster-preview-active",
    "false"
  );
  const presentationBelowGrid = await captureRasterPresentation(
    page,
    "frame-raster"
  );
  const tiledPresentationBelowGrid = await captureRasterPresentation(
    page,
    "frame-tiled-raster"
  );

  expect(presentationBelowGrid.gridCount).toBe(0);

  await setConvergedViewport(page, {
    x: 180,
    y: 160,
    zoom: aboveGridZoom,
  });
  await expect(page.locator("[data-pixel-grid-kind]")).toHaveCount(1);
  await expect(frameTiledRaster).toHaveAttribute(
    "data-raster-preview-active",
    "false"
  );
  const presentationAboveGrid = await captureRasterPresentation(
    page,
    "frame-raster"
  );
  const tiledPresentationAboveGrid = await captureRasterPresentation(
    page,
    "frame-tiled-raster"
  );
  const { gridCount: belowGridCount, ...stablePresentationBelowGrid } =
    presentationBelowGrid;
  const { gridCount: aboveGridCount, ...stablePresentationAboveGrid } =
    presentationAboveGrid;

  expect(belowGridCount).toBe(0);
  expect(aboveGridCount).toBe(1);
  expect(stablePresentationBelowGrid).toMatchObject({
    imageRendering: "auto",
    renderedSource: {
      height: 32,
      kind: "resident-canvas",
      width: 48,
    },
    sampling: "exact",
  });
  expect(stablePresentationAboveGrid).toEqual(stablePresentationBelowGrid);
  expect(tiledPresentationBelowGrid).toMatchObject({
    gridCount: 0,
    renderedSource: {
      kind: "svg-source",
      previewActive: "false",
      previewEligible: "false",
    },
    sampling: "smooth",
  });
  expect(tiledPresentationAboveGrid).toEqual({
    ...tiledPresentationBelowGrid,
    gridCount: 1,
  });

  const grid = page.locator("[data-pixel-grid-kind]");

  await expect(grid).toHaveAttribute("data-pixel-grid-kind", "frame");
  await expect(grid).toHaveAttribute("data-pixel-grid-node-id", "frame");
  await expect(grid).toHaveAttribute(
    "data-pixel-grid-source-node-id",
    "frame-raster"
  );
  const gridPlane = grid.getByTestId("pixel-grid-plane");

  await expect(gridPlane).toHaveAttribute("width", "160");
  await expect(gridPlane).toHaveAttribute("height", "120");
  const gridOriginBeforeMove = await grid.evaluate((element) => {
    const matrix = element.getScreenCTM();

    return matrix ? { x: matrix.e, y: matrix.f } : null;
  });

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const session = editor?.beginSelectionDrag({ nodeId: "frame" });

    if (!session) {
      throw new Error("Expected Frame drag session");
    }

    window.__HIGH_ZOOM_DRAG_SESSION__ = session;
    editor.updateSelectionDrag(session, {
      delta: { x: 12.5, y: 8.25 },
    });
  });

  expect(gridOriginBeforeMove).not.toBeNull();
  const devicePixelRatio = await page.evaluate(() => window.devicePixelRatio);
  await expect
    .poll(async () => {
      const originX = await grid.evaluate((element) => {
        return element.getScreenCTM()?.e ?? null;
      });

      return originX === null
        ? null
        : Math.abs(
            originX - (gridOriginBeforeMove?.x || 0) - 12.5 * aboveGridZoom
          ) * devicePixelRatio;
    })
    .toBeLessThan(0.25);
  await expect
    .poll(async () => {
      const originY = await grid.evaluate((element) => {
        return element.getScreenCTM()?.f ?? null;
      });

      return originY === null
        ? null
        : Math.abs(
            originY - (gridOriginBeforeMove?.y || 0) - 8.25 * aboveGridZoom
          ) * devicePixelRatio;
    })
    .toBeLessThan(0.25);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const session = window.__HIGH_ZOOM_DRAG_SESSION__;

    if (editor && session) {
      editor.endSelectionDrag(session);
    }
  });

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__
      ?.getState()
      .updateNodeById("frame-raster", (node) => ({
        ...node,
        height: 80,
        transform: {
          ...node.transform,
          x: 160,
          y: 170,
        },
        width: 120,
      }));
  });

  await expect(grid).toHaveAttribute("data-pixel-grid-node-id", "frame");
  await expect(gridPlane).toHaveAttribute("width", "160");
  await expect(gridPlane).toHaveAttribute("height", "120");

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.newDocument();
  });

  await expect(page.locator("[data-pixel-grid-kind]")).toHaveCount(0);
});

test("rapid wheel zoom keeps pixel-grid strokes screen-constant", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createRasterSource(page);

  await loadDocument(page, createFrameDocument(src));
  await resetViewport(page);
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("frame-raster");
  });
  await setConvergedViewport(page, {
    x: 180,
    y: 160,
    zoom: 6,
  });

  const grid = page.locator('[data-pixel-grid-kind="frame"]');

  await expect(grid).toBeVisible();
  const readLightStrokeWidth = () =>
    page.evaluate(() => {
      const gridElement = document.querySelector<SVGGElement>(
        '[data-pixel-grid-kind="frame"]'
      );
      const lightStroke = gridElement?.querySelector<SVGPathElement>(
        '[data-pixel-grid-tone="light"]'
      );
      const matrix = gridElement?.getScreenCTM();

      if (!(lightStroke && matrix)) {
        return null;
      }

      const screenScale =
        lightStroke.getAttribute("vector-effect") === "non-scaling-stroke"
          ? 1
          : Math.hypot(matrix.a, matrix.b);

      return Number(lightStroke.getAttribute("stroke-width")) * screenScale;
    });
  const initialStrokeWidth = await readLightStrokeWidth();
  const hostBox = await page.locator(".canvas-host").boundingBox();

  if (!hostBox) {
    throw new Error("Missing canvas host");
  }

  const wheelPoint = {
    x: Math.round(hostBox.x + hostBox.width * 0.72),
    y: Math.round(hostBox.y + hostBox.height * 0.38),
  };
  const readTransformError = () =>
    page.evaluate(() => {
      const host = document.querySelector(".canvas-host");
      const source = document.querySelector<SVGGElement>(
        '[data-pixel-grid-transform-source="frame"]'
      );
      const grid = document.querySelector<SVGGElement>(
        '[data-pixel-grid-kind="frame"]'
      );
      const sourceMatrix = source?.getScreenCTM();
      const gridMatrix = grid?.getScreenCTM();
      const hostRect = host?.getBoundingClientRect();

      if (!(gridMatrix && hostRect && sourceMatrix)) {
        return null;
      }

      return Math.max(
        Math.abs(gridMatrix.a - sourceMatrix.a),
        Math.abs(gridMatrix.b - sourceMatrix.b),
        Math.abs(gridMatrix.c - sourceMatrix.c),
        Math.abs(gridMatrix.d - sourceMatrix.d),
        Math.abs(gridMatrix.e - sourceMatrix.e),
        Math.abs(gridMatrix.f - sourceMatrix.f)
      );
    });

  for (let index = 0; index < 12; index += 1) {
    await page.evaluate(
      ({ point }) => {
        const target = document.elementFromPoint(point.x, point.y);

        target?.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            clientX: point.x,
            clientY: point.y,
            ctrlKey: true,
            deltaMode: WheelEvent.DOM_DELTA_PIXEL,
            deltaY: -12,
          })
        );
      },
      { point: wheelPoint }
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        })
    );
    expect(await readTransformError()).toBeLessThan(0.01);
  }

  const burstStrokeWidth = await readLightStrokeWidth();

  await page.waitForTimeout(300);

  const settledStrokeWidth = await readLightStrokeWidth();

  expect(initialStrokeWidth).not.toBeNull();
  expect(burstStrokeWidth).not.toBeNull();
  expect(settledStrokeWidth).not.toBeNull();
  expect(burstStrokeWidth).toBeCloseTo(initialStrokeWidth || 0, 1);
  expect(settledStrokeWidth).toBeCloseTo(initialStrokeWidth || 0, 1);
});

test("renders high-zoom pixel-grid lines no wider than a screen pixel", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentRasterSource(page);

  await loadDocument(page, createSolidFrameDocument(src));
  await resetViewport(page);
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("solid-raster");
  });
  await setConvergedViewport(page, {
    x: 310,
    y: 215,
    zoom: 40,
  });

  const gridPlane = page.getByTestId("pixel-grid-plane");

  await expect(gridPlane).toBeVisible();
  const planeBox = await gridPlane.boundingBox();

  if (!planeBox) {
    throw new Error("Missing pixel-grid plane");
  }

  const clip = {
    height: 1,
    width: 120,
    x: Math.round(planeBox.x) + 60,
    y: Math.round(planeBox.y) + 20,
  };
  const screenshot = await page.screenshot({ clip });
  const png = decodePng(screenshot);
  const colorCounts = new Map<string, number>();

  for (let x = 0; x < png.width; x += 1) {
    const offset = x * 4;
    const key = `${png.data[offset]}:${png.data[offset + 1]}:${
      png.data[offset + 2]
    }`;

    colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
  }

  const baseline = [...colorCounts.entries()]
    .sort(([, countA], [, countB]) => countB - countA)[0]?.[0]
    .split(":")
    .map(Number);

  if (!baseline) {
    throw new Error("Missing screenshot baseline color");
  }

  let longestGridRun = 0;
  let currentGridRun = 0;

  for (let x = 0; x < png.width; x += 1) {
    const offset = x * 4;
    const differsFromSource =
      Math.abs(png.data[offset] - baseline[0]) > 1 ||
      Math.abs(png.data[offset + 1] - baseline[1]) > 1 ||
      Math.abs(png.data[offset + 2] - baseline[2]) > 1;

    currentGridRun = differsFromSource ? currentGridRun + 1 : 0;
    longestGridRun = Math.max(longestGridRun, currentGridRun);
  }

  const devicePixelRatio = await page.evaluate(() => window.devicePixelRatio);

  expect(longestGridRun).toBeGreaterThan(0);
  expect(longestGridRun / devicePixelRatio).toBeLessThanOrEqual(2);
});

test("uses effective source pixels across resident and tiled Raster paths", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createRasterSource(page);

  await loadDocument(page, createStandaloneRasterDocument(src));
  await resetViewport(page);
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("standalone-raster");
  });

  const resident = page.locator(
    '[data-node-id="standalone-raster"] [data-testid="raster-resident-canvas"] canvas[data-raster-source-canvas="true"]'
  );

  await expect(resident).toBeVisible();
  await expect(
    page.locator(
      '[data-node-id="standalone-raster"] [data-raster-sampling="smooth"]'
    )
  ).toBeVisible();
  expect(
    await resident.evaluate((node) => getComputedStyle(node).imageRendering)
  ).toBe("auto");

  await setConvergedViewport(page, { x: 300, y: 200, zoom: 6.25 });

  await expect(
    page.locator(
      '[data-node-id="standalone-raster"] [data-raster-sampling="exact"]'
    )
  ).toBeVisible();
  const exactPresentation = page.locator(
    '[data-node-id="standalone-raster"] [data-testid="raster-resident-canvas"] canvas[data-raster-exact-backing="true"]'
  );

  await expect(exactPresentation).toBeVisible();
  expect(
    await exactPresentation.evaluate(
      (node) => getComputedStyle(node).imageRendering
    )
  ).toBe("auto");

  await loadDocument(page, createDenseTiledDocument(src));
  await resetViewport(page);
  await setConvergedViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("tiled-raster");
  });

  const tiledRaster = page.locator(
    '[data-node-id="tiled-raster"] [data-raster-node-id="tiled-raster"]'
  );

  await expect(tiledRaster).toHaveAttribute(
    "data-raster-preview-eligible",
    "true"
  );
  await expect(tiledRaster).toHaveAttribute(
    "data-raster-preview-active",
    "true"
  );
  const tiledPresentationAtOne = await captureRasterPresentation(
    page,
    "tiled-raster"
  );

  await setConvergedViewport(page, { x: 300, y: 200, zoom: 6.25 });

  await expect(tiledRaster).toHaveAttribute("data-raster-sampling", "smooth");
  await expect(tiledRaster).toHaveAttribute(
    "data-raster-preview-eligible",
    "true"
  );
  await expect(tiledRaster).toHaveAttribute(
    "data-raster-preview-active",
    "true"
  );
  const tiledPresentationAtHighViewportZoom = await captureRasterPresentation(
    page,
    "tiled-raster"
  );

  expect(tiledPresentationAtHighViewportZoom).toEqual(tiledPresentationAtOne);
});

test("keeps Crop, selection, Brush cursor, and live painting aligned at high zoom", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createRasterSource(page);

  await loadDocument(page, createStandaloneRasterDocument(src));
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("standalone-raster");
  });

  const selectionHandle = page
    .locator(".canvas-moveable .moveable-control.moveable-se")
    .first();

  await expect(selectionHandle).toBeVisible();
  const selectionHandleBefore = await selectionHandle.boundingBox();

  await setConvergedViewport(page, { x: 300, y: 200, zoom: 6.25 });

  const selectionHandleAfter = await selectionHandle.boundingBox();

  expect(selectionHandleAfter?.width).toBeCloseTo(
    selectionHandleBefore?.width || 0,
    0
  );
  expect(selectionHandleAfter?.height).toBeCloseTo(
    selectionHandleBefore?.height || 0,
    0
  );

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.startCrop("standalone-raster");
    editor?.updateCrop({
      height: 44,
      width: 72,
      x: -8,
      y: 12,
    });
  });

  const cropGrid = page.locator('[data-pixel-grid-kind="raster"]');
  const cropGridPlane = cropGrid.getByTestId("pixel-grid-plane");

  await expect(cropGrid).toHaveCount(1);
  await expect(cropGridPlane).toHaveAttribute("width", "72");
  await expect(cropGridPlane).toHaveAttribute("height", "44");
  await expect(cropGridPlane).toHaveAttribute("x", "-8");
  await expect(cropGridPlane).toHaveAttribute("y", "12");
  const cropGeometry = await page.evaluate(() => {
    const grid = document.querySelector<SVGGElement>(
      '[data-pixel-grid-kind="raster"]'
    );
    const cropSurface = document.querySelector<SVGSVGElement>(
      'svg[aria-label="Raster Crop preview"]'
    );
    const gridMatrix = grid?.getScreenCTM();
    const cropMatrix = cropSurface?.getScreenCTM();

    if (!(grid && gridMatrix && cropMatrix)) {
      return null;
    }

    const gridStart = new DOMPoint(-8, 12).matrixTransform(gridMatrix);
    const gridEnd = new DOMPoint(64, 56).matrixTransform(gridMatrix);
    const cropStart = new DOMPoint(-8, 12).matrixTransform(cropMatrix);
    const cropEnd = new DOMPoint(64, 56).matrixTransform(cropMatrix);

    return {
      actual: {
        height: Math.abs(gridEnd.y - gridStart.y),
        left: Math.min(gridStart.x, gridEnd.x),
        top: Math.min(gridStart.y, gridEnd.y),
        width: Math.abs(gridEnd.x - gridStart.x),
      },
      expected: {
        height: Math.abs(cropEnd.y - cropStart.y),
        left: Math.min(cropStart.x, cropEnd.x),
        top: Math.min(cropStart.y, cropEnd.y),
        width: Math.abs(cropEnd.x - cropStart.x),
      },
    };
  });

  expect(cropGeometry).not.toBeNull();
  const cropGeometryDiagnostics = JSON.stringify(cropGeometry, null, 2);

  expect(cropGeometry?.actual.height, cropGeometryDiagnostics).toBeCloseTo(
    cropGeometry?.expected.height || 0,
    5
  );
  expect(cropGeometry?.actual.left, cropGeometryDiagnostics).toBeCloseTo(
    cropGeometry?.expected.left || 0,
    5
  );
  expect(cropGeometry?.actual.top, cropGeometryDiagnostics).toBeCloseTo(
    cropGeometry?.expected.top || 0,
    5
  );
  expect(cropGeometry?.actual.width, cropGeometryDiagnostics).toBeCloseTo(
    cropGeometry?.expected.width || 0,
    5
  );
  expect(
    await cropGrid.evaluate((element) => {
      const overlay = element.ownerSVGElement;

      return {
        screenOverlay:
          overlay?.parentElement?.classList.contains("canvas-host"),
        zIndex: overlay ? getComputedStyle(overlay).zIndex : null,
      };
    })
  ).toEqual({
    screenOverlay: true,
    zIndex: "55",
  });

  const cropHandle = page.locator('[data-raster-crop-handle="se"]');

  await expect(cropHandle).toBeVisible();
  const cropHandleBox = await cropHandle.boundingBox();

  expect(cropHandleBox?.width).toBeGreaterThanOrEqual(20);
  expect(cropHandleBox?.width).toBeLessThanOrEqual(28);

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.cancelCrop();
    window.__PUNCHPRESS_EDITOR__?.setActiveTool("brush");
    window.__PUNCHPRESS_EDITOR__?.setBrushSettings(
      {
        hardness: 1,
        opacity: 1,
        size: 1,
        spacing: 0,
      },
      "brush"
    );
  });

  const residentSource = page.locator(
    '[data-node-id="standalone-raster"] [data-testid="raster-resident-canvas"] canvas[data-raster-source-canvas="true"]'
  );
  const residentPresentation = page.locator(
    '[data-node-id="standalone-raster"] [data-testid="raster-resident-canvas"] canvas[data-raster-exact-backing="true"]'
  );
  const residentBox = await residentPresentation.boundingBox();

  if (!residentBox) {
    throw new Error("Expected resident Raster bounds");
  }

  const point = {
    x: residentBox.x + residentBox.width / 2,
    y: residentBox.y + residentBox.height / 2,
  };

  await page.mouse.move(point.x, point.y);

  const cursor = page.getByTestId("brush-cursor");

  await expect(cursor).toBeVisible();
  const cursorBox = await cursor.boundingBox();

  expect(cursorBox?.width).toBeCloseTo(6.25, 0);
  expect(cursorBox?.x).toBeCloseTo(point.x - (cursorBox?.width || 0) / 2, 0);
  expect(cursorBox?.y).toBeCloseTo(point.y - (cursorBox?.height || 0) / 2, 0);

  const alphaBefore = await residentSource.evaluate(
    (canvas: HTMLCanvasElement) => {
      return canvas.getContext("2d")?.getImageData(48, 32, 1, 1).data[3] || 0;
    }
  );

  await page.mouse.down();

  await expect(
    page.locator(
      '[data-node-id="standalone-raster"] [data-raster-resident-surface="canvas2d"][data-raster-sampling="exact"]'
    )
  ).toBeVisible();

  await page.mouse.move(point.x + 12.5, point.y, { steps: 3 });
  await expect
    .poll(() => {
      return page.evaluate(() => {
        const grids = Array.from(
          document.querySelectorAll('[data-pixel-grid-kind="raster"]')
        );
        const visibleCanvasSurfaces = Array.from(
          document.querySelectorAll(
            '[data-testid="raster-resident-canvas"], [data-testid="raster-working-canvas"]'
          )
        ).filter((surface) => {
          const rect = surface.getBoundingClientRect();

          return rect.height > 0 && rect.width > 0;
        });
        const gridOverlay = grids[0]?.ownerSVGElement;

        return {
          gridCount: grids.length,
          gridIsScreenOverlay:
            gridOverlay?.parentElement?.classList.contains("canvas-host"),
          visibleCanvasCount: visibleCanvasSurfaces.length,
        };
      });
    })
    .toEqual({
      gridCount: 1,
      gridIsScreenOverlay: true,
      visibleCanvasCount: 1,
    });
  await page.mouse.up();

  await expect
    .poll(() => {
      return residentSource.evaluate((canvas: HTMLCanvasElement) => {
        return canvas.getContext("2d")?.getImageData(48, 32, 1, 1).data[3] || 0;
      });
    })
    .toBeGreaterThan(alphaBefore);
  await expect(
    page.locator(
      '[data-node-id="standalone-raster"] [data-raster-sampling="exact"]'
    )
  ).toBeVisible();

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const currentNode = editor?.getNode("standalone-raster");

    if (!(editor && brush && currentNode?.type === "image")) {
      throw new Error("Expected standalone Raster Brush target");
    }

    editor.getState().updateNodeById(currentNode.id, (node) => ({
      ...node,
      baseHeight: 64,
      baseWidth: 96,
      baseX: 12,
      baseY: 8,
      height: 80,
      transform: {
        ...node.transform,
        x: node.transform.x - 12,
        y: node.transform.y - 8,
      },
      width: 120,
    }));
    const node = editor.getNode("standalone-raster");

    if (node?.type !== "image") {
      throw new Error("Expected Crop-expanded Raster");
    }

    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 40,
      spacing: 0,
    });
    const toWorldPoint = (localPoint: { x: number; y: number }) => ({
      x: node.transform.x + localPoint.x,
      y: node.transform.y + localPoint.y,
    });
    const session = brush.beginStroke({
      point: toWorldPoint({ x: node.width / 2, y: node.height / 2 }),
    });

    if (!session) {
      throw new Error("Expected expanded Brush session");
    }

    (
      window as typeof window & {
        __PRD_129_BRUSH_SESSION__?: { cancel?: () => void };
      }
    ).__PRD_129_BRUSH_SESSION__ = session;
    session.update({ point: toWorldPoint({ x: 72, y: 40 }) });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  await expect
    .poll(() => {
      return page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const node = editor?.getNode("standalone-raster");
        const workingSurface =
          editor?.getBrushWorkingSurfaceStateForNode?.("standalone-raster");
        const grid = document.querySelector('[data-pixel-grid-kind="raster"]');
        const workingPlane =
          workingSurface?.type === "canvas"
            ? {
                height: workingSurface.height,
                sampleHeight: workingSurface.canvas.height,
                sampleWidth: workingSurface.canvas.width,
                width: workingSurface.width,
                x: workingSurface.x ?? 0,
                y: workingSurface.y ?? 0,
              }
            : null;

        return {
          gridCount: document.querySelectorAll(
            '[data-pixel-grid-kind="raster"]'
          ).length,
          gridUsesWorkingPlane: Boolean(
            grid &&
              workingPlane &&
              Math.abs(
                Number(grid.getAttribute("data-pixel-grid-origin-x")) -
                  workingPlane.x
              ) < 1e-6 &&
              Math.abs(
                Number(grid.getAttribute("data-pixel-grid-origin-y")) -
                  workingPlane.y
              ) < 1e-6 &&
              Math.abs(
                Number(grid.getAttribute("data-pixel-grid-cell-width")) -
                  workingPlane.width / workingPlane.sampleWidth
              ) < 1e-6 &&
              Math.abs(
                Number(grid.getAttribute("data-pixel-grid-cell-height")) -
                  workingPlane.height / workingPlane.sampleHeight
              ) < 1e-6
          ),
          workingPlaneDiffersFromNode: Boolean(
            node &&
              workingPlane &&
              (workingPlane.x !== (node.baseX ?? 0) ||
                workingPlane.y !== (node.baseY ?? 0) ||
                workingPlane.width !== (node.baseWidth ?? node.width) ||
                workingPlane.height !== (node.baseHeight ?? node.height))
          ),
        };
      });
    })
    .toEqual({
      gridCount: 1,
      gridUsesWorkingPlane: true,
      workingPlaneDiffersFromNode: true,
    });
  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __PRD_129_BRUSH_SESSION__?: { cancel?: () => void };
    };

    testWindow.__PRD_129_BRUSH_SESSION__?.cancel?.();
    testWindow.__PRD_129_BRUSH_SESSION__ = undefined;
  });
});

test.describe("transformed fractional exact Raster pixel grid", () => {
  test.use({ deviceScaleFactor: 1.5 });

  test("shares transform and resize thresholds while aligning exact contrasting cells", async ({
    page,
  }) => {
    await gotoEditor(page);
    const src = await createContrastRasterSource(page);

    await loadDocument(page, createFractionalRasterDocument(src));
    await page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;

      editor?.setFocusedGroup("fractional-group");
      editor?.select("fractional-raster");
    });
    const grid = page.locator('[data-pixel-grid-node-id="fractional-raster"]');
    const rasterPresentation = page.locator(
      '[data-node-id="fractional-render-root"] [data-raster-sampling]'
    );
    const resident = page.locator(
      '[data-node-id="fractional-render-root"] [data-testid="raster-resident-canvas"] canvas:visible'
    );
    const getMinSourcePixelFootprint = () =>
      resident.evaluate((canvas: HTMLCanvasElement) => {
        const source = canvas
          .closest("[data-raster-canvas-host]")
          ?.querySelector<HTMLCanvasElement>(
            'canvas[data-raster-source-canvas="true"]'
          );
        const destinationHeight = Number(
          canvas.getAttribute("data-raster-native-destination-height")
        );
        const destinationWidth = Number(
          canvas.getAttribute("data-raster-native-destination-width")
        );
        const sourceHeight = Number(
          canvas.getAttribute("data-raster-native-source-height")
        );
        const sourceWidth = Number(
          canvas.getAttribute("data-raster-native-source-width")
        );

        if (
          destinationHeight > 0 &&
          destinationWidth > 0 &&
          sourceHeight > 0 &&
          sourceWidth > 0
        ) {
          return (
            Math.min(
              destinationHeight / sourceHeight,
              destinationWidth / sourceWidth
            ) / window.devicePixelRatio
          );
        }

        const rect = canvas.getBoundingClientRect();

        return source
          ? Math.min(rect.height / source.height, rect.width / source.width)
          : 0;
      });
    const getEditorPreviewSnapshot = () =>
      page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const preview = editor?.selectionDragPreview;
        const root = document.querySelector(
          '[data-node-id="fractional-render-root"] [data-testid="raster-resident-canvas"]'
        );
        const canvas =
          root?.querySelector<HTMLCanvasElement>(
            'canvas[data-raster-exact-backing="true"]'
          ) ||
          root?.querySelector<HTMLCanvasElement>(
            'canvas[data-raster-source-canvas="true"]'
          );
        const source = canvas
          ?.closest("[data-raster-canvas-host]")
          ?.querySelector<HTMLCanvasElement>(
            'canvas[data-raster-source-canvas="true"]'
          );
        const canvasRect = canvas?.getBoundingClientRect();
        const destinationHeight = Number(
          canvas?.getAttribute("data-raster-native-destination-height")
        );
        const destinationWidth = Number(
          canvas?.getAttribute("data-raster-native-destination-width")
        );
        const sourceHeight = Number(
          canvas?.getAttribute("data-raster-native-source-height")
        );
        const sourceWidth = Number(
          canvas?.getAttribute("data-raster-native-source-width")
        );
        const exactFootprint =
          destinationHeight > 0 &&
          destinationWidth > 0 &&
          sourceHeight > 0 &&
          sourceWidth > 0
            ? {
                height:
                  destinationHeight / sourceHeight / window.devicePixelRatio,
                width: destinationWidth / sourceWidth / window.devicePixelRatio,
              }
            : null;

        return {
          activeLayerId: editor?.activeLayerId || null,
          activeLayerType: editor?.activeLayer?.type || null,
          actualSourcePixelFootprint: {
            height:
              exactFootprint?.height ??
              (canvasRect && source ? canvasRect.height / source.height : null),
            width:
              exactFootprint?.width ??
              (canvasRect && source ? canvasRect.width / source.width : null),
          },
          componentHostPresent: Boolean(
            canvas?.closest("[data-raster-canvas-host]")
          ),
          focusedGroupId: editor?.focusedGroupId || null,
          gridCount: document.querySelectorAll(
            '[data-pixel-grid-node-id="fractional-raster"]'
          ).length,
          preview: {
            effectiveNodeIds: preview?.effectiveNodeIdSet
              ? [...preview.effectiveNodeIdSet]
              : [],
            nodeIds: preview?.nodeIds || [],
            scale: preview?.resize?.scale ?? null,
          },
          selectedNodeIds: editor?.selectedNodeIds || [],
        };
      });
    const activeRasterSnapshot = await getEditorPreviewSnapshot();

    expect(activeRasterSnapshot).toMatchObject({
      activeLayerId: "fractional-raster",
      activeLayerType: "image",
      componentHostPresent: true,
      focusedGroupId: "fractional-group",
      selectedNodeIds: ["fractional-raster"],
    });

    await setConvergedViewport(page, {
      x: 318.25,
      y: 218.75,
      zoom: 0.5,
    });
    await expect(grid).toHaveCount(0);
    await expect(rasterPresentation).toHaveAttribute(
      "data-raster-sampling",
      "smooth"
    );
    expect(await getMinSourcePixelFootprint()).toBeLessThan(2);
    await page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const bounds = editor?.getNodeRenderFrame(
        "fractional-render-root"
      )?.bounds;
      const session = bounds
        ? editor?.beginResizeSelection({
            anchorCanvas: { x: bounds.minX, y: bounds.minY },
            nodeIds: ["fractional-render-root"],
          })
        : null;

      if (!(editor && session)) {
        throw new Error("Expected aggregate Raster resize session");
      }

      editor.updateResizeSelection(session, {
        scale: 4,
      });
    });
    await expect(rasterPresentation).toHaveAttribute(
      "data-raster-sampling",
      "exact"
    );
    await expect(grid).toHaveCount(1);
    await expect.poll(getMinSourcePixelFootprint).toBeGreaterThan(5);
    const resizePreviewSnapshot = await getEditorPreviewSnapshot();
    const resizePreviewDiagnostics = JSON.stringify(
      resizePreviewSnapshot,
      null,
      2
    );

    expect(resizePreviewSnapshot, resizePreviewDiagnostics).toMatchObject({
      activeLayerId: "fractional-raster",
      activeLayerType: "image",
      componentHostPresent: true,
      focusedGroupId: "fractional-group",
      preview: {
        nodeIds: ["fractional-render-root"],
        scale: 4,
      },
      selectedNodeIds: ["fractional-raster"],
    });
    expect(
      resizePreviewSnapshot.preview.effectiveNodeIds,
      resizePreviewDiagnostics
    ).toContain("fractional-raster");
    expect(
      resizePreviewSnapshot.actualSourcePixelFootprint.width,
      resizePreviewDiagnostics
    ).toBeGreaterThan(5);
    expect(
      resizePreviewSnapshot.actualSourcePixelFootprint.height,
      resizePreviewDiagnostics
    ).toBeGreaterThan(5);
    await expect(grid).toHaveCount(1);
    await expect(rasterPresentation).toHaveAttribute(
      "data-raster-sampling",
      "exact"
    );
    expect(await getMinSourcePixelFootprint()).toBeGreaterThan(5);
    await page.evaluate(() => {
      window.__PUNCHPRESS_EDITOR__?.setSelectionDragPreview(null);
    });
    await expect(grid).toHaveCount(0);
    await expect(rasterPresentation).toHaveAttribute(
      "data-raster-sampling",
      "smooth"
    );

    await setConvergedViewport(page, {
      x: 318.25,
      y: 218.75,
      zoom: 1.7,
    });
    await expect(grid).toHaveCount(0);
    await expect(rasterPresentation).toHaveAttribute(
      "data-raster-sampling",
      "exact"
    );
    expect(await getMinSourcePixelFootprint()).toBeLessThanOrEqual(5);
    const presentationBelowGrid = await captureRasterPresentation(
      page,
      "fractional-render-root"
    );
    await setConvergedViewport(page, {
      x: 318.25,
      y: 218.75,
      zoom: 1.75,
    });
    await expect(grid).toHaveCount(1);
    expect(await getMinSourcePixelFootprint()).toBeGreaterThan(5);
    const presentationAboveGrid = await captureRasterPresentation(
      page,
      "fractional-render-root"
    );
    const { gridCount: belowGridCount, ...stablePresentationBelowGrid } =
      presentationBelowGrid;
    const { gridCount: aboveGridCount, ...stablePresentationAboveGrid } =
      presentationAboveGrid;

    expect(belowGridCount).toBe(0);
    expect(aboveGridCount).toBe(1);
    expect(stablePresentationAboveGrid).toEqual(stablePresentationBelowGrid);

    await expect(grid).toHaveCount(1);
    await expect(grid).toBeVisible();
    await expect(resident).toBeVisible();
    await expect(grid.locator('[data-pixel-grid-tone="dark"]')).toHaveCount(2);
    await expect(grid.locator('[data-pixel-grid-tone="light"]')).toHaveCount(2);

    const geometry = await page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const node = editor?.getNode("fractional-raster");
      const gridElement = document.querySelector<SVGGElement>(
        '[data-pixel-grid-node-id="fractional-raster"]'
      );
      const gridSurface = gridElement?.ownerSVGElement;
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-node-id="fractional-render-root"] [data-testid="raster-resident-canvas"] canvas[data-raster-exact-backing="true"]'
      );
      const canvasHost = canvas?.closest("[data-raster-canvas-host]");
      const source = canvasHost?.querySelector<HTMLCanvasElement>(
        'canvas[data-raster-source-canvas="true"]'
      );
      const gridMatrix = gridElement?.getScreenCTM();

      if (
        !(
          node &&
          gridElement &&
          gridSurface &&
          canvas &&
          canvasHost &&
          source &&
          gridMatrix
        )
      ) {
        return null;
      }

      const gridRect = gridElement.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const cellWidth = Number(gridElement.dataset.pixelGridCellWidth);
      const cellHeight = Number(gridElement.dataset.pixelGridCellHeight);
      const originX = Number(gridElement.dataset.pixelGridOriginX);
      const originY = Number(gridElement.dataset.pixelGridOriginY);
      const origin = new DOMPoint(originX, originY).matrixTransform(gridMatrix);
      const nextColumn = new DOMPoint(
        originX + cellWidth,
        originY
      ).matrixTransform(gridMatrix);
      const nextRow = new DOMPoint(
        originX,
        originY + cellHeight
      ).matrixTransform(gridMatrix);
      const destinationHeight = Number(
        canvas.getAttribute("data-raster-native-destination-height")
      );
      const destinationWidth = Number(
        canvas.getAttribute("data-raster-native-destination-width")
      );
      const destinationX = Number(
        canvas.getAttribute("data-raster-native-destination-x")
      );
      const destinationY = Number(
        canvas.getAttribute("data-raster-native-destination-y")
      );
      const sourceHeight = Number(
        canvas.getAttribute("data-raster-native-source-height")
      );
      const sourceWidth = Number(
        canvas.getAttribute("data-raster-native-source-width")
      );
      const sourceX = Number(
        canvas.getAttribute("data-raster-native-source-x")
      );
      const sourceY = Number(
        canvas.getAttribute("data-raster-native-source-y")
      );
      const windowOrigin = new DOMPoint(
        originX + cellWidth * sourceX,
        originY + cellHeight * sourceY
      ).matrixTransform(gridMatrix);
      const physicalScale = window.devicePixelRatio;

      return {
        actualCellHeight: Math.hypot(
          nextRow.x - origin.x,
          nextRow.y - origin.y
        ),
        actualCellWidth: Math.hypot(
          nextColumn.x - origin.x,
          nextColumn.y - origin.y
        ),
        actualOriginX: windowOrigin.x,
        actualOriginY: windowOrigin.y,
        devicePixelRatio: physicalScale,
        expectedCellHeight: destinationHeight / sourceHeight / physicalScale,
        expectedCellWidth: destinationWidth / sourceWidth / physicalScale,
        expectedOriginX: canvasRect.left + destinationX / physicalScale,
        expectedOriginY: canvasRect.top + destinationY / physicalScale,
        gridMatrix: {
          a: gridMatrix.a,
          b: gridMatrix.b,
          c: gridMatrix.c,
          d: gridMatrix.d,
          e: gridMatrix.e,
          f: gridMatrix.f,
        },
        gridRect: {
          height: gridRect.height,
          left: gridRect.left,
          top: gridRect.top,
          width: gridRect.width,
        },
        gridIsScreenOverlay: gridSurface.parentElement === editor.hostRef,
        residentSamples: {
          height: source.height,
          width: source.width,
        },
        residentRect: {
          height: canvasRect.height,
          left: canvasRect.left,
          top: canvasRect.top,
          width: canvasRect.width,
        },
        sourceWindow: {
          height: sourceHeight,
          width: sourceWidth,
          x: sourceX,
          y: sourceY,
        },
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.devicePixelRatio).toBe(1.5);
    const geometryDiagnostics = JSON.stringify(geometry, null, 2);

    expect(geometry?.gridIsScreenOverlay, geometryDiagnostics).toBe(true);
    expect(geometry?.residentSamples, geometryDiagnostics).toEqual({
      height: 4,
      width: 7,
    });
    const physicalError = (actual?: number, expected?: number) => {
      return (
        Math.abs(
          (actual ?? Number.POSITIVE_INFINITY) -
            (expected ?? Number.NEGATIVE_INFINITY)
        ) * (geometry?.devicePixelRatio || 1)
      );
    };
    const expectExactAlignment = (actual?: number, expected?: number) => {
      expect(physicalError(actual, expected), geometryDiagnostics).toBeLessThan(
        MAX_EXACT_ALIGNMENT_ERROR_PHYSICAL_PIXELS
      );
    };
    const expectPresentationEdgeAlignment = (
      actual?: number,
      expected?: number
    ) => {
      expect(
        physicalError(actual, expected),
        geometryDiagnostics
      ).toBeLessThanOrEqual(MAX_NATIVE_PRESENTATION_EDGE_ERROR_PHYSICAL_PIXELS);
    };

    expectExactAlignment(
      geometry?.actualCellWidth,
      geometry?.expectedCellWidth
    );
    expectExactAlignment(
      geometry?.actualCellHeight,
      geometry?.expectedCellHeight
    );
    expectPresentationEdgeAlignment(
      geometry?.actualOriginX,
      geometry?.expectedOriginX
    );
    expectPresentationEdgeAlignment(
      geometry?.actualOriginY,
      geometry?.expectedOriginY
    );
    expect(
      geometry?.sourceWindow.x,
      geometryDiagnostics
    ).toBeGreaterThanOrEqual(0);
    expect(
      geometry?.sourceWindow.y,
      geometryDiagnostics
    ).toBeGreaterThanOrEqual(0);
    expect(
      (geometry?.sourceWindow.x || 0) + (geometry?.sourceWindow.width || 0),
      geometryDiagnostics
    ).toBeLessThanOrEqual(geometry?.residentSamples.width || 0);
    expect(
      (geometry?.sourceWindow.y || 0) + (geometry?.sourceWindow.height || 0),
      geometryDiagnostics
    ).toBeLessThanOrEqual(geometry?.residentSamples.height || 0);
    expect(
      geometry?.residentRect.width || Number.POSITIVE_INFINITY,
      geometryDiagnostics
    ).toBeLessThanOrEqual(
      (geometry?.gridRect.width || 0) + 1 / (geometry?.devicePixelRatio || 1)
    );
    expect(
      geometry?.residentRect.height || Number.POSITIVE_INFINITY,
      geometryDiagnostics
    ).toBeLessThanOrEqual(
      (geometry?.gridRect.height || 0) + 1 / (geometry?.devicePixelRatio || 1)
    );

    await page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const raster = editor?.getNode("fractional-raster");

      if (!(editor && raster?.type === "image")) {
        throw new Error("Expected fractional render-tree Raster");
      }

      editor.getState().updateNodeById(raster.id, (node) => ({
        ...node,
        opacity: 0,
      }));
    });
    await expect(rasterPresentation).toHaveAttribute(
      "data-raster-sampling",
      "exact"
    );
    await expect(
      page.locator(
        '[data-node-id="fractional-render-root"] canvas[data-raster-exact-backing="true"]'
      )
    ).toHaveCount(0);
  });
});

test.describe("high-zoom Raster pixel alignment", () => {
  test.use({ deviceScaleFactor: 2 });

  test("shares decoded sample boundaries through fractional native presentation", async ({
    page,
  }, testInfo) => {
    await gotoEditor(page);
    const src = await createNativeJpegSource(page);

    await page.evaluate(() => {
      const runtime = window.__PUNCHPRESS_EDITOR__?.rasterSurface;

      if (!runtime) {
        throw new Error("Expected Raster presentation runtime");
      }

      (
        window as typeof window & {
          __PUNCHPRESS_ORIGINAL_ENSURE_SURFACE__?: typeof runtime.ensureSurface;
        }
      ).__PUNCHPRESS_ORIGINAL_ENSURE_SURFACE__ = runtime.ensureSurface;
      runtime.ensureSurface = () => new Promise(() => undefined);
    });
    await loadDocument(page, createNativeJpegDocument(src));
    await page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;

      editor?.select("native-jpeg");
    });
    await setConvergedViewport(page, {
      x: 300,
      y: 200,
      zoom: 20,
    });

    const nativePlane = page.locator(
      '[data-node-id="native-jpeg"] [data-raster-native-sample-width="16"]'
    );
    const grid = page.locator('[data-pixel-grid-node-id="native-jpeg"]');
    const image = nativePlane.locator(
      '[data-testid="raster-native-image"] canvas[data-raster-exact-backing="true"]'
    );

    await expect(nativePlane).toHaveAttribute(
      "data-raster-native-sample-height",
      "8"
    );
    await expect(grid).toHaveCount(1);
    await expect(grid).toBeVisible();
    await expect(image).toHaveCSS("image-rendering", "auto");

    const geometry = await page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const plane = document.querySelector(
        '[data-node-id="native-jpeg"] [data-raster-native-sample-width="16"]'
      );
      const imageElement = document.querySelector<HTMLCanvasElement>(
        '[data-node-id="native-jpeg"] [data-testid="raster-native-image"] canvas[data-raster-exact-backing="true"]'
      );
      const foreignObject = imageElement?.closest("foreignObject");
      const gridElement = document.querySelector<SVGGElement>(
        '[data-pixel-grid-node-id="native-jpeg"]'
      );
      const gridMatrix = gridElement?.getScreenCTM();

      if (!(plane && imageElement && gridElement && gridMatrix)) {
        return null;
      }

      const gridOrigin = new DOMPoint(
        Number(gridElement.dataset.pixelGridOriginX),
        Number(gridElement.dataset.pixelGridOriginY)
      ).matrixTransform(gridMatrix);
      const gridColumn = new DOMPoint(
        Number(gridElement.dataset.pixelGridOriginX) +
          Number(gridElement.dataset.pixelGridCellWidth),
        Number(gridElement.dataset.pixelGridOriginY)
      ).matrixTransform(gridMatrix);
      const imageRect = imageElement.getBoundingClientRect();
      const gridRect = gridElement.getBoundingClientRect();
      const sourceHeight = Number(
        imageElement.getAttribute("data-raster-native-source-height")
      );
      const sourceWidth = Number(
        imageElement.getAttribute("data-raster-native-source-width")
      );
      const destinationHeight = Number(
        imageElement.getAttribute("data-raster-native-destination-height")
      );
      const destinationWidth = Number(
        imageElement.getAttribute("data-raster-native-destination-width")
      );
      const destinationX = Number(
        imageElement.getAttribute("data-raster-native-destination-x")
      );
      const destinationY = Number(
        imageElement.getAttribute("data-raster-native-destination-y")
      );
      const backingScaleX = imageRect.width / imageElement.width;
      const backingScaleY = imageRect.height / imageElement.height;

      return {
        backingSize: {
          height: imageElement.height,
          width: imageElement.width,
        },
        devicePixelRatio: window.devicePixelRatio,
        gridCellWidth: gridColumn.x - gridOrigin.x,
        gridOriginX: gridOrigin.x,
        gridRect: {
          height: gridRect.height,
          left: gridRect.left,
          top: gridRect.top,
          width: gridRect.width,
        },
        imageOriginX: imageRect.left + destinationX * backingScaleX,
        imageRect: {
          height: destinationHeight * backingScaleY,
          left: imageRect.left + destinationX * backingScaleX,
          top: imageRect.top + destinationY * backingScaleY,
          width: destinationWidth * backingScaleX,
        },
        imageSampleWidth: (destinationWidth * backingScaleX) / sourceWidth,
        naturalSize: {
          height: Number(
            plane.getAttribute("data-raster-native-sample-height")
          ),
          width: Number(plane.getAttribute("data-raster-native-sample-width")),
        },
        usesClippedInlinePresentation:
          Boolean(foreignObject?.contains(imageElement)) &&
          foreignObject?.getAttribute("overflow") === "hidden" &&
          plane.contains(imageElement),
        usesScreenGridOverlay:
          gridElement.ownerSVGElement?.parentElement === editor?.hostRef,
        sourceWindow: {
          height: sourceHeight,
          width: sourceWidth,
        },
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.devicePixelRatio).toBe(2);
    expect(geometry?.naturalSize).toEqual({ height: 8, width: 16 });
    expect(geometry?.sourceWindow).toEqual({ height: 8, width: 16 });
    expect(geometry?.usesClippedInlinePresentation).toBe(true);
    expect(geometry?.usesScreenGridOverlay).toBe(true);
    const geometryDiagnostics = JSON.stringify(geometry, null, 2);
    const physicalError = (actual?: number, expected?: number) => {
      return (
        Math.abs(
          (actual ?? Number.POSITIVE_INFINITY) -
            (expected ?? Number.NEGATIVE_INFINITY)
        ) * (geometry?.devicePixelRatio || 1)
      );
    };
    const expectExactAlignment = (actual?: number, expected?: number) => {
      expect(physicalError(actual, expected), geometryDiagnostics).toBeLessThan(
        MAX_EXACT_ALIGNMENT_ERROR_PHYSICAL_PIXELS
      );
    };
    const expectPresentationExtentAlignment = (
      actual?: number,
      expected?: number
    ) => {
      expect(
        physicalError(actual, expected),
        geometryDiagnostics
      ).toBeLessThanOrEqual(MAX_NATIVE_PRESENTATION_EDGE_ERROR_PHYSICAL_PIXELS);
    };
    const expectPresentationSampleAlignment = (
      actual?: number,
      expected?: number
    ) => {
      expect(
        physicalError(actual, expected),
        geometryDiagnostics
      ).toBeLessThanOrEqual(
        MAX_NATIVE_PRESENTATION_EDGE_ERROR_PHYSICAL_PIXELS /
          (geometry?.sourceWindow.width || 1)
      );
    };

    expectExactAlignment(geometry?.gridOriginX, geometry?.imageOriginX);
    expectPresentationSampleAlignment(
      geometry?.gridCellWidth,
      geometry?.imageSampleWidth
    );
    expectExactAlignment(geometry?.gridRect.left, geometry?.imageRect.left);
    expectExactAlignment(geometry?.gridRect.top, geometry?.imageRect.top);
    expectPresentationExtentAlignment(
      geometry?.gridRect.width,
      geometry?.imageRect.width
    );
    expectPresentationExtentAlignment(
      geometry?.gridRect.height,
      geometry?.imageRect.height
    );
    expect(
      Math.abs(
        (geometry?.backingSize.width || 0) -
          (geometry?.gridRect.width || 0) * (geometry?.devicePixelRatio || 1)
      ),
      geometryDiagnostics
    ).toBeLessThanOrEqual(MAX_NATIVE_PRESENTATION_EDGE_ERROR_PHYSICAL_PIXELS);

    const imageBox = await image.boundingBox();

    if (!imageBox) {
      throw new Error("Expected native JPEG bounds");
    }

    const viewport = page.viewportSize();

    expect(viewport).not.toBeNull();
    expect(imageBox.x).toBeGreaterThanOrEqual(0);
    expect(imageBox.y).toBeGreaterThanOrEqual(0);
    expect(imageBox.x + imageBox.width).toBeLessThanOrEqual(
      viewport?.width || 0
    );
    expect(imageBox.y + imageBox.height).toBeLessThanOrEqual(
      viewport?.height || 0
    );

    await grid.evaluate((element) => {
      element.style.visibility = "hidden";
    });
    const captureBox = {
      height: Math.ceil(imageBox.y + imageBox.height) - Math.floor(imageBox.y),
      width: Math.ceil(imageBox.x + imageBox.width) - Math.floor(imageBox.x),
      x: Math.floor(imageBox.x),
      y: Math.floor(imageBox.y),
    };
    const sourceSamplesPerStripe = 4;
    const expectedBoundaries = Array.from({ length: 3 }, (_, index) => {
      return (
        ((geometry?.gridOriginX || 0) +
          (geometry?.gridCellWidth || 0) *
            sourceSamplesPerStripe *
            (index + 1) -
          captureBox.x) *
        (geometry?.devicePixelRatio || 1)
      );
    });
    const screenshot = await page.screenshot({
      clip: captureBox,
      type: "png",
    });
    await testInfo.attach("native-jpeg-without-grid", {
      body: screenshot,
      contentType: "image/png",
    });
    const backingCapture = await image.evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Expected native presentation Canvas2D");
      }

      const row = context.getImageData(
        0,
        Math.floor(canvas.height / 2),
        canvas.width,
        1
      ).data;
      const lightness = Array.from({ length: canvas.width }, (_, x) => {
        const offset = x * 4;

        return (row[offset] + row[offset + 1] + row[offset + 2]) / (3 * 255);
      });

      return {
        destination: {
          height: Number(
            canvas.getAttribute("data-raster-native-destination-height")
          ),
          width: Number(
            canvas.getAttribute("data-raster-native-destination-width")
          ),
          x: Number(canvas.getAttribute("data-raster-native-destination-x")),
          y: Number(canvas.getAttribute("data-raster-native-destination-y")),
        },
        height: canvas.height,
        transitions: lightness.flatMap((value, x) => {
          if (x === 0) {
            return [];
          }

          const contrast = Math.abs(value - lightness[x - 1]);

          return contrast > 1 / 1024
            ? [{ contrast, left: lightness[x - 1], right: value, x }]
            : [];
        }),
        width: canvas.width,
      };
    });
    const sampledCapture = await page.evaluate(
      async ({ encoded, expectedBoundaries, sampleY }) => {
        const raster = new Image();

        raster.src = `data:image/png;base64,${encoded}`;
        await raster.decode();

        const canvas = document.createElement("canvas");

        canvas.width = raster.naturalWidth;
        canvas.height = raster.naturalHeight;

        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Expected screenshot Canvas2D");
        }

        context.drawImage(raster, 0, 0);
        const row = context.getImageData(
          0,
          Math.round(sampleY),
          canvas.width,
          1
        ).data;
        const lightness = Array.from({ length: canvas.width }, (_, x) => {
          const offset = x * 4;

          return (row[offset] + row[offset + 1] + row[offset + 2]) / (3 * 255);
        });

        const transitions = lightness.flatMap((value, x) => {
          if (x === 0) {
            return [];
          }

          const contrast = Math.abs(value - lightness[x - 1]);

          return contrast > 1 / 1024
            ? [{ contrast, left: lightness[x - 1], right: value, x }]
            : [];
        });

        return {
          boundaries: expectedBoundaries.map((expected) => {
            const min = Math.max(1, Math.floor(expected) - 4);
            const max = Math.min(canvas.width - 1, Math.ceil(expected) + 4);
            let boundary = min;
            let contrast = 0;

            for (let x = min; x <= max; x += 1) {
              const nextContrast = Math.abs(lightness[x] - lightness[x - 1]);

              if (nextContrast > contrast) {
                boundary = x;
                contrast = nextContrast;
              }
            }

            return { boundary, contrast };
          }),
          height: canvas.height,
          transitions,
          width: canvas.width,
        };
      },
      {
        encoded: screenshot.toString("base64"),
        expectedBoundaries,
        sampleY:
          (imageBox.y + imageBox.height / 2 - captureBox.y) *
          (geometry?.devicePixelRatio || 1),
      }
    );
    const expectedBackingBoundaries = Array.from({ length: 3 }, (_, index) => {
      return (
        backingCapture.destination.x +
        (backingCapture.destination.width *
          sourceSamplesPerStripe *
          (index + 1)) /
          (geometry?.sourceWindow.width || 1)
      );
    });
    const rendererDiagnostics = JSON.stringify(
      {
        backingCapture,
        captureBox,
        expectedBackingBoundaries,
        expectedBoundaries,
        geometry,
        sampledCapture,
      },
      null,
      2
    );

    await testInfo.attach("native-renderer-diagnostics", {
      body: rendererDiagnostics,
      contentType: "application/json",
    });

    for (const expectedBoundary of expectedBackingBoundaries) {
      const transition = backingCapture.transitions.reduce<{
        contrast: number;
        x: number;
      }>(
        (strongest, candidate) => {
          return Math.abs(candidate.x - expectedBoundary) <= 4 &&
            candidate.contrast > strongest.contrast
            ? candidate
            : strongest;
        },
        { contrast: 0, x: 0 }
      );

      expect(transition.contrast, rendererDiagnostics).toBeGreaterThan(0.2);
      expect(
        Math.abs(transition.x - expectedBoundary),
        rendererDiagnostics
      ).toBeLessThan(2);
    }

    const expectedCaptureWidth =
      captureBox.width * (geometry?.devicePixelRatio || 1);

    expect(
      Math.abs(sampledCapture.width - expectedCaptureWidth),
      rendererDiagnostics
    ).toBeLessThan(1);

    for (const [index, sample] of sampledCapture.boundaries.entries()) {
      const expectedBoundary = expectedBoundaries[index];

      expect(sample.contrast, rendererDiagnostics).toBeGreaterThan(0.2);
      expect(
        Math.abs(sample.boundary - expectedBoundary),
        rendererDiagnostics
      ).toBeLessThan(2);
    }

    await grid.evaluate((element) => {
      element.style.removeProperty("visibility");
    });
    await setConvergedViewport(page, {
      x: 335,
      y: 200,
      zoom: 20,
    });
    const getNativeWindow = () =>
      image.evaluate((canvas: HTMLCanvasElement) => {
        const foreignObject = canvas.closest("foreignObject");

        return {
          backingHeight: canvas.height,
          backingWidth: canvas.width,
          bounds: {
            height: Number(foreignObject?.getAttribute("height")),
            width: Number(foreignObject?.getAttribute("width")),
            x: Number(foreignObject?.getAttribute("x")),
            y: Number(foreignObject?.getAttribute("y")),
          },
          sourceHeight: Number(
            canvas.getAttribute("data-raster-native-source-height")
          ),
          sourceWidth: Number(
            canvas.getAttribute("data-raster-native-source-width")
          ),
          sourceX: Number(canvas.getAttribute("data-raster-native-source-x")),
          sourceY: Number(canvas.getAttribute("data-raster-native-source-y")),
        };
      });

    await expect
      .poll(async () => (await getNativeWindow()).sourceWidth)
      .toBeLessThan(16);
    const partialWindow = await getNativeWindow();
    const partialSignature = JSON.stringify(partialWindow);

    await page.evaluate(() => {
      window.__PUNCHPRESS_EDITOR__
        ?.getState()
        .updateNodeById("native-jpeg", (node) => ({
          ...node,
          transform: {
            ...node.transform,
            rotation: 45,
          },
        }));
    });
    await expect
      .poll(async () => JSON.stringify(await getNativeWindow()))
      .not.toBe(partialSignature);
    const rotatedWindow = await getNativeWindow();
    const rotatedViewport = page.viewportSize();
    const backingLimit =
      Math.hypot(rotatedViewport?.width || 0, rotatedViewport?.height || 0) * 2;

    expect(rotatedWindow.backingWidth).toBeLessThanOrEqual(
      Math.ceil(backingLimit)
    );
    expect(rotatedWindow.backingHeight).toBeLessThanOrEqual(
      Math.ceil(backingLimit)
    );

    await page.evaluate(() => {
      const runtime = window.__PUNCHPRESS_EDITOR__?.rasterSurface;
      const original = (
        window as typeof window & {
          __PUNCHPRESS_ORIGINAL_ENSURE_SURFACE__?: typeof runtime.ensureSurface;
        }
      ).__PUNCHPRESS_ORIGINAL_ENSURE_SURFACE__;

      if (!(runtime && original)) {
        throw new Error("Expected original Raster surface resolver");
      }

      runtime.ensureSurface = original;
      window.__PUNCHPRESS_EDITOR__?.newDocument();
    });
    await loadDocument(page, createNativeJpegDocument(src));
    await page.evaluate(() => {
      window.__PUNCHPRESS_EDITOR__?.select("native-jpeg");
    });
    await setConvergedViewport(page, {
      x: 300,
      y: 200,
      zoom: 20,
    });

    const residentGrid = page.locator(
      '[data-pixel-grid-node-id="native-jpeg"]'
    );
    const residentImage = page.locator(
      '[data-node-id="native-jpeg"] [data-testid="raster-resident-canvas"] canvas[data-raster-exact-backing="true"]'
    );

    await expect(residentGrid).toHaveCount(1);
    await expect(residentImage).toBeVisible();
    const residentGeometry = await page.evaluate(() => {
      const gridElement = document.querySelector<SVGGElement>(
        '[data-pixel-grid-node-id="native-jpeg"]'
      );
      const matrix = gridElement?.getScreenCTM();
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-node-id="native-jpeg"] [data-testid="raster-resident-canvas"] canvas[data-raster-exact-backing="true"]'
      );

      if (!(canvas && gridElement && matrix)) {
        return null;
      }

      const origin = new DOMPoint(
        Number(gridElement.dataset.pixelGridOriginX),
        Number(gridElement.dataset.pixelGridOriginY)
      ).matrixTransform(matrix);
      const column = new DOMPoint(
        Number(gridElement.dataset.pixelGridOriginX) +
          Number(gridElement.dataset.pixelGridCellWidth),
        Number(gridElement.dataset.pixelGridOriginY)
      ).matrixTransform(matrix);
      const canvasRect = canvas.getBoundingClientRect();

      return {
        cellWidth: column.x - origin.x,
        imageRect: {
          height: canvasRect.height,
          left: canvasRect.left,
          top: canvasRect.top,
          width: canvasRect.width,
        },
        originX: origin.x,
      };
    });

    expect(residentGeometry).not.toBeNull();
    const residentBox = await residentImage.boundingBox();

    if (!residentBox) {
      throw new Error("Expected resident JPEG bounds");
    }

    await residentGrid.evaluate((element) => {
      element.style.visibility = "hidden";
    });
    const residentCaptureBox = {
      height:
        Math.ceil(residentBox.y + residentBox.height) -
        Math.floor(residentBox.y),
      width:
        Math.ceil(residentBox.x + residentBox.width) -
        Math.floor(residentBox.x),
      x: Math.floor(residentBox.x),
      y: Math.floor(residentBox.y),
    };
    const residentScreenshot = await page.screenshot({
      clip: residentCaptureBox,
      type: "png",
    });
    const residentExpectedBoundaries = Array.from(
      { length: 3 },
      (_, index) =>
        ((residentGeometry?.originX || 0) +
          (residentGeometry?.cellWidth || 0) *
            sourceSamplesPerStripe *
            (index + 1) -
          residentCaptureBox.x) *
        2
    );
    const residentBoundaries = await page.evaluate(
      async ({ encoded, expectedBoundaries, sampleY }) => {
        const raster = new Image();

        raster.src = `data:image/png;base64,${encoded}`;
        await raster.decode();
        const canvas = document.createElement("canvas");

        canvas.width = raster.naturalWidth;
        canvas.height = raster.naturalHeight;
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Expected resident screenshot Canvas2D");
        }

        context.drawImage(raster, 0, 0);
        const row = context.getImageData(
          0,
          Math.round(sampleY),
          canvas.width,
          1
        ).data;
        const lightness = Array.from({ length: canvas.width }, (_, x) => {
          const offset = x * 4;

          return (row[offset] + row[offset + 1] + row[offset + 2]) / (3 * 255);
        });

        return expectedBoundaries.map((expected) => {
          const min = Math.max(1, Math.floor(expected) - 4);
          const max = Math.min(canvas.width - 1, Math.ceil(expected) + 4);
          let boundary = min;
          let contrast = 0;

          for (let x = min; x <= max; x += 1) {
            const nextContrast = Math.abs(lightness[x] - lightness[x - 1]);

            if (nextContrast > contrast) {
              boundary = x;
              contrast = nextContrast;
            }
          }

          return { boundary, contrast };
        });
      },
      {
        encoded: residentScreenshot.toString("base64"),
        expectedBoundaries: residentExpectedBoundaries,
        sampleY:
          (residentBox.y + residentBox.height / 2 - residentCaptureBox.y) * 2,
      }
    );
    const residentDiagnostics = JSON.stringify(
      {
        captureBox: residentCaptureBox,
        expectedBoundaries: residentExpectedBoundaries,
        geometry: residentGeometry,
        sampledBoundaries: residentBoundaries,
      },
      null,
      2
    );

    await testInfo.attach("resident-renderer-diagnostics", {
      body: residentDiagnostics,
      contentType: "application/json",
    });

    for (const [index, sample] of residentBoundaries.entries()) {
      expect(sample.contrast, residentDiagnostics).toBeGreaterThan(0.2);
      expect(
        Math.abs(sample.boundary - residentExpectedBoundaries[index]),
        residentDiagnostics
      ).toBeLessThan(2);
    }
  });

  test("keeps resident pixel phase aligned while zooming a viewport-clipped Raster", async ({
    page,
  }) => {
    await gotoEditor(page);
    const src = await page.evaluate(() => {
      const canvas = document.createElement("canvas");

      canvas.width = 1085;
      canvas.height = 8;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Expected Canvas2D");
      }

      for (let x = 0; x < canvas.width; x += 1) {
        context.fillStyle = x % 2 === 0 ? "#000" : "#fff";
        context.fillRect(x, 0, 1, canvas.height);
      }

      return canvas.toDataURL("image/png");
    });

    await loadDocument(
      page,
      JSON.stringify({
        nodes: [
          {
            assetId: "asset-zoom-phase",
            baseHeight: 8.41,
            baseWidth: 1084.63,
            baseX: 0,
            baseY: 0,
            height: 8.41,
            id: "zoom-phase",
            mimeType: "image/png",
            name: "Zoom phase",
            opacity: 1,
            parentId: "root",
            src,
            transform: {
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              x: 320.3,
              y: 220.6,
            },
            type: "image",
            visible: true,
            width: 1084.63,
          },
        ],
        version: "1.8",
      })
    );
    await page.evaluate(() => {
      window.__PUNCHPRESS_EDITOR__?.select("zoom-phase");
    });

    const grid = page.locator('[data-pixel-grid-node-id="zoom-phase"]');
    const image = page.locator(
      '[data-node-id="zoom-phase"] [data-testid="raster-resident-canvas"] canvas[data-raster-exact-backing="true"]'
    );

    for (const zoom of [74.08, 82.31, 86.97]) {
      await setConvergedViewport(page, {
        x: 820,
        y: 220,
        zoom,
      });
      await expect(grid).toBeVisible();
      await expect(image).toBeVisible();
      const geometry = await page.evaluate(() => {
        const gridElement = document.querySelector<SVGGElement>(
          '[data-pixel-grid-node-id="zoom-phase"]'
        );
        const matrix = gridElement?.getScreenCTM();
        const canvas = document.querySelector<HTMLCanvasElement>(
          '[data-node-id="zoom-phase"] [data-testid="raster-resident-canvas"] canvas[data-raster-exact-backing="true"]'
        );

        if (!(canvas && gridElement && matrix)) {
          return null;
        }

        const origin = new DOMPoint(
          Number(gridElement.dataset.pixelGridOriginX),
          Number(gridElement.dataset.pixelGridOriginY)
        ).matrixTransform(matrix);
        const nextColumn = new DOMPoint(
          Number(gridElement.dataset.pixelGridOriginX) +
            Number(gridElement.dataset.pixelGridCellWidth),
          Number(gridElement.dataset.pixelGridOriginY)
        ).matrixTransform(matrix);
        const rect = canvas.getBoundingClientRect();

        return {
          cellWidth: nextColumn.x - origin.x,
          devicePixelRatio: window.devicePixelRatio,
          originX: origin.x,
          sourceX: Number(canvas.getAttribute("data-raster-native-source-x")),
          rect: {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width,
          },
        };
      });

      expect(geometry).not.toBeNull();
      const viewport = page.viewportSize();

      if (!(geometry && viewport)) {
        throw new Error("Expected zoom-phase presentation geometry");
      }

      const captureBox = {
        height:
          Math.floor(Math.min(viewport.height, geometry.rect.bottom)) -
          Math.ceil(Math.max(0, geometry.rect.top)),
        width:
          Math.floor(Math.min(viewport.width, geometry.rect.right)) -
          Math.ceil(Math.max(0, geometry.rect.left)),
        x: Math.ceil(Math.max(0, geometry.rect.left)),
        y: Math.ceil(Math.max(0, geometry.rect.top)),
      };

      expect(captureBox.height).toBeGreaterThan(20);
      expect(captureBox.width).toBeGreaterThan(200);
      expect(geometry.sourceX).toBeGreaterThan(300);
      const expectedBoundaries = Array.from({ length: 1084 }, (_, index) => {
        return (
          (geometry.originX + geometry.cellWidth * (index + 1) - captureBox.x) *
          geometry.devicePixelRatio
        );
      }).filter(
        (boundary) =>
          boundary > geometry.cellWidth * geometry.devicePixelRatio * 0.5 &&
          boundary <
            captureBox.width * geometry.devicePixelRatio -
              geometry.cellWidth * geometry.devicePixelRatio * 0.5
      );

      expect(expectedBoundaries.length).toBeGreaterThan(3);
      await grid.evaluate((element) => {
        element.style.visibility = "hidden";
      });
      const screenshot = await page.screenshot({
        clip: captureBox,
        type: "png",
      });
      await grid.evaluate((element) => {
        element.style.removeProperty("visibility");
      });
      const samples = await page.evaluate(
        async ({ encoded, expectedBoundaries, sampleY, searchRadius }) => {
          const raster = new Image();

          raster.src = `data:image/png;base64,${encoded}`;
          await raster.decode();
          const canvas = document.createElement("canvas");

          canvas.width = raster.naturalWidth;
          canvas.height = raster.naturalHeight;
          const context = canvas.getContext("2d");

          if (!context) {
            throw new Error("Expected screenshot Canvas2D");
          }

          context.drawImage(raster, 0, 0);
          const row = context.getImageData(
            0,
            Math.round(sampleY),
            canvas.width,
            1
          ).data;
          const lightness = Array.from({ length: canvas.width }, (_, x) => {
            const offset = x * 4;

            return (
              (row[offset] + row[offset + 1] + row[offset + 2]) / (3 * 255)
            );
          });

          return expectedBoundaries.map((expected) => {
            const min = Math.max(1, Math.floor(expected - searchRadius));
            const max = Math.min(
              canvas.width - 1,
              Math.ceil(expected + searchRadius)
            );
            let boundary = min;
            let contrast = 0;

            for (let x = min; x <= max; x += 1) {
              const nextContrast = Math.abs(lightness[x] - lightness[x - 1]);

              if (nextContrast > contrast) {
                boundary = x;
                contrast = nextContrast;
              }
            }

            return {
              boundary,
              contrast,
              error: Math.abs(boundary - expected),
              expected,
            };
          });
        },
        {
          encoded: screenshot.toString("base64"),
          expectedBoundaries,
          sampleY:
            (geometry.rect.top + geometry.rect.height / 2 - captureBox.y) *
            geometry.devicePixelRatio,
          searchRadius: geometry.cellWidth * geometry.devicePixelRatio * 0.45,
        }
      );
      const diagnostics = JSON.stringify({ geometry, samples, zoom }, null, 2);

      for (const sample of samples) {
        expect(sample.contrast, diagnostics).toBeGreaterThan(0.8);
        expect(sample.error, diagnostics).toBeLessThan(2);
      }
    }
  });
});
