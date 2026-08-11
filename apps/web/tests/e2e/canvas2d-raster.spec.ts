import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocument,
  resetViewport,
  setViewport,
} from "./helpers/editor";
import { decodePng } from "./helpers/png";

const CLIP_PATH_REFERENCE = /url\(#.+\)/;

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
      toBlob: 0,
      toDataURL: 0,
    };
    const contextPrototype = CanvasRenderingContext2D.prototype;
    const originalGetImageData = contextPrototype.getImageData;
    const originalPutImageData = contextPrototype.putImageData;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;

    contextPrototype.getImageData = function (...args) {
      calls.getImageData += 1;
      return originalGetImageData.apply(this, args);
    };
    contextPrototype.putImageData = function (...args) {
      calls.putImageData += 1;
      return originalPutImageData.apply(this, args);
    };
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      calls.toBlob += 1;
      return originalToBlob.apply(this, args);
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
  const paintedAlpha = await sampleAlpha(canvas, { x: 80, y: 80 });

  expect(await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.undo())).toBe(
    true
  );
  expect(await sampleAlpha(canvas, { x: 80, y: 80 })).toBe(0);
  expect(await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.redo())).toBe(
    true
  );
  expect(await sampleAlpha(canvas, { x: 80, y: 80 })).toBe(paintedAlpha);
  await resetCanvasCalls(page);

  await page.keyboard.press("e");
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up();

  expect(await getCanvasCalls(page)).toEqual(zeroCanvasCalls);
  await expect.poll(() => sampleAlpha(canvas, { x: 80, y: 80 })).toBe(0);
  expect(await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.undo())).toBe(
    true
  );
  expect(await sampleAlpha(canvas, { x: 80, y: 80 })).toBe(paintedAlpha);
  expect(await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.redo())).toBe(
    true
  );
  expect(await sampleAlpha(canvas, { x: 80, y: 80 })).toBe(0);

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

test("async persistence excludes an uncommitted active Stroke", async ({
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

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");

    if (!(editor && brush)) {
      throw new Error("Expected Raster Brush");
    }

    editor.select("canvas2d-raster");
    editor.setActiveTool("brush");
    editor.setBrushSettings(
      { hardness: 1, opacity: 1, size: 24, spacing: 0 },
      "brush"
    );
    const session = brush.beginStroke({ point: { x: 400, y: 300 } });

    if (!session) {
      throw new Error("Expected active Stroke");
    }

    await session.ready;
    session.update({ point: { x: 430, y: 300 } });
    const presentation =
      editor.rasterSurface.getPresentation("canvas2d-raster");
    const liveAlpha =
      presentation?.canvas.getContext("2d")?.getImageData(80, 80, 1, 1)
        .data[3] || 0;
    const serialized = JSON.parse(await editor.serializeDocumentAsync());
    const serializedSource = serialized.nodes.find(
      (node) => node.id === "canvas2d-raster"
    )?.src;
    const image = new Image();

    image.src = serializedSource;
    await image.decode();
    const canvas = document.createElement("canvas");

    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");

    context?.drawImage(image, 0, 0, 256, 256);
    const persistedAlpha = context?.getImageData(80, 80, 1, 1).data[3] || 0;

    session.cancel();
    return { liveAlpha, persistedAlpha };
  });

  expect(result.liveAlpha).toBeGreaterThan(0);
  expect(result.persistedAlpha).toBe(0);
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
  const outsideCorner = await placeAndStroke(page, src, "decoding", "corner");
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
  expect(outsideCorner).toMatchObject({
    height: 64,
    historyRevisionDelta: 0,
    sourceChanged: false,
    transform: { x: 320, y: 220 },
    width: 64,
  });
  expect(decoding).toMatchObject({
    height: 64,
    historyRevisionDelta: 1,
    residentSurface: true,
    selectedNodeIds: ["placed-raster"],
    sourceChanged: false,
    transform: { x: 320, y: 220 },
    width: 64,
  });
  expect(immediate).toMatchObject({
    height: 64,
    residentSurface: true,
    selectedNodeIds: ["placed-raster"],
    transform: { x: 320, y: 220 },
    width: 64,
  });
});

