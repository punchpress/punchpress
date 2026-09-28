import { expect, test } from "@playwright/test";
import { gotoEditor, loadDocument, setViewport } from "./helpers/editor";

const createRasterDocument = (src: string) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-raster-resize",
        baseHeight: 60,
        baseWidth: 80,
        baseX: 0,
        baseY: 0,
        height: 60,
        id: "raster-resize",
        mimeType: "image/png",
        name: "Resizable Raster",
        opacity: 1,
        parentId: "root",
        pixelHeight: 60,
        pixelWidth: 80,
        src,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 120,
          y: 100,
        },
        type: "image",
        visible: true,
        width: 80,
      },
    ],
    version: "1.8",
  });

const setupRaster = async (page) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = 80;
    canvas.height = 60;
    context?.fillRect(0, 0, 80, 60);
    return canvas.toDataURL("image/png");
  });

  await loadDocument(page, createRasterDocument(src));
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("raster-resize");
  });
  await setViewport(page, { x: 0, y: 0, zoom: 8 });
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.setViewportInteracting(false);
    editor?.getState().setViewport({ x: 0, y: 0, zoom: 8 });
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__PUNCHPRESS_EDITOR__?.getState().viewport.zoom
      )
    )
    .toBe(8);
  await expect(
    page.locator('[data-testid="raster-resident-canvas"] canvas')
  ).toBeVisible();
};

test("publishes square Raster pixels and a new backing Canvas after resize", async ({
  page,
}) => {
  await setupRaster(page);

  const before = await page.evaluate(() => {
    const presentation =
      window.__PUNCHPRESS_EDITOR__?.rasterSurface?.getPresentation?.(
        "raster-resize"
      );

    return presentation
      ? { height: presentation.canvas.height, width: presentation.canvas.width }
      : null;
  });

  expect(before).toEqual({ height: 60, width: 80 });
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.setRasterAspectRatioLocked("raster-resize", false);
    await editor?.resizeRaster("raster-resize", { height: 75, width: 120 });
  });

  const committed = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("raster-resize");
    const presentation =
      editor?.rasterSurface?.getPresentation?.("raster-resize");

    return {
      canvas: presentation
        ? {
            height: presentation.canvas.height,
            width: presentation.canvas.width,
          }
        : null,
      node: node
        ? {
            height: node.height,
            pixelHeight: node.pixelHeight,
            pixelWidth: node.pixelWidth,
            width: node.width,
          }
        : null,
    };
  });

  expect(committed).toEqual({
    canvas: { height: 75, width: 120 },
    node: { height: 75, pixelHeight: 75, pixelWidth: 120, width: 120 },
  });
  const grid = page.locator('[data-pixel-grid-node-id="raster-resize"]');
  await expect(grid).toHaveAttribute("data-pixel-grid-cell-height", "1");
  await expect(grid).toHaveAttribute("data-pixel-grid-cell-width", "1");

  const persisted = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const serialized = await editor?.serializeDocumentAsync();

    if (!(editor && serialized)) {
      throw new Error("Expected a serialized resized Raster");
    }

    const document = JSON.parse(serialized);
    const node = document.nodes.find(
      (candidate) => candidate.id === "raster-resize"
    );
    const image = new Image();

    image.src = node.src;
    await image.decode();
    const exported = await editor.exportDocument();

    editor.loadDocument(serialized);
    editor.select("raster-resize");
    return {
      exportIncludesCommittedPixels: exported.includes(node.src),
      naturalHeight: image.naturalHeight,
      naturalWidth: image.naturalWidth,
      pixelHeight: node.pixelHeight,
      pixelWidth: node.pixelWidth,
    };
  });

  expect(persisted).toEqual({
    exportIncludesCommittedPixels: true,
    naturalHeight: 75,
    naturalWidth: 120,
    pixelHeight: 75,
    pixelWidth: 120,
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const presentation =
          window.__PUNCHPRESS_EDITOR__?.rasterSurface?.getPresentation?.(
            "raster-resize"
          );

        return presentation
          ? {
              height: presentation.canvas.height,
              width: presentation.canvas.width,
            }
          : null;
      })
    )
    .toEqual({ height: 75, width: 120 });
});

test("groups Width and Height around one spanning aspect control", async ({
  page,
}) => {
  await setupRaster(page);

  const dimensions = page.getByRole("group", { name: "Image dimensions" });
  const linkColumn = dimensions.locator("[data-image-dimensions-link]");
  const width = dimensions.getByRole("slider", { name: "Image width" });
  const height = dimensions.getByRole("slider", { name: "Image height" });

  await expect(width).toBeVisible();
  await expect(height).toBeVisible();
  await expect(
    dimensions.getByRole("button", { name: "Unlock image aspect ratio" })
  ).toBeVisible();
  await expect(linkColumn).toHaveCount(1);
  expect(
    await linkColumn.evaluate((element) => {
      const style = getComputedStyle(element);

      return {
        alignSelf: style.alignSelf,
        gridColumnStart: style.gridColumnStart,
        gridRowEnd: style.gridRowEnd,
        gridRowStart: style.gridRowStart,
      };
    })
  ).toEqual({
    alignSelf: "center",
    gridColumnStart: "2",
    gridRowEnd: "span 2",
    gridRowStart: "1",
  });
  expect(
    await Promise.all(
      [
        dimensions.getByText("Width", { exact: true }),
        width.locator(".."),
        dimensions.getByText("Height", { exact: true }),
        height.locator(".."),
      ].map((locator) =>
        locator.evaluate((element) => {
          const style = getComputedStyle(element);

          return `${style.gridColumnStart}/${style.gridRowStart}`;
        })
      )
    )
  ).toEqual(["1/1", "3/1", "1/2", "3/2"]);
});

