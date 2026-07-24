import { expect, type Page, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocument,
  resetViewport,
  setViewport,
} from "./helpers/editor";

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
        parentId: "root",
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
  await setConvergedViewport(page, { x: 180, y: 160, zoom: 5 });

  await expect(page.locator("[data-pixel-grid-kind]")).toHaveCount(0);

  await setConvergedViewport(page, { x: 180, y: 160, zoom: 5.01 });

  const grid = page.locator("[data-pixel-grid-kind]");

  await expect(grid).toHaveAttribute("data-pixel-grid-kind", "frame");
  await expect(grid).toHaveAttribute("data-pixel-grid-node-id", "frame");
  await expect(grid).toHaveAttribute(
    "data-pixel-grid-source-node-id",
    "frame-raster"
  );
  await expect(grid).toHaveAttribute("width", "160");
  await expect(grid).toHaveAttribute("height", "120");

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

  await expect(grid).toHaveCSS("left", "212.5px");
  await expect(grid).toHaveCSS("top", "188.25px");

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
  await expect(grid).toHaveAttribute("width", "160");
  await expect(grid).toHaveAttribute("height", "120");

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.newDocument();
  });

  await expect(page.locator("[data-pixel-grid-kind]")).toHaveCount(0);
});

test("uses exact samples for resident, tiled, and preview-capable Raster paths", async ({
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

  await setConvergedViewport(page, { x: 300, y: 200, zoom: 6.25 });

  await expect(tiledRaster).toHaveAttribute("data-raster-sampling", "exact");
  await expect(tiledRaster).toHaveAttribute(
    "data-raster-preview-eligible",
    "false"
  );
  await expect(tiledRaster).toHaveAttribute(
    "data-raster-preview-active",
    "false"
  );

  const exactTile = tiledRaster.locator("[data-raster-tile-ref]").first();

  await expect(exactTile).toBeAttached();
  expect(
    await exactTile.evaluate((node) => getComputedStyle(node).imageRendering)
  ).toBe("pixelated");
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

  await expect(cropGrid).toHaveAttribute("width", "72");
  await expect(cropGrid).toHaveAttribute("height", "44");
  await expect(cropGrid).toHaveCSS("left", "312px");
  await expect(cropGrid).toHaveCSS("top", "232px");
  await expect(cropGrid).toHaveCSS("z-index", "55");

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

test.describe("fractional exact Raster pixel grid", () => {
  test.use({ deviceScaleFactor: 1.5 });

  test("aligns one grid cell per exact sample with contrast on black and white", async ({
    page,
  }) => {
    await gotoEditor(page);
    const src = await createContrastRasterSource(page);

    await loadDocument(page, createFractionalRasterDocument(src));
    await page.evaluate(() => {
      window.__PUNCHPRESS_EDITOR__?.select("fractional-raster");
    });
    await setConvergedViewport(page, {
      x: 318.25,
      y: 218.75,
      zoom: 6.375,
    });

    const grid = page.locator('[data-pixel-grid-node-id="fractional-raster"]');
    const pattern = grid.getByTestId("pixel-grid-pattern");
    const resident = page.locator(
      '[data-node-id="fractional-raster"] [data-testid="raster-resident-canvas"] canvas'
    );

    await expect(grid).toBeVisible();
    await expect(pattern).toBeAttached();
    await expect(resident).toBeVisible();
    await expect(grid.locator('[data-pixel-grid-tone="dark"]')).toHaveCount(2);
    await expect(grid.locator('[data-pixel-grid-tone="light"]')).toHaveCount(2);

    const geometry = await page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const node = editor?.getNode("fractional-raster");
      const gridElement = document.querySelector<SVGSVGElement>(
        '[data-pixel-grid-node-id="fractional-raster"]'
      );
      const patternElement = gridElement?.querySelector("pattern");
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-node-id="fractional-raster"] [data-testid="raster-resident-canvas"] canvas'
      );

      if (!(node && gridElement && patternElement && canvas)) {
        return null;
      }

      const gridRect = gridElement.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const localScaleX = gridRect.width / node.width;
      const localScaleY = gridRect.height / node.height;

      return {
        actualCellHeight:
          Number(patternElement.getAttribute("height")) * localScaleY,
        actualCellWidth:
          Number(patternElement.getAttribute("width")) * localScaleX,
        actualOriginX:
          gridRect.left +
          Number(patternElement.getAttribute("x")) * localScaleX,
        actualOriginY:
          gridRect.top + Number(patternElement.getAttribute("y")) * localScaleY,
        devicePixelRatio: window.devicePixelRatio,
        expectedCellHeight: canvasRect.height / canvas.height,
        expectedCellWidth: canvasRect.width / canvas.width,
        expectedOriginX: canvasRect.left,
        expectedOriginY: canvasRect.top,
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.devicePixelRatio).toBe(1.5);
    expect(geometry?.actualCellWidth).toBeCloseTo(
      geometry?.expectedCellWidth || 0,
      5
    );
    expect(geometry?.actualCellHeight).toBeCloseTo(
      geometry?.expectedCellHeight || 0,
      5
    );
    expect(geometry?.actualOriginX).toBeCloseTo(
      geometry?.expectedOriginX || 0,
      5
    );
    expect(geometry?.actualOriginY).toBeCloseTo(
      geometry?.expectedOriginY || 0,
      5
    );
  });
});
