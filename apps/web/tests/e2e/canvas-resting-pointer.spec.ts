import { expect, test } from "@playwright/test";
import { gotoEditor, loadDocument, setViewport } from "./helpers/editor";

const ARTBOARD_DOCUMENT = JSON.stringify({
  nodes: [
    {
      background: "#ffffff",
      height: 540,
      id: "artboard-1",
      locked: false,
      name: "Artboard 1",
      parentId: "root",
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 100, y: 100 },
      type: "artboard",
      visible: true,
      width: 450,
    },
  ],
  version: "1.8",
});

const getArtboardCenter = async (page) => {
  const box = await page
    .locator('[data-artboard-body="artboard-1"]')
    .boundingBox();

  if (!box) {
    throw new Error("Expected the artboard body");
  }

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test("pen hover follows the live camera under a resting pointer", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.setActiveTool("pen");
  });

  const center = await getArtboardCenter(page);

  await page.mouse.move(center.x, center.y);
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const dispatch = editor.dispatchCanvasPointerMove.bind(editor);
    const points: { x: number; y: number }[] = [];

    (
      window as typeof window & { __penHoverPoints?: typeof points }
    ).__penHoverPoints = points;
    editor.dispatchCanvasPointerMove = (info) => {
      points.push(info.point);
      return dispatch(info);
    };
    // A held pan: the store stays put, only the live camera moves.
    editor.setViewportInteracting(true);
    editor.moveViewportTo({ x: 40, y: 30, zoom: 1 });
  });

  const points = await page.evaluate(() => {
    return (window as typeof window & { __penHoverPoints?: unknown[] })
      .__penHoverPoints;
  });
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.setViewportInteracting(false);
  });

  // Recorded while the interaction was still held.
  expect(points?.length).toBeGreaterThan(0);
  // The resting client point now maps 40/30 world units further along.
  const host = await page.locator(".canvas-host").boundingBox();
  const last = points?.at(-1) as { x: number; y: number };

  expect(last.x).toBeCloseTo(40 + center.x - (host?.x ?? 0), 0);
  expect(last.y).toBeCloseTo(30 + center.y - (host?.y ?? 0), 0);
});

test("switching to Brush over a resting pointer shows the brush cursor", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });

  const center = await getArtboardCenter(page);

  await page.mouse.move(center.x, center.y);
  await page.mouse.move(center.x + 1, center.y + 1);
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.setActiveTool("brush");
  });

  const cursor = page.getByTestId("brush-cursor");

  await expect(cursor).toBeVisible();

  const box = await cursor.boundingBox();

  expect((box?.x ?? 0) + (box?.width ?? 0) / 2).toBeCloseTo(center.x + 1, 0);
  expect((box?.y ?? 0) + (box?.height ?? 0) / 2).toBeCloseTo(center.y + 1, 0);
});

const createSolidRasterDocument = (src: string) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-resting-pointer-raster",
        baseHeight: 200,
        baseWidth: 200,
        baseX: 0,
        baseY: 0,
        height: 200,
        id: "resting-raster",
        mimeType: "image/png",
        name: "Resting Pointer Raster",
        opacity: 1,
        parentId: "root",
        src,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 100, y: 100 },
        type: "image",
        visible: true,
        width: 200,
      },
    ],
    version: "1.8",
  });

test("switching to Brush over a selected Raster's overlay shows the brush cursor", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");

    canvas.width = 200;
    canvas.height = 200;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Expected Canvas2D");
    }

    context.fillStyle = "#3366cc";
    context.fillRect(0, 0, 200, 200);
    return canvas.toDataURL("image/png");
  });

  await loadDocument(page, createSolidRasterDocument(src));
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("resting-raster");
  });

  const overlay = page.locator(".canvas-single-selection");

  await expect(overlay).toBeVisible();
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("Expected the selection overlay");
  }

  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await page.mouse.move(point.x - 1, point.y - 1);
  await page.mouse.move(point.x, point.y);
  // The resting pointer starts over selection chrome, not the canvas.
  expect(
    await page.evaluate(
      ({ x, y }) =>
        Boolean(document.elementFromPoint(x, y)?.closest(".canvas-moveable")),
      point
    )
  ).toBe(true);

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.setActiveTool("brush");
  });

  await expect(page.getByTestId("brush-cursor")).toBeVisible();
});