test("Crop clips retained resident pixels and later reveals them on expansion", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = 100;
    canvas.height = 100;
    if (!context) {
      throw new Error("Expected Canvas2D");
    }

    context.fillStyle = "#0066ff";
    context.fillRect(0, 0, 100, 50);
    context.fillStyle = "#ff0033";
    context.fillRect(0, 50, 100, 50);
    return canvas.toDataURL("image/png");
  });

  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 200,
          id: "crop-frame",
          locked: false,
          name: "Crop Frame",
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
          width: 200,
        },
        {
          assetId: "asset-crop-render",
          height: 100,
          id: "crop-render",
          mimeType: "image/png",
          name: "Crop Render",
          opacity: 1,
          parentId: "crop-frame",
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
          width: 100,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  const residentCanvas = page.locator(
    '[data-node-id="crop-render"] [data-testid="raster-resident-canvas"] canvas[data-raster-source-canvas="true"]'
  );

  await expect(residentCanvas).toBeVisible();
  await residentCanvas.evaluate((canvas) => {
    canvas.dataset.surfaceIdentity = "crop-stable-canvas";
  });
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("crop-render");
    editor?.startCrop("crop-render");
    editor?.updateCrop({ height: 50, width: 100, x: 0, y: 0 });
    editor?.commitCrop();
    editor?.clearSelection();
  });

  const retainedPoint = await getRasterScreenPoint(page, "crop-render", {
    x: 50,
    y: 75,
  });

  expect(await sampleScreenshotPixel(page, retainedPoint)).not.toEqual({
    blue: 51,
    green: 0,
    red: 255,
  });
  const cropStateBeforePreview = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("crop-render");
    const residentCanvas = document.querySelector(
      '[data-node-id="crop-render"] [data-raster-source-canvas="true"]'
    );

    return {
      historyRevision: editor?.history.currentRevision,
      node: node ? structuredClone(node) : null,
      surfaceIdentity:
        residentCanvas instanceof HTMLCanvasElement
          ? residentCanvas.dataset.surfaceIdentity
          : null,
    };
  });
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("crop-render");
    editor?.startCrop("crop-render");
    editor?.updateCrop({ height: 200, width: 200, x: 0, y: 0 });
  });
  await expect(page.getByTestId("raster-crop-overlay")).toBeVisible();
  const activeCropRetainedPoint = await getRasterCropScreenPoint(page, {
    x: 50,
    y: 75,
  });
  const activeCropBeyondSourcePoint = await getRasterCropScreenPoint(page, {
    x: 160,
    y: 160,
  });

  expect(await sampleScreenshotPixel(page, activeCropRetainedPoint)).toEqual({
    blue: 51,
    green: 0,
    red: 255,
  });
  expect(
    await sampleScreenshotPixel(page, activeCropBeyondSourcePoint)
  ).toEqual({
    blue: 217,
    green: 217,
    red: 217,
  });
  const cropStateAfterCancel = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.cancelCrop();
    const node = editor?.getNode("crop-render");

    return {
      cropActive: Boolean(editor?.rasterCropSession),
      historyRevision: editor?.history.currentRevision,
      node: node ? structuredClone(node) : null,
    };
  });

  expect(cropStateAfterCancel).toEqual({
    cropActive: false,
    historyRevision: cropStateBeforePreview.historyRevision,
    node: cropStateBeforePreview.node,
  });
  await expect(residentCanvas).toHaveAttribute(
    "data-surface-identity",
    cropStateBeforePreview.surfaceIdentity
  );
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("crop-render");
    editor?.setActiveTool("brush");
    editor?.setBrushSettings(
      {
        color: "#000000",
        hardness: 1,
        opacity: 1,
        size: 12,
        smoothing: 0,
        spacing: 0,
      },
      "brush"
    );
  });
  const strokeStart = await getRasterScreenPoint(page, "crop-render", {
    x: 20,
    y: 25,
  });
  const strokeEnd = await getRasterScreenPoint(page, "crop-render", {
    x: 150,
    y: 25,
  });

  await page.mouse.move(strokeStart.x, strokeStart.y);
  await page.mouse.down();
  await page.mouse.move(strokeEnd.x, strokeEnd.y, { steps: 12 });

  const activeViewport = page
    .locator(
      '[data-raster-node-id="crop-render"] [data-raster-visible-viewport="true"]'
    )
    .first();
  const committedVisibleClip = activeViewport.locator("clipPath rect").first();
  const activeResidentGroup = activeViewport.locator(
    '[data-raster-resident-surface="canvas2d"]'
  );

  await expect(activeViewport).toHaveAttribute("height", "200");
  await expect(activeViewport).toHaveAttribute("width", "200");
  await expect(committedVisibleClip).toHaveAttribute("height", "50");
  await expect(committedVisibleClip).toHaveAttribute("width", "100");
  await expect(committedVisibleClip).toHaveAttribute("x", "0");
  await expect(committedVisibleClip).toHaveAttribute("y", "0");
  await expect(activeResidentGroup).toHaveAttribute(
    "clip-path",
    CLIP_PATH_REFERENCE
  );
  expect(await sampleScreenshotPixel(page, retainedPoint)).not.toEqual({
    blue: 51,
    green: 0,
    red: 255,
  });
  await page.evaluate(() => {
    window.dispatchEvent(new PointerEvent("pointercancel"));
  });
  const cropStateBeforeDone = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("crop-render");

    return {
      historyRevision: editor?.history.currentRevision,
      node: node ? structuredClone(node) : null,
    };
  });
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("crop-render");
    editor?.startCrop("crop-render");
    editor?.updateCrop({ height: 100, width: 100, x: 0, y: 0 });
    editor?.commitCrop();
    editor?.clearSelection();
  });

  expect(await sampleScreenshotPixel(page, retainedPoint)).toEqual({
    blue: 51,
    green: 0,
    red: 255,
  });
  const cropHistory = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("crop-render");

    return {
      historyRevision: editor?.history.currentRevision,
      node: node ? structuredClone(node) : null,
    };
  });
  expect(cropHistory.historyRevision).toBe(
    (cropStateBeforeDone.historyRevision ?? 0) + 1
  );
  const cropHistoryRoundTrip = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    const undone = editor?.undo() ?? false;
    const undoNode = editor?.getNode("crop-render");
    const redone = editor?.redo() ?? false;
    const redoNode = editor?.getNode("crop-render");

    return {
      redoNode: redoNode ? structuredClone(redoNode) : null,
      redone,
      undoNode: undoNode ? structuredClone(undoNode) : null,
      undone,
    };
  });
  expect(cropHistoryRoundTrip).toEqual({
    redoNode: cropHistory.node,
    redone: true,
    undoNode: cropStateBeforeDone.node,
    undone: true,
  });
  expect(
    await residentCanvas.evaluate((canvas) => canvas.dataset.surfaceIdentity)
  ).toBe("crop-stable-canvas");

  const persistedCrop = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("crop-render");
    editor?.startCrop("crop-render");
    editor?.updateCrop({ height: 50, width: 100, x: 0, y: 0 });
    editor?.commitCrop();
    const serialized = await editor?.serializeDocumentAsync();

    if (!serialized) {
      throw new Error("Expected serialized Crop document");
    }
    const savedDocument = JSON.parse(serialized);
    const node = savedDocument.nodes.find(
      (candidate) => candidate.id === "crop-render"
    );
    const image = new Image();

    image.src = node.src;
    await image.decode();
    const canvas = document.createElement("canvas");

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");

    context?.drawImage(image, 0, 0);
    const retained = context?.getImageData(50, 75, 1, 1).data;

    editor.loadDocument(serialized);
    return {
      baseHeight: node.baseHeight,
      baseWidth: node.baseWidth,
      naturalHeight: image.naturalHeight,
      naturalWidth: image.naturalWidth,
      pixelHeight: node.pixelHeight,
      pixelWidth: node.pixelWidth,
      retained: retained
        ? { blue: retained[2], green: retained[1], red: retained[0] }
        : null,
    };
  });

  expect(persistedCrop).toEqual({
    baseHeight: 200,
    baseWidth: 200,
    naturalHeight: 200,
    naturalWidth: 200,
    pixelHeight: 200,
    pixelWidth: 200,
    retained: { blue: 51, green: 0, red: 255 },
  });
  await expect(residentCanvas).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const presentation =
          window.__PUNCHPRESS_EDITOR__?.rasterSurface?.getPresentation?.(
            "crop-render"
          );

        return presentation
          ? {
              height: presentation.canvas.height,
              width: presentation.canvas.width,
            }
          : null;
      })
    )
    .toEqual({ height: 200, width: 200 });
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor.select("crop-render");
    const started = editor.startCrop("crop-render");
    const updated = editor.updateCrop({
      height: 100,
      width: 100,
      x: 0,
      y: 0,
    });
    const committed = editor.commitCrop();
    editor.clearSelection();

    if (!(started && updated && committed)) {
      throw new Error("Expected reopened Crop expansion to commit");
    }
  });

  const reopenedRetainedPoint = await getRasterScreenPoint(
    page,
    "crop-render",
    { x: 50, y: 75 }
  );

  expect(await sampleScreenshotPixel(page, reopenedRetainedPoint)).toEqual({
    blue: 51,
    green: 0,
    red: 255,
  });
});

