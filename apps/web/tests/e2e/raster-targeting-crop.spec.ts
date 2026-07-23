import { expect, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocument,
  resetViewport,
  setViewport,
} from "./helpers/editor";

const transform = (x: number, y: number) => ({
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  x,
  y,
});

const getStagePoint = async (
  page,
  point: {
    x: number;
    y: number;
  }
) => {
  const box = await page.getByTestId("canvas-stage").boundingBox();

  if (!box) {
    throw new Error("Expected canvas stage");
  }

  return { x: box.x + point.x, y: box.y + point.y };
};

test("Workspace Brush is disabled and cannot create a Raster", async ({
  page,
}) => {
  await gotoEditor(page);
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 0.04 });
  await page.keyboard.press("b");

  const surfaceBox = await page.locator(".canvas-surface").boundingBox();

  if (!surfaceBox) {
    throw new Error("Expected canvas surface");
  }

  const start = {
    x: surfaceBox.x + surfaceBox.width * 0.25,
    y: surfaceBox.y + surfaceBox.height * 0.25,
  };
  const end = {
    x: surfaceBox.x + surfaceBox.width * 0.75,
    y: surfaceBox.y + surfaceBox.height * 0.75,
  };

  await page.mouse.move(start.x, start.y);
  await expect(page.locator(".canvas-host")).toHaveAttribute(
    "data-raster-cursor-disabled",
    "true"
  );
  await expect(page.getByTestId("brush-cursor")).toBeHidden();

  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 3 });
  await page.mouse.up();

  expect(
    await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.nodes.length)
  ).toBe(0);
});

test("Brush creates one content-bounded Raster only inside a Frame", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 300,
          id: "frame",
          locked: false,
          name: "Frame",
          parentId: "root",
          transform: transform(220, 160),
          type: "artboard",
          visible: true,
          width: 400,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.clearSelection());
  await page.keyboard.press("b");

  const start = await getStagePoint(page, { x: 300, y: 240 });
  const end = { x: start.x + 42, y: start.y + 8 };

  await page.mouse.move(start.x, start.y);
  await expect(page.getByTestId("brush-cursor")).toBeVisible();
  const revisionBefore = await page.evaluate(
    () => window.__PUNCHPRESS_EDITOR__?.history.currentRevision
  );

  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const raster = editor?.nodes.find((node) => node.type === "image");

        return raster?.type === "image"
          ? {
              height: raster.height,
              parentId: raster.parentId,
              selected: editor?.selectedNodeId === raster.id,
              width: raster.width,
            }
          : null;
      })
    )
    .toMatchObject({
      parentId: "frame",
      selected: true,
    });

  const result = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const raster = editor?.nodes.find((node) => node.type === "image");

    return {
      height: raster?.type === "image" ? raster.height : 0,
      revision: editor?.history.currentRevision,
      width: raster?.type === "image" ? raster.width : 0,
    };
  });

  expect(result.revision).toBe((revisionBefore || 0) + 1);
  expect(result.width).toBeLessThan(100);
  expect(result.height).toBeLessThan(80);
});

test("Crop changes bounds with stationary retained pixels and supports cancel", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = 100;
    canvas.height = 80;
    if (!context) {
      throw new Error("Expected Canvas2D context");
    }
    context.fillStyle = "#ff3366";
    context.fillRect(0, 0, 100, 80);
    return canvas.toDataURL("image/png");
  });

  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          assetId: "asset-raster",
          baseHeight: 80,
          baseWidth: 100,
          baseX: 0,
          baseY: 0,
          height: 80,
          id: "raster",
          mimeType: "image/png",
          name: "Raster",
          opacity: 1,
          parentId: "root",
          src,
          transform: transform(320, 240),
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
  await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.select("raster"));
  await expect(
    page.locator('[data-raster-resident-surface="canvas2d"]')
  ).toBeVisible();

  await page.getByRole("button", { name: "Crop Raster" }).click();
  await expect(page.getByTestId("raster-crop-overlay")).toBeVisible();

  const northwest = page.locator('[data-raster-crop-handle="nw"]');
  const northwestBox = await northwest.boundingBox();

  if (!northwestBox) {
    throw new Error("Expected Crop northwest handle");
  }

  await page.mouse.move(northwestBox.x + 2, northwestBox.y + 2);
  await page.mouse.down();
  await page.mouse.move(northwestBox.x + 22, northwestBox.y + 12);
  await page.mouse.up();
  await page.keyboard.press("Escape");

  await expect(page.getByTestId("raster-crop-overlay")).toBeHidden();
  expect(
    await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.getNode("raster"))
  ).toMatchObject({
    baseX: 0,
    baseY: 0,
    height: 80,
    transform: { x: 320, y: 240 },
    width: 100,
  });

  await page.getByRole("button", { name: "Crop Raster" }).click();
  await expect(page.getByTestId("raster-crop-overlay")).toBeVisible();
  const nextNorthwestBox = await northwest.boundingBox();

  if (!nextNorthwestBox) {
    throw new Error("Expected Crop northwest handle");
  }

  await page.mouse.move(nextNorthwestBox.x + 2, nextNorthwestBox.y + 2);
  await page.mouse.down();
  await page.mouse.move(nextNorthwestBox.x + 22, nextNorthwestBox.y + 12);
  await page.mouse.up();
  await page.getByTestId("raster-crop-done").click();

  await expect(page.getByTestId("raster-crop-overlay")).toBeHidden();
  await expect(
    page.locator('[data-raster-resident-surface="canvas2d"]')
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.getNode("raster"))
  ).toMatchObject({
    baseHeight: 80,
    baseWidth: 100,
    baseX: -20,
    baseY: -10,
    height: 70,
    transform: { x: 340, y: 250 },
    width: 80,
  });

  const sourceBeforeBrush = await page.evaluate(
    () => window.__PUNCHPRESS_EDITOR__?.getNode("raster")?.src
  );
  await page.keyboard.press("b");
  const paintPoint = await getStagePoint(page, { x: 380, y: 285 });
  await page.mouse.move(paintPoint.x, paintPoint.y);
  await page.mouse.down();
  await page.mouse.move(paintPoint.x + 12, paintPoint.y, { steps: 3 });
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate((previousSource) => {
        const raster = window.__PUNCHPRESS_EDITOR__?.getNode("raster");

        return raster?.type === "image"
          ? {
              baseHeight: raster.baseHeight,
              baseWidth: raster.baseWidth,
              baseX: raster.baseX,
              baseY: raster.baseY,
              height: raster.height,
              sourceChanged: raster.src !== previousSource,
              width: raster.width,
            }
          : null;
      }, sourceBeforeBrush)
    )
    .toEqual({
      baseHeight: 80,
      baseWidth: 100,
      baseX: -20,
      baseY: -10,
      height: 70,
      sourceChanged: true,
      width: 80,
    });
});
