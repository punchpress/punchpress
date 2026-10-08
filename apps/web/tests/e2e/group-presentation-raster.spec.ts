import { expect, type Page, test } from "@playwright/test";
import { expectColor, readPixel, toScreen } from "./helpers/appearance-sweep";
import { gotoEditor, loadDocument, setViewport } from "./helpers/editor";

// An exact-raster image inside a shadowed group that moves as one
// presentation root: raster pixels that enter the viewport during the drag
// are sampled from the live screen matrix (no holes, no doubled delta), the
// exact backing canvas survives the gesture, and commit lands in place.

const RASTER_ID = "moving-raster";
const RASTER_SIZE = 720;
const ZOOM = 28.24;

test.use({
  channel: "chromium",
  deviceScaleFactor: 2,
  viewport: { height: 1206, width: 1460 },
});

const frames = (page: Page, count = 3) => {
  return page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
};

// The checker color of image pixel (x, y).
const checker = (x: number, y: number) => [
  x % 251,
  y % 251,
  (x * 17 + y * 31) % 251,
];

const readImagePixel = async (
  page: Page,
  origin: { x: number; y: number },
  pixel: { x: number; y: number },
  delta = { x: 0, y: 0 }
) => {
  return readPixel(
    page,
    await toScreen(page, {
      x: origin.x + pixel.x + 0.5 + delta.x,
      y: origin.y + pixel.y + 0.5 + delta.y,
    })
  );
};

const drag = (page: Page, delta: { x: number; y: number }) => {
  return page.evaluate((step) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const holder = window as never as { dragSession: unknown };

    holder.dragSession ??= editor?.beginSelectionDrag({ nodeIds: ["rg"] });
    editor?.updateSelectionDrag(holder.dragSession, { delta: step });
  }, delta);
};

const release = async (page: Page) => {
  await page.evaluate(() => {
    const holder = window as never as { dragSession: unknown };

    window.__PUNCHPRESS_EDITOR__?.endSelectionDrag(holder.dragSession, {});
    holder.dragSession = undefined;
  });
  await frames(page);
};

test("exact raster follows a moving group root into and out of view", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await gotoEditor(page);
  await loadDocument(page, createDocument(await createCheckerSource(page)));
  await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.select("rg"));

  const origin = await page.evaluate((nodeId) => {
    const bounds =
      window.__PUNCHPRESS_EDITOR__?.getNodeRenderFrame(nodeId)?.bounds;

    return { x: bounds?.minX ?? 0, y: bounds?.minY ?? 0 };
  }, RASTER_ID);

  await setViewport(
    page,
    await page.evaluate(
      ({ center, zoom }) => {
        const host =
          window.__PUNCHPRESS_EDITOR__?.hostRef?.getBoundingClientRect();

        return {
          x: center.x - (host?.width ?? 0) / (2 * zoom),
          y: center.y - (host?.height ?? 0) / (2 * zoom),
          zoom,
        };
      },
      { center: { x: origin.x + 360, y: origin.y + 360 }, zoom: ZOOM }
    )
  );
  await frames(page);

  const exactRaster = page.locator(
    `[data-node-id="${RASTER_ID}"] canvas[data-raster-exact-backing="true"]`
  );

  await expect(exactRaster).toBeVisible();
  await exactRaster.evaluate((canvas) => {
    (canvas as never as { residentMark: boolean }).residentMark = true;
  });
  expectColor(
    await readImagePixel(page, origin, { x: 360, y: 360 }),
    checker(360, 360),
    "idle center",
    12
  );

  // Moving the group 40 right brings image pixel 320 (offscreen at rest) to
  // the viewport center.
  await drag(page, { x: 40, y: 0 });
  await frames(page);
  expectColor(
    await readImagePixel(page, origin, { x: 320, y: 360 }, { x: 40, y: 0 }),
    checker(320, 360),
    "entered during drag",
    12
  );
  expectColor(
    await readImagePixel(page, origin, { x: 300, y: 350 }, { x: 40, y: 0 }),
    checker(300, 350),
    "entered left edge during drag",
    12
  );

  // Further out: most of the image leaves the viewport to the right.
  await drag(page, { x: 160, y: 0 });
  await frames(page);
  expectColor(
    await readImagePixel(page, origin, { x: 160, y: 360 }, { x: 200, y: 0 }),
    checker(160, 360),
    "far drag",
    12
  );

  await release(page);
  expectColor(
    await readImagePixel(page, origin, { x: 160, y: 360 }, { x: 200, y: 0 }),
    checker(160, 360),
    "committed",
    12
  );
  expect(
    await exactRaster.evaluate((canvas) => {
      return (canvas as never as { residentMark?: boolean }).residentMark;
    })
  ).toBe(true);
});

const createCheckerSource = (page: Page) => {
  return page.evaluate((size) => {
    const canvas = document.createElement("canvas");

    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Expected Canvas2D");
    }

    const image = context.createImageData(size, size);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        image.data.set(
          [x % 251, y % 251, (x * 17 + y * 31) % 251, 255],
          (y * size + x) * 4
        );
      }
    }

    context.putImageData(image, 0, 0);

    return canvas.toDataURL("image/png");
  }, RASTER_SIZE);
};

const createDocument = (src: string) =>
  JSON.stringify({
    nodes: [
      {
        effects: [
          {
            blur: 0,
            color: "#000000",
            enabled: true,
            id: "shadow",
            kind: "drop-shadow",
            opacity: 1,
            x: 30,
            y: 30,
          },
        ],
        id: "rg",
        name: "Raster group",
        opacity: 1,
        parentId: "root",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "group",
        visible: true,
      },
      {
        assetId: "asset-moving-raster",
        baseHeight: RASTER_SIZE,
        baseWidth: RASTER_SIZE,
        baseX: 0,
        baseY: 0,
        height: RASTER_SIZE,
        id: RASTER_ID,
        mimeType: "image/png",
        name: "Moving Raster",
        opacity: 1,
        parentId: "rg",
        src,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "image",
        visible: true,
        width: RASTER_SIZE,
      },
    ],
    version: "1.12",
  });