test("Crop corner handles render inward-facing borders", async ({ page }) => {
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
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("canvas2d-raster");

    if (!editor?.startCrop("canvas2d-raster")) {
      throw new Error("Expected Crop to start for the selected Raster");
    }
  });

  const expectedSides = {
    ne: { bottom: false, left: false, right: true, top: true },
    nw: { bottom: false, left: true, right: false, top: true },
    se: { bottom: true, left: false, right: true, top: false },
    sw: { bottom: true, left: true, right: false, top: false },
  } as const;

  for (const [handleName, expected] of Object.entries(expectedSides)) {
    const handle = page.locator(
      `[data-testid="raster-crop-overlay"] [data-raster-crop-handle="${handleName}"]`
    );

    await expect(handle).toBeVisible();
    const actual = await handle.evaluate((element) => {
      const style = getComputedStyle(element);

      return {
        bottom: style.borderBottomWidth !== "0px",
        left: style.borderLeftWidth !== "0px",
        right: style.borderRightWidth !== "0px",
        top: style.borderTopWidth !== "0px",
      };
    });

    expect(actual, `${handleName} Crop corner border sides`).toEqual(expected);
  }

  const northwestHandle = page.locator(
    '[data-testid="raster-crop-overlay"] [data-raster-crop-handle="nw"]'
  );
  const northwestBox = await northwestHandle.boundingBox();

  if (!northwestBox) {
    throw new Error("Expected northwest Crop handle bounds");
  }

  const northwestPoint = {
    x: northwestBox.x + northwestBox.width / 2,
    y: northwestBox.y + northwestBox.height / 2,
  };

  await northwestHandle.hover();
  await page.mouse.down();
  await page.mouse.move(northwestPoint.x + 16, northwestPoint.y + 16, {
    steps: 2,
  });
  await expect(
    page.getByTestId("raster-crop-overlay").locator(":scope > svg")
  ).toHaveAttribute("width", "240");
  await expect(
    page.getByTestId("raster-crop-overlay").locator(":scope > svg")
  ).toHaveAttribute("height", "240");
  await page.mouse.up();

  await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.cancelCrop());
});

