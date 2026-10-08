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