test("Shift preserves aspect ratio while handle-resizing an unlocked Raster", async ({
  page,
}) => {
  await setupRaster(page);
  await setViewport(page, { x: 0, y: 0, zoom: 4 });
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.setViewportInteracting(false);
    editor?.getState().setViewport({ x: 0, y: 0, zoom: 4 });
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__PUNCHPRESS_EDITOR__?.getState().viewport.zoom
      )
    )
    .toBe(4);

  await page.getByRole("button", { name: "Unlock image aspect ratio" }).click();
  await expect(
    page.getByRole("button", { name: "Lock image aspect ratio" })
  ).toBeVisible();

  const handle = page.locator(".canvas-moveable .moveable-control.moveable-se");
  const box = await handle.boundingBox();

  if (!box) {
    throw new Error("Expected the southeast Raster resize handle");
  }

  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await page.keyboard.down("Shift");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 160, start.y + 40, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up("Shift");

  await expect
    .poll(() =>
      page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const node = editor?.getNode("raster-resize");
        const canvas =
          editor?.rasterSurface?.getPresentation?.("raster-resize")?.canvas;

        return node && canvas
          ? {
              canvasHeight: canvas.height,
              canvasWidth: canvas.width,
              height: node.height,
              width: node.width,
            }
          : null;
      })
    )
    .toEqual({
      canvasHeight: 90,
      canvasWidth: 120,
      height: 90,
      width: 120,
    });
});

test("keeps a rotated Raster preview aligned with its resize frame", async ({
  page,
}) => {
  await setupRaster(page);
  await setViewport(page, { x: 0, y: 0, zoom: 2 });
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.setViewportInteracting(false);
    editor?.getState().setViewport({ x: 0, y: 0, zoom: 2 });
    editor?.updateNode("raster-resize", {
      transform: { rotation: 35 },
    });
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__PUNCHPRESS_EDITOR__?.getState().viewport.zoom
      )
    )
    .toBe(2);
  await page.getByRole("button", { name: "Unlock image aspect ratio" }).click();

  const handle = page.locator(".canvas-moveable .moveable-control.moveable-se");
  const handleBox = await handle.boundingBox();

  if (!handleBox) {
    throw new Error("Expected the southeast Raster resize handle");
  }

  const start = {
    x: handleBox.x + handleBox.width / 2,
    y: handleBox.y + handleBox.height / 2,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 120, start.y + 30, { steps: 12 });

  const frameBox = await page.locator(".canvas-single-selection").boundingBox();
  const rasterBox = await page
    .locator('[data-node-id="raster-resize"]')
    .boundingBox();

  expect(frameBox).not.toBeNull();
  expect(rasterBox).not.toBeNull();
  expect.soft(rasterBox?.x).toBeCloseTo(frameBox?.x ?? 0, 0);
  expect.soft(rasterBox?.y).toBeCloseTo(frameBox?.y ?? 0, 0);
  expect.soft(rasterBox?.width).toBeCloseTo(frameBox?.width ?? 0, 0);
  expect.soft(rasterBox?.height).toBeCloseTo(frameBox?.height ?? 0, 0);

  await page.mouse.up();
});

test("disables Raster resize controls and delays the Resizing status", async ({
  page,
}) => {
  await setupRaster(page);

  const lock = page.getByRole("button", {
    name: "Unlock image aspect ratio",
  });
  const width = page.getByRole("slider", { name: "Image width" });
  const height = page.getByRole("slider", { name: "Image height" });

  await expect(lock).toHaveAttribute("data-pressed", "");
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const runtime = editor?.rasterSurface;

    if (!(editor && runtime?.resampleSurface)) {
      throw new Error("Expected a resample-capable Raster runtime");
    }

    const original = runtime.resampleSurface.bind(runtime);
    let release = () => undefined;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });

    window.__PUNCHPRESS_RELEASE_RASTER_RESIZE__ = release;
    runtime.resampleSurface = async (request) => {
      await delayed;
      return await original(request);
    };
    window.__PUNCHPRESS_RASTER_RESIZE_COMPLETION__ = editor.resizeRaster(
      "raster-resize",
      { width: 120 }
    );
  });

  await expect(width).toHaveAttribute("aria-disabled", "true");
  await expect(height).toHaveAttribute("aria-disabled", "true");
  await expect(lock).toBeDisabled();
  await expect(page.getByText("Resizing…")).toHaveCount(0);
  await expect(page.getByText("Resizing…")).toBeVisible({ timeout: 500 });
  await expect(page.locator("[data-image-resize-status]")).toHaveCSS(
    "grid-column-start",
    "3"
  );

  await page.evaluate(async () => {
    window.__PUNCHPRESS_RELEASE_RASTER_RESIZE__?.();
    await window.__PUNCHPRESS_RASTER_RESIZE_COMPLETION__;
  });
  await expect(width).not.toHaveAttribute("aria-disabled", "true");
  await expect(height).not.toHaveAttribute("aria-disabled", "true");
  await expect(lock).toBeEnabled();
  await expect(page.getByText("Resizing…")).toHaveCount(0);
});