test("standalone Raster Crop preview reveals retained pixels before Done", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = 100;
    canvas.height = 100;
    if (!context) {
      throw new Error("Expected Canvas2D");
    }

    context.fillStyle = "#0066ff";
    context.fillRect(0, 0, 100, 50);
    context.fillStyle = "#ff0033";
    context.fillRect(0, 50, 100, 50);
    return canvas.toDataURL("image/png");
  });

  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          assetId: "asset-standalone-crop",
          height: 100,
          id: "standalone-crop",
          mimeType: "image/png",
          name: "Standalone Crop",
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
          width: 100,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  const residentCanvas = page.locator(
    '[data-node-id="standalone-crop"] [data-testid="raster-resident-canvas"] canvas[data-raster-source-canvas="true"]'
  );

  await expect(residentCanvas).toBeVisible();
  await residentCanvas.evaluate((canvas) => {
    canvas.dataset.surfaceIdentity = "standalone-crop-canvas";
  });
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("standalone-crop");
    editor?.startCrop("standalone-crop");
    editor?.updateCrop({ height: 50, width: 100, x: 0, y: 0 });
    editor?.commitCrop();
    editor?.clearSelection();
  });
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("standalone-crop");
    editor?.startCrop("standalone-crop");
  });
  await expect(page.getByTestId("raster-crop-overlay")).toBeVisible();
  const southHandle = page.locator(
    '[data-testid="raster-crop-overlay"] [data-raster-crop-handle="s"]'
  );
  const southHandleBox = await southHandle.boundingBox();

  if (!southHandleBox) {
    throw new Error("Expected standalone Crop south handle bounds");
  }

  const southHandlePoint = {
    x: southHandleBox.x + southHandleBox.width / 2,
    y: southHandleBox.y + southHandleBox.height / 2,
  };

  await southHandle.hover();
  await page.mouse.down();
  await page.mouse.move(southHandlePoint.x, southHandlePoint.y + 45, {
    steps: 4,
  });
  await expect(
    page.getByTestId("raster-crop-overlay").locator(":scope > svg")
  ).toHaveAttribute("height", "95");
  await page.mouse.move(southHandlePoint.x, southHandlePoint.y + 90, {
    steps: 4,
  });
  await expect(
    page.getByTestId("raster-crop-overlay").locator(":scope > svg")
  ).toHaveAttribute("height", "140");

  const retainedPoint = await getRasterCropScreenPoint(page, {
    x: 50,
    y: 75,
  });
  const beyondSourcePoint = await getRasterCropScreenPoint(page, {
    x: 50,
    y: 120,
  });

  expect(await sampleScreenshotPixel(page, retainedPoint)).toEqual({
    blue: 51,
    green: 0,
    red: 255,
  });
  expect(await sampleScreenshotPixel(page, beyondSourcePoint)).toEqual({
    blue: 217,
    green: 217,
    red: 217,
  });
  expect(
    await page.evaluate(() =>
      Boolean(window.__PUNCHPRESS_EDITOR__?.rasterCropSession)
    )
  ).toBe(true);

  await page.mouse.up();
  await page.getByTestId("raster-crop-done").click();
  await expect(page.getByTestId("raster-crop-overlay")).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const node = window.__PUNCHPRESS_EDITOR__?.getNode("standalone-crop");

      return node?.type === "image"
        ? { height: node.height, width: node.width }
        : null;
    })
  ).toEqual({ height: 140, width: 100 });
  await expect(residentCanvas).toHaveAttribute(
    "data-surface-identity",
    "standalone-crop-canvas"
  );
});

