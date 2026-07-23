import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocument,
  resetViewport,
  setViewport,
} from "./helpers/editor";

const createImageDocument = (src: string) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-canvas2d-raster",
        height: 256,
        id: "canvas2d-raster",
        mimeType: "image/png",
        name: "Canvas2D Raster",
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
        width: 256,
      },
    ],
    version: "1.8",
  });

test("existing Raster paints, erases, and cancels on one resident Canvas2D surface", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");

    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/png");
  });

  await loadDocument(page, createImageDocument(src));
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });

  const canvas = page.locator(
    '[data-node-id="canvas2d-raster"] [data-testid="raster-resident-canvas"] canvas'
  );

  await expect(canvas).toBeVisible();
  await canvas.evaluate((element) => {
    element.dataset.surfaceIdentity = crypto.randomUUID();
  });

  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error("Expected the resident Raster canvas bounds");
  }

  const point = { x: box.x + 80, y: box.y + 80 };
  const cancelPoint = { x: box.x + 160, y: box.y + 160 };

  await page.evaluate(() => {
    const calls = {
      getImageData: 0,
      putImageData: 0,
      toDataURL: 0,
    };
    const contextPrototype = CanvasRenderingContext2D.prototype;
    const originalGetImageData = contextPrototype.getImageData;
    const originalPutImageData = contextPrototype.putImageData;
    const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;

    contextPrototype.getImageData = function (...args) {
      calls.getImageData += 1;
      return originalGetImageData.apply(this, args);
    };
    contextPrototype.putImageData = function (...args) {
      calls.putImageData += 1;
      return originalPutImageData.apply(this, args);
    };
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      calls.toDataURL += 1;
      return originalToDataUrl.apply(this, args);
    };
    window.__PUNCHPRESS_CANVAS2D_CALLS__ = calls;
  });

  await page.keyboard.press("b");
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 48, point.y, { steps: 12 });
  await page.mouse.up();

  expect(await getCanvasCalls(page)).toEqual(zeroCanvasCalls);
  await expect
    .poll(() => sampleAlpha(canvas, { x: 80, y: 80 }))
    .toBeGreaterThan(0);
  await resetCanvasCalls(page);

  await page.keyboard.press("e");
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up();

  expect(await getCanvasCalls(page)).toEqual(zeroCanvasCalls);
  await expect.poll(() => sampleAlpha(canvas, { x: 80, y: 80 })).toBe(0);

  const alphaBeforeCancel = await sampleAlpha(canvas, { x: 160, y: 160 });

  await resetCanvasCalls(page);
  await page.keyboard.press("b");
  await page.mouse.move(cancelPoint.x, cancelPoint.y);
  await page.mouse.down();
  await page.evaluate(() => {
    window.dispatchEvent(new PointerEvent("pointercancel"));
  });

  expect(await getCanvasCalls(page)).toEqual(zeroCanvasCalls);
  await expect
    .poll(() => sampleAlpha(canvas, { x: 160, y: 160 }))
    .toBe(alphaBeforeCancel);

  const result = await page.evaluate(() => {
    const residentCanvas = document.querySelector(
      '[data-testid="raster-resident-canvas"] canvas'
    );
    const node = window.__PUNCHPRESS_EDITOR__?.getNode("canvas2d-raster");

    return {
      sourceStillSinglePayload: node?.type === "image" ? node.src : null,
      surfaceIdentity:
        residentCanvas instanceof HTMLCanvasElement
          ? residentCanvas.dataset.surfaceIdentity
          : null,
    };
  });

  expect(result.sourceStillSinglePayload).toBe(src);
  expect(result.surfaceIdentity).toBeTruthy();
});

