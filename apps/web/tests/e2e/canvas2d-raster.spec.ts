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