test("held Frame Brush stroke is visible beyond committed tight Raster bounds", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = 40;
    canvas.height = 40;
    if (!context) {
      throw new Error("Expected Canvas2D");
    }

    context.fillStyle = "#0066ff";
    context.fillRect(0, 0, 40, 40);
    return canvas.toDataURL("image/png");
  });

  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 200,
          id: "live-frame",
          locked: false,
          name: "Live Frame",
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
          width: 200,
        },
        {
          assetId: "asset-live-frame-raster",
          height: 40,
          id: "live-frame-raster",
          mimeType: "image/png",
          name: "Live Frame Raster",
          opacity: 1,
          parentId: "live-frame",
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
          width: 40,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  const residentCanvas = page.locator(
    '[data-node-id="live-frame-raster"] [data-testid="raster-resident-canvas"] canvas[data-raster-source-canvas="true"]'
  );

  await expect(residentCanvas).toBeVisible();
  await residentCanvas.evaluate((canvas) => {
    canvas.dataset.surfaceIdentity = "live-frame-stable-canvas";
  });
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("live-frame-raster");
    editor?.setActiveTool("brush");
    editor?.setBrushSettings(
      {
        color: "#000000",
        hardness: 1,
        opacity: 1,
        size: 12,
        smoothing: 0,
        spacing: 0,
      },
      "brush"
    );
  });
  const start = await getRasterScreenPoint(page, "live-frame-raster", {
    x: 20,
    y: 20,
  });
  const end = await getRasterScreenPoint(page, "live-frame-raster", {
    x: 100,
    y: 20,
  });
  const sample = await getRasterScreenPoint(page, "live-frame-raster", {
    x: 90,
    y: 20,
  });

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  );

  expect(await sampleScreenshotPixel(page, sample)).toEqual({
    blue: 0,
    green: 0,
    red: 0,
  });
  expect(
    await page.evaluate(
      () => window.__PUNCHPRESS_EDITOR__?.getNode("live-frame-raster")?.width
    )
  ).toBe(40);

  await page.mouse.up();

  expect(await sampleScreenshotPixel(page, sample)).toEqual({
    blue: 0,
    green: 0,
    red: 0,
  });
  expect(
    await residentCanvas.evaluate((canvas) => canvas.dataset.surfaceIdentity)
  ).toBe("live-frame-stable-canvas");
});