test("placed Raster stays clipped before and after reselection", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");

    canvas.width = 64;
    canvas.height = 64;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Expected Canvas2D");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  });

  const decoding = await placeAndStroke(page, src, "decoding");
  const outside = await placeAndStroke(page, src, "decoding", "outside");
  const immediate = await placeAndStroke(page, src, "selected");
  const reselected = await placeAndStroke(page, src, "reselected");

  expect(immediate).toEqual(reselected);
  expect(outside).toMatchObject({
    height: 64,
    historyRevisionDelta: 0,
    sourceChanged: false,
    transform: { x: 320, y: 220 },
    width: 64,
  });
  expect(decoding).toMatchObject({
    height: 64,
    historyRevisionDelta: 1,
    selectedNodeIds: ["placed-raster"],
    sourceChanged: true,
    transform: { x: 320, y: 220 },
    width: 64,
    workingSurface: { height: 64, type: "canvas", width: 64 },
  });
  expect(immediate).toMatchObject({
    height: 64,
    workingSurface: null,
    selectedNodeIds: ["placed-raster"],
    transform: { x: 320, y: 220 },
    width: 64,
  });
});

const placeAndStroke = async (
  page: Page,
  src: string,
  mode: "decoding" | "reselected" | "selected",
  stroke: "crossing" | "outside" = "crossing"
) => {
  return await page.evaluate(
    async ({ imageSource, placementMode, strokeMode }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;

      if (!editor) {
        throw new Error("Expected editor");
      }

      editor.newDocument();
      const node = {
        assetId: "asset-placed-raster",
        height: 64,
        id: "placed-raster",
        mimeType: "image/png",
        name: "Placed Raster",
        opacity: 1,
        parentId: "root",
        src: imageSource,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 320,
          y: 220,
        },
        type: "image",
        visible: true,
        width: 64,
      };

      editor.insertNodes([node]);

      if (placementMode !== "decoding") {
        await editor.rasterSurface.ensureSurface({
          height: node.height,
          id: node.id,
          src: node.src,
          width: node.width,
        });
      }

      if (placementMode === "reselected") {
        editor.clearSelection();
        editor.select(node.id);
      }

      editor.setActiveTool("brush");
      editor.setBrushSettings(
        { hardness: 1, opacity: 1, size: 24, spacing: 0 },
        "brush"
      );
      const startPoint =
        strokeMode === "outside" ? { x: 440, y: 340 } : { x: 352, y: 252 };
      const endPoint =
        strokeMode === "outside" ? { x: 460, y: 360 } : { x: 440, y: 340 };
      const historyRevision = editor.history.currentRevision;

      const session =
        placementMode === "reselected"
          ? editor.currentTool.onNodePointerDown({
              node,
              point: startPoint,
            })
          : editor.currentTool.onCanvasPointerDown({
              point: startPoint,
            });

      if (!session) {
        throw new Error("Expected Brush session");
      }

      session.update({ point: endPoint });
      await session.ready;

      const workingSurface =
        editor.getBrushWorkingSurfaceStateForNode("placed-raster");

      await session.complete({ point: endPoint });

      const result = editor.getNode("placed-raster");

      if (result?.type !== "image") {
        throw new Error("Expected committed Raster");
      }

      return {
        height: result.height,
        historyRevisionDelta: editor.history.currentRevision - historyRevision,
        selectedNodeIds: editor.selectedNodeIds,
        sourceChanged: result.src !== imageSource,
        transform: result.transform,
        width: result.width,
        workingSurface: workingSurface
          ? {
              height: workingSurface.height,
              type: workingSurface.type,
              width: workingSurface.width,
            }
          : null,
      };
    },
    { imageSource: src, placementMode: mode, strokeMode: stroke }
  );
};

const sampleAlpha = (canvas: Locator, point: { x: number; y: number }) =>
  canvas.evaluate(
    (element: HTMLCanvasElement, samplePoint: { x: number; y: number }) =>
      element
        .getContext("2d")
        ?.getImageData(samplePoint.x, samplePoint.y, 1, 1)
        .data.at(3) || 0,
    point
  );

const zeroCanvasCalls = {
  getImageData: 0,
  putImageData: 0,
  toDataURL: 0,
};

const getCanvasCalls = (page: Page) =>
  page.evaluate(() => ({ ...window.__PUNCHPRESS_CANVAS2D_CALLS__ }));

const resetCanvasCalls = (page: Page) =>
  page.evaluate(() => {
    const calls = window.__PUNCHPRESS_CANVAS2D_CALLS__;

    if (!calls) {
      return;
    }

    calls.getImageData = 0;
    calls.putImageData = 0;
    calls.toDataURL = 0;
  });
