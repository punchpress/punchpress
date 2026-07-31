import { expect, test } from "@playwright/test";
import { gotoEditor, loadDocument, resetViewport } from "./helpers/editor";
import { decodePng } from "./helpers/png";

const RASTER_COLOR = { blue: 122, green: 0, red: 230 };
const SOLID_IMAGE_SOURCE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lhL1WQAAAABJRU5ErkJggg==";
interface RasterPixel {
  blue: number;
  green: number;
  red: number;
}

test.use({
  deviceScaleFactor: 2,
  viewport: { height: 1024, width: 924 },
});

const createFrameDocument = () =>
  JSON.stringify({
    nodes: [
      {
        background: "#ffffff",
        height: 5500,
        id: "frame",
        locked: false,
        name: "Frame",
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 500,
          y: 600,
        },
        type: "artboard",
        visible: true,
        width: 4500,
      },
    ],
    version: "1.8",
  });

test("Frame reveals Raster pixels that re-enter during one held drag", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, createFrameDocument());
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const viewport = { x: 0, y: 0, zoom: 0.16 };

    editor?.viewerRef?.setTo?.(viewport);
    editor?.setViewport(viewport);
    editor?.getState().setViewport(viewport);
    editor?.onViewportChange?.();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
  });

  const frame = page.locator("[data-artboard-body]").first();
  await expect(frame).toBeVisible();
  const frameBox = await frame.boundingBox();

  if (!frameBox) {
    throw new Error("Expected rendered Frame bounds");
  }

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("frame");
    editor?.setActiveTool("brush");
    editor?.setBrushSettings(
      {
        color: "#e6007a",
        hardness: 1,
        opacity: 1,
        size: 80,
        smoothing: 0,
        spacing: 0,
      },
      "brush"
    );
  });
  const strokePoints = [
    {
      x: frameBox.x + frameBox.width * 0.5,
      y: frameBox.y + frameBox.height * 0.05,
    },
    ...Array.from({ length: 10 }, (_, index) => {
      const y = frameBox.y + frameBox.height * (0.05 + index * 0.1);
      const left = { x: frameBox.x + frameBox.width * 0.05, y };
      const right = { x: frameBox.x + frameBox.width * 0.95, y };

      return index % 2 === 0 ? [left, right] : [right, left];
    }).flat(),
  ];
  const [strokeStart, ...remainingStrokePoints] = strokePoints;

  if (!strokeStart) {
    throw new Error("Expected Brush stroke points");
  }

  await page.mouse.move(strokeStart.x, strokeStart.y);
  await page.mouse.down();
  for (const point of remainingStrokePoints) {
    await page.mouse.move(point.x, point.y, { steps: 4 });
  }
  const rasterId = await page.evaluate(
    () =>
      window.__PUNCHPRESS_EDITOR__?.nodes.find(
        (node) => node.type === "image" && node.parentId === "frame"
      )?.id ?? null
  );

  if (!rasterId) {
    throw new Error("Expected Brush-created Raster");
  }

  await page.mouse.up();
  await page.evaluate((nodeId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.setActiveTool("pointer");
    editor?.select(nodeId);
    return new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
  }, rasterId);
  await expect
    .poll(() =>
      page.evaluate(
        (nodeId) =>
          window.__PUNCHPRESS_EDITOR__?.getRasterWorkingPresentation(nodeId)
            ?.groups.length ?? 0,
        rasterId
      )
    )
    .toBe(0);

  const moveable = page.locator(".canvas-single-selection");
  await expect(moveable).toBeVisible();
  const moveableBox = await moveable.boundingBox();

  if (!moveableBox) {
    throw new Error("Expected rendered Raster selection bounds");
  }

  const start = {
    x: moveableBox.x + moveableBox.width / 2,
    y: moveableBox.y + moveableBox.height / 2,
  };
  const reentrySample = {
    x: frameBox.x + frameBox.width * 0.35,
    y: frameBox.y + frameBox.height * 0.75,
  };
  const originalTransform = await getRasterTransform(page, rasterId);
  const initialRenderState = await getRasterRenderState(page, rasterId);
  const outsideDeltaX = frameBox.x - 30 - reentrySample.x;

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();

  try {
    await page.mouse.move(start.x + outsideDeltaX, start.y, { steps: 8 });
    await waitForPaint(page);

    const outsidePixel = await samplePixel(page, {
      x: reentrySample.x + outsideDeltaX,
      y: reentrySample.y,
    });
    const outsideRenderState = await getRasterRenderState(page, rasterId);

    expect(isRasterColor(outsidePixel)).toBe(false);
    expect(outsideRenderState.shell?.left).toBeCloseTo(
      initialRenderState.shell?.left ?? Number.NaN,
      1
    );
    expect(outsideRenderState.node?.left).toBeLessThan(
      (initialRenderState.node?.left ?? Number.NEGATIVE_INFINITY) - 200
    );

    const reentryDeltaX = 30;

    await page.mouse.move(start.x + reentryDeltaX, start.y, { steps: 8 });
    await waitForPaint(page);

    expect(await getRasterTransform(page, rasterId)).toEqual(originalTransform);
    const reentryRenderState = await getRasterRenderState(page, rasterId);

    expect(reentryRenderState.shell?.left).toBeCloseTo(
      initialRenderState.shell?.left ?? Number.NaN,
      1
    );
    expect(reentryRenderState.node?.left).toBeCloseTo(
      (initialRenderState.node?.left ?? Number.NaN) + reentryDeltaX,
      1
    );

    const reenteredPixels: RasterPixel[] = [];

    for (const xRatio of [0.15, 0.35, 0.55]) {
      reenteredPixels.push(
        await samplePixel(page, {
          x: frameBox.x + frameBox.width * xRatio + reentryDeltaX,
          y: reentrySample.y,
        })
      );
    }

    expect(reenteredPixels.every(isRasterColor)).toBe(true);
  } finally {
    await page.mouse.up();
  }
});