test("imported Raster landmarks preview live and commit to a resampled Canvas", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = 80;
    canvas.height = 60;
    if (!context) {
      throw new Error("Expected Canvas2D");
    }

    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, 40, 30);
    context.fillStyle = "#00ff00";
    context.fillRect(40, 0, 40, 30);
    context.fillStyle = "#0000ff";
    context.fillRect(0, 30, 40, 30);
    context.fillStyle = "#ffff00";
    context.fillRect(40, 30, 40, 30);
    return canvas.toDataURL("image/png");
  });

  await loadDocument(page, createImageDocumentWithSize(src, 80, 60));
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("canvas2d-raster");
  });
  const residentCanvas = page.locator(
    '[data-node-id="canvas2d-raster"] [data-testid="raster-resident-canvas"] canvas[data-raster-source-canvas="true"]'
  );

  await expect(residentCanvas).toBeVisible();
  await residentCanvas.evaluate((canvas) => {
    canvas.dataset.surfaceIdentity = "resize-stable-canvas";
  });
  const handle = page.locator(".canvas-moveable .moveable-control.moveable-se");

  await expect(handle).toBeVisible();
  const handleBox = await handle.boundingBox();

  if (!handleBox) {
    throw new Error("Expected southeast resize handle");
  }

  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 80,
    handleBox.y + handleBox.height / 2 + 60,
    { steps: 24 }
  );
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  );

  expect(await sampleSelectionFraction(page, { x: 0.75, y: 0.25 })).toEqual({
    blue: 0,
    green: 255,
    red: 0,
  });

  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__PUNCHPRESS_EDITOR__?.getRasterResizeState(
            "canvas2d-raster"
          ) ?? null
      )
    )
    .toBeNull();

  expect(await sampleSelectionFraction(page, { x: 0.75, y: 0.25 })).toEqual({
    blue: 0,
    green: 255,
    red: 0,
  });
  expect(await sampleSelectionFraction(page, { x: 0.75, y: 0.75 })).toEqual({
    blue: 0,
    green: 255,
    red: 255,
  });
  expect(
    await residentCanvas.evaluate((canvas) => canvas.dataset.surfaceIdentity)
  ).toBeUndefined();

  const persistedResize = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const serialized = await editor?.serializeDocumentAsync();

    if (!serialized) {
      throw new Error("Expected serialized resized Raster document");
    }
    const savedDocument = JSON.parse(serialized);
    const node = savedDocument.nodes.find(
      (candidate) => candidate.id === "canvas2d-raster"
    );
    const image = new Image();

    image.src = node.src;
    await image.decode();
    editor.loadDocument(serialized);
    editor.select("canvas2d-raster");
    return {
      naturalHeight: image.naturalHeight,
      naturalWidth: image.naturalWidth,
      pixelHeight: node.pixelHeight,
      pixelWidth: node.pixelWidth,
    };
  });

  expect(persistedResize).toEqual({
    naturalHeight: 120,
    naturalWidth: 160,
    pixelHeight: 120,
    pixelWidth: 160,
  });
  await expect(residentCanvas).toHaveCount(1);
  await expect
    .poll(() =>
      residentCanvas.evaluate((canvas) => ({
        height: canvas.height,
        width: canvas.width,
      }))
    )
    .toEqual({ height: 120, width: 160 });
  expect(
    await residentCanvas.evaluate((canvas) => ({
      height: canvas.height,
      width: canvas.width,
    }))
  ).toEqual({ height: 120, width: 160 });
  expect(await sampleSelectionFraction(page, { x: 0.75, y: 0.25 })).toEqual({
    blue: 0,
    green: 255,
    red: 0,
  });
});

