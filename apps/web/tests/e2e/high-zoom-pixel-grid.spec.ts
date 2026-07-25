import { expect, type Page, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocument,
  resetViewport,
  setViewport,
} from "./helpers/editor";

const MAX_EXACT_ALIGNMENT_ERROR_PHYSICAL_PIXELS = 0.01;

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
    const residentCanvas = nodeRoot?.querySelector<HTMLCanvasElement>(
      '[data-testid="raster-resident-canvas"] canvas'
    );
    const tiledSurface = nodeRoot?.querySelector("[data-raster-node-id]");
    const importedImage = nodeRoot?.querySelector("image");

    return {
      gridCount: document.querySelectorAll("[data-pixel-grid-kind]").length,
      imageRendering: residentCanvas
        ? getComputedStyle(residentCanvas).imageRendering
        : null,
      pixelOutput: residentCanvas?.toDataURL() || null,
      renderedSource: residentCanvas
        ? {
            height: residentCanvas.height,
            kind: "resident-canvas",
            width: residentCanvas.width,
          }
        : {
            href: importedImage?.getAttribute("href") || null,
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
      '[data-node-id="frame-raster"] [data-testid="raster-resident-canvas"] canvas'
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
    imageRendering: "pixelated",
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
    '[data-node-id="standalone-raster"] [data-testid="raster-resident-canvas"] canvas'
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
  expect(
    await resident.evaluate((node) => getComputedStyle(node).imageRendering)
  ).toBe("pixelated");

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
      const canvasHost = element.closest("[data-raster-canvas-host]");
      const cropPreview = element.closest(
        'svg[aria-label="Raster Crop preview"]'
      );

      return {
        cropPreviewLabel: cropPreview?.getAttribute("aria-label") || null,
        sharesCanvasHost: Boolean(canvasHost?.querySelector("canvas")),
      };
    })
  ).toEqual({
    cropPreviewLabel: "Raster Crop preview",
    sharesCanvasHost: true,
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

  const resident = page.locator(
    '[data-node-id="standalone-raster"] [data-testid="raster-resident-canvas"] canvas'
  );
  const residentBox = await resident.boundingBox();

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

  const alphaBefore = await resident.evaluate((canvas: HTMLCanvasElement) => {
    return canvas.getContext("2d")?.getImageData(48, 32, 1, 1).data[3] || 0;
  });

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
        const gridHost = grids[0]?.closest("[data-raster-canvas-host]");

        return {
          gridCount: grids.length,
          gridSharesVisibleCanvasHost: visibleCanvasSurfaces.some((surface) =>
            surface.contains(gridHost)
          ),
          visibleCanvasCount: visibleCanvasSurfaces.length,
        };
      });
    })
    .toEqual({
      gridCount: 1,
      gridSharesVisibleCanvasHost: true,
      visibleCanvasCount: 1,
    });
  await page.mouse.up();

  await expect
    .poll(() => {
      return resident.evaluate((canvas: HTMLCanvasElement) => {
        return canvas.getContext("2d")?.getImageData(48, 32, 1, 1).data[3] || 0;
      });
    })
    .toBeGreaterThan(alphaBefore);
  await expect(
    page.locator(
      '[data-node-id="standalone-raster"] [data-raster-sampling="exact"]'
    )
  ).toBeVisible();
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
      '[data-node-id="fractional-render-root"] [data-testid="raster-resident-canvas"] canvas'
    );
    const getMinSourcePixelFootprint = () =>
      resident.evaluate((canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();

        return Math.min(rect.height / canvas.height, rect.width / canvas.width);
      });
    const getEditorPreviewSnapshot = () =>
      page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const preview = editor?.selectionDragPreview;
        const canvas = document.querySelector<HTMLCanvasElement>(
          '[data-node-id="fractional-render-root"] [data-testid="raster-resident-canvas"] canvas'
        );
        const canvasRect = canvas?.getBoundingClientRect();

        return {
          activeLayerId: editor?.activeLayerId || null,
          activeLayerType: editor?.activeLayer?.type || null,
          actualSourcePixelFootprint: {
            height:
              canvasRect && canvas ? canvasRect.height / canvas.height : null,
            width:
              canvasRect && canvas ? canvasRect.width / canvas.width : null,
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

    const pattern = grid.getByTestId("pixel-grid-pattern");
    await expect(grid).toHaveCount(1);
    await expect(grid).toBeVisible();
    await expect(pattern).toBeAttached();
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
      const patternElement = gridElement?.querySelector("pattern");
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-node-id="fractional-render-root"] [data-testid="raster-resident-canvas"] canvas'
      );
      const canvasHost = canvas?.closest("[data-raster-canvas-host]");
      const gridMatrix = gridElement?.getScreenCTM();

      if (
        !(
          node &&
          gridElement &&
          gridSurface &&
          patternElement &&
          canvas &&
          canvasHost &&
          gridMatrix
        )
      ) {
        return null;
      }

      const gridRect = gridElement.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const cellWidth = Number(patternElement.getAttribute("width"));
      const cellHeight = Number(patternElement.getAttribute("height"));
      const originX = Number(patternElement.getAttribute("x"));
      const originY = Number(patternElement.getAttribute("y"));
      const origin = new DOMPoint(originX, originY).matrixTransform(gridMatrix);
      const nextColumn = new DOMPoint(
        originX + cellWidth,
        originY
      ).matrixTransform(gridMatrix);
      const nextRow = new DOMPoint(
        originX,
        originY + cellHeight
      ).matrixTransform(gridMatrix);

      return {
        actualCellHeight: Math.hypot(
          nextRow.x - origin.x,
          nextRow.y - origin.y
        ),
        actualCellWidth: Math.hypot(
          nextColumn.x - origin.x,
          nextColumn.y - origin.y
        ),
        actualOriginX: origin.x,
        actualOriginY: origin.y,
        devicePixelRatio: window.devicePixelRatio,
        expectedCellHeight: canvasRect.height / canvas.height,
        expectedCellWidth: canvasRect.width / canvas.width,
        expectedOriginX: canvasRect.left,
        expectedOriginY: canvasRect.top,
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
        gridSharesCanvasHost: canvasHost.contains(gridElement),
        gridViewBox: {
          height: gridSurface.viewBox.baseVal.height,
          width: gridSurface.viewBox.baseVal.width,
        },
        residentSamples: {
          height: canvas.height,
          width: canvas.width,
        },
        residentRect: {
          height: canvasRect.height,
          left: canvasRect.left,
          top: canvasRect.top,
          width: canvasRect.width,
        },
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.devicePixelRatio).toBe(1.5);
    const geometryDiagnostics = JSON.stringify(geometry, null, 2);

    expect(geometry?.gridSharesCanvasHost, geometryDiagnostics).toBe(true);
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

    expectExactAlignment(
      geometry?.actualCellWidth,
      geometry?.expectedCellWidth
    );
    expectExactAlignment(
      geometry?.actualCellHeight,
      geometry?.expectedCellHeight
    );
    expectExactAlignment(geometry?.actualOriginX, geometry?.expectedOriginX);
    expectExactAlignment(geometry?.actualOriginY, geometry?.expectedOriginY);
    expectExactAlignment(
      geometry?.gridRect.width,
      geometry?.residentRect.width
    );
    expectExactAlignment(
      geometry?.gridRect.height,
      geometry?.residentRect.height
    );
    expectExactAlignment(geometry?.gridRect.left, geometry?.residentRect.left);
    expectExactAlignment(geometry?.gridRect.top, geometry?.residentRect.top);
    expectExactAlignment(
      (geometry?.actualCellWidth || 0) * (geometry?.residentSamples.width || 0),
      geometry?.residentRect.width
    );
    expectExactAlignment(
      (geometry?.actualCellHeight || 0) *
        (geometry?.residentSamples.height || 0),
      geometry?.residentRect.height
    );
  });
});