test("Frame drag moves its child Raster clip shell with it", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 260,
          id: "frame",
          locked: false,
          name: "Frame",
          parentId: "root",
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 220,
            y: 160,
          },
          type: "artboard",
          visible: true,
          width: 340,
        },
        {
          height: 180,
          id: "raster",
          name: "Raster",
          parentId: "frame",
          src: SOLID_IMAGE_SOURCE,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 260,
            y: 200,
          },
          type: "image",
          visible: true,
          width: 200,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);

  const frameBody = page.locator('[data-artboard-body="frame"]');
  const frameLabel = page.locator('button.canvas-node[data-node-id="frame"]');
  await expect(frameBody).toBeVisible();
  await expect(frameLabel).toBeVisible();
  await frameLabel.click();

  const initialFrameBox = await frameBody.boundingBox();
  const initialRasterState = await getRasterRenderState(page, "raster");
  const labelBox = await frameLabel.boundingBox();

  if (!(initialFrameBox && initialRasterState.shell && labelBox)) {
    throw new Error("Expected Frame and child Raster render bounds");
  }

  await page.mouse.move(labelBox.x + labelBox.width / 2, labelBox.y + 12);
  await page.mouse.down();

  try {
    await page.mouse.move(
      labelBox.x + labelBox.width / 2 + 48,
      labelBox.y + 56,
      { steps: 8 }
    );
    await waitForPaint(page);

    const previewFrameBox = await frameBody.boundingBox();
    const previewRasterState = await getRasterRenderState(page, "raster");

    expect(previewFrameBox?.x).toBeCloseTo(initialFrameBox.x + 48, 1);
    expect(previewRasterState.shell?.left).toBeCloseTo(
      initialRasterState.shell.left + 48,
      1
    );
  } finally {
    await page.mouse.up();
  }
});

const getRasterTransform = (page, rasterId: string) =>
  page.evaluate((nodeId) => {
    const node = window.__PUNCHPRESS_EDITOR__?.getNode(nodeId);

    return node?.type === "image" ? node.transform : null;
  }, rasterId);

const getRasterRenderState = (page, rasterId: string) =>
  page.evaluate((nodeId) => {
    const node = document.querySelector(
      `.canvas-node[data-node-id="${nodeId}"]`
    );
    const shell = node?.closest("[data-node-shell='true']");
    const getRect = (element: Element | null | undefined) => {
      const rect = element?.getBoundingClientRect();

      return rect
        ? {
            height: rect.height,
            left: rect.left,
            top: rect.top,
            width: rect.width,
          }
        : null;
    };

    return {
      node: getRect(node),
      shell: getRect(shell),
    };
  }, rasterId);

const waitForPaint = (page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );

const samplePixel = async (page, point: { x: number; y: number }) => {
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

const isRasterColor = (pixel: RasterPixel) => {
  return (
    Math.abs(pixel.red - RASTER_COLOR.red) <= 2 &&
    Math.abs(pixel.green - RASTER_COLOR.green) <= 2 &&
    Math.abs(pixel.blue - RASTER_COLOR.blue) <= 2
  );
};