test("Scratchpad autosave snapshots the latest committed resident pixels", async ({
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
  const canvas = page.locator(
    '[data-node-id="canvas2d-raster"] [data-testid="raster-resident-canvas"] canvas'
  );

  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error("Expected resident Raster canvas bounds");
  }

  await page.keyboard.press("b");
  await page.mouse.click(box.x + 80, box.y + 80);

  await expect
    .poll(
      () =>
        page.evaluate(async (previousSource) => {
          const { loadScratchpadDocument } = await import(
            "/src/workspace/scratchpad-storage.ts"
          );
          const contents = await loadScratchpadDocument();

          if (!contents) {
            return false;
          }

          const node = JSON.parse(contents).nodes?.find(
            (candidate) => candidate.id === "canvas2d-raster"
          );

          return node?.src !== previousSource;
        }, src),
      { timeout: 5000 }
    )
    .toBe(true);
});

const placeAndStroke = async (
  page: Page,
  src: string,
  mode: "decoding" | "reselected" | "selected",
  stroke: "corner" | "crossing" | "outside" = "crossing"
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
      const strokePoints = {
        corner: {
          endPoint: { x: 300, y: 200 },
          startPoint: { x: 300, y: 200 },
        },
        crossing: {
          endPoint: { x: 440, y: 340 },
          startPoint: { x: 352, y: 252 },
        },
        outside: {
          endPoint: { x: 460, y: 360 },
          startPoint: { x: 440, y: 340 },
        },
      };
      const { endPoint, startPoint } = strokePoints[strokeMode];
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

      await session.complete({ point: endPoint });

      const result = editor.getNode("placed-raster");

      if (result?.type !== "image") {
        throw new Error("Expected committed Raster");
      }

      return {
        height: result.height,
        historyRevisionDelta: editor.history.currentRevision - historyRevision,
        residentSurface: Boolean(
          editor.rasterSurface.getPresentation("placed-raster")
        ),
        selectedNodeIds: editor.selectedNodeIds,
        sourceChanged: result.src !== imageSource,
        transform: result.transform,
        width: result.width,
      };
    },
    { imageSource: src, placementMode: mode, strokeMode: stroke }
  );
};

const getRasterScreenPoint = async (
  page: Page,
  nodeId: string,
  point: { x: number; y: number }
) =>
  await page.evaluate(
    ({ id, localPoint }) => {
      const node = document.querySelector(`[data-raster-node-id="${id}"]`);
      const matrix = (node as SVGGraphicsElement | null)?.getScreenCTM();

      if (!matrix) {
        throw new Error(`Expected screen transform for ${id}`);
      }

      const screenPoint = new DOMPoint(
        localPoint.x,
        localPoint.y
      ).matrixTransform(matrix);

      return { x: screenPoint.x, y: screenPoint.y };
    },
    { id: nodeId, localPoint: point }
  );

const getRasterCropScreenPoint = async (
  page: Page,
  point: { x: number; y: number }
) =>
  await page
    .getByTestId("raster-crop-overlay")
    .locator(":scope > svg")
    .evaluate((svg, localPoint) => {
      const matrix = svg.getScreenCTM();

      if (!matrix) {
        throw new Error("Expected Crop preview screen transform");
      }

      const screenPoint = new DOMPoint(
        localPoint.x,
        localPoint.y
      ).matrixTransform(matrix);

      return { x: screenPoint.x, y: screenPoint.y };
    }, point);

const createImageDocumentWithSize = (
  src: string,
  width: number,
  height: number
) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-canvas2d-raster",
        height,
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
        width,
      },
    ],
    version: "1.8",
  });

const sampleSelectionFraction = async (
  page: Page,
  fraction: { x: number; y: number }
) => {
  const selection = page.locator(".canvas-moveable");
  const box = await selection.boundingBox();

  if (!box) {
    throw new Error("Expected selection bounds");
  }

  return await sampleScreenshotPixel(page, {
    x: box.x + box.width * fraction.x,
    y: box.y + box.height * fraction.y,
  });
};

const sampleScreenshotPixel = async (
  page: Page,
  point: { x: number; y: number }
) => {
  const screenshot = await page.screenshot({
    clip: {
      height: 1,
      width: 1,
      x: Math.round(point.x),
      y: Math.round(point.y),
    },
  });
  const png = decodePng(screenshot);

  return {
    blue: png.data[2],
    green: png.data[1],
    red: png.data[0],
  };
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
  toBlob: 0,
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
    calls.toBlob = 0;
    calls.toDataURL = 0;
  });
