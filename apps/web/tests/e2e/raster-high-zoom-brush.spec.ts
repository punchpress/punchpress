import { expect, test } from "@playwright/test";
import { gotoEditor, loadDocument } from "./helpers/editor";

const TARGET_ID = "high-zoom-brush-raster";
const TARGET_SIZE = 720;
const ZOOM = 10.97;

test.use({
  deviceScaleFactor: 2,
  viewport: { height: 1045, width: 907 },
});

test("active high-zoom Brush pixels reach the exact presentation within two frames", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");

    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Expected Canvas2D");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 1, 1);
    return canvas.toDataURL("image/png");
  });

  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          assetId: "asset-high-zoom-brush-raster",
          height: TARGET_SIZE,
          id: TARGET_ID,
          mimeType: "image/png",
          name: "High Zoom Brush Raster",
          opacity: 1,
          parentId: "root",
          src,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 0,
            y: 0,
          },
          type: "image",
          visible: true,
          width: TARGET_SIZE,
        },
      ],
      version: "1.8",
    })
  );
  await page.evaluate(
    ({ targetId, targetSize, zoom }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const hostRect = editor?.hostRef?.getBoundingClientRect();

      if (!(editor?.viewerRef && hostRect)) {
        throw new Error("Expected editor viewport");
      }

      editor.select(targetId);
      editor.setBrushSettings(
        {
          color: "#000000",
          hardness: 1,
          opacity: 1,
          size: 24,
          spacing: 0,
        },
        "brush"
      );
      editor.setActiveTool("brush");
      const viewport = {
        x: targetSize / 2 - hostRect.width / (2 * zoom),
        y: targetSize / 2 - hostRect.height / (2 * zoom),
        zoom,
      };

      editor.viewerRef.setTo?.(viewport);
      editor.setViewport(viewport);
      editor.getState().setViewport(viewport);
      editor.onViewportChange?.();
    },
    { targetId: TARGET_ID, targetSize: TARGET_SIZE, zoom: ZOOM }
  );

  const exactCanvas = page.locator(
    `[data-node-id="${TARGET_ID}"] canvas[data-raster-exact-backing="true"]`
  );

  await expect(exactCanvas).toBeVisible();
  const points = await page.evaluate((targetId) => {
    const surface = document.querySelector<SVGGElement>(
      `[data-node-id="${targetId}"] [data-raster-canvas-host="true"]`
    );
    const matrix = surface?.getScreenCTM();

    if (!matrix) {
      throw new Error("Expected resident Raster screen transform");
    }

    const toScreen = (x: number, y: number) =>
      new DOMPoint(x, y).matrixTransform(matrix);

    return {
      end: toScreen(360, 375),
      start: toScreen(360, 345),
    };
  }, TARGET_ID);

  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      })
  );
  await page.mouse.move(points.end.x, points.end.y);
  const samples = await page.evaluate(async (targetId) => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    const source = document.querySelector<HTMLCanvasElement>(
      `[data-node-id="${targetId}"] canvas[data-raster-source-canvas="true"]`
    );
    const exact = document.querySelector<HTMLCanvasElement>(
      `[data-node-id="${targetId}"] canvas[data-raster-exact-backing="true"]`
    );
    const sourceContext = source?.getContext("2d");
    const exactContext = exact?.getContext("2d");

    if (!(source && exact && sourceContext && exactContext)) {
      throw new Error("Expected resident and exact Raster canvases");
    }

    const sourceX = Number(exact.getAttribute("data-raster-native-source-x"));
    const sourceY = Number(exact.getAttribute("data-raster-native-source-y"));
    const sourceWidth = Number(
      exact.getAttribute("data-raster-native-source-width")
    );
    const sourceHeight = Number(
      exact.getAttribute("data-raster-native-source-height")
    );
    const destinationX = Number(
      exact.getAttribute("data-raster-native-destination-x")
    );
    const destinationY = Number(
      exact.getAttribute("data-raster-native-destination-y")
    );
    const destinationWidth = Number(
      exact.getAttribute("data-raster-native-destination-width")
    );
    const destinationHeight = Number(
      exact.getAttribute("data-raster-native-destination-height")
    );
    const exactX = Math.floor(
      destinationX + ((360 - sourceX) / sourceWidth) * destinationWidth
    );
    const exactY = Math.floor(
      destinationY + ((375 - sourceY) / sourceHeight) * destinationHeight
    );

    return {
      exact: [...exactContext.getImageData(exactX, exactY, 1, 1).data],
      source: [...sourceContext.getImageData(360, 375, 1, 1).data],
    };
  }, TARGET_ID);

  await page.mouse.up();

  expect(samples.source).toEqual([0, 0, 0, 255]);
  expect(samples.exact).toEqual([0, 0, 0, 255]);
});
