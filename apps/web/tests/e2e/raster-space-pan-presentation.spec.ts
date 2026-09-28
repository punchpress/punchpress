import { expect, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocument,
  serializeDocument,
  setViewport,
} from "./helpers/editor";
import { decodePng } from "./helpers/png";

const RASTER_ID = "space-pan-presentation-raster";
const RASTER_SIZE = 720;
const ZOOM = 28.24;

test.use({
  deviceScaleFactor: 2,
  viewport: { height: 1206, width: 1460 },
});

test("keeps imported Raster pixels coherent when a Space-pan compositor frame is stale", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await gotoEditor(page);
  const src = await createCheckerSource(page);

  await loadDocument(page, createRasterDocument(src));
  await page.evaluate((nodeId) => {
    window.__PUNCHPRESS_EDITOR__?.select(nodeId);
  }, RASTER_ID);
  await setViewport(
    page,
    await page.evaluate(
      ({ size, zoom }) => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const host = editor?.hostRef?.getBoundingClientRect();

        if (!(editor && host)) {
          throw new Error("Expected editor viewport");
        }

        return {
          x: size / 2 - host.width / (2 * zoom),
          y: size / 2 - host.height / (2 * zoom),
          zoom,
        };
      },
      { size: RASTER_SIZE, zoom: ZOOM }
    )
  );

  const host = page.locator(".canvas-host");
  const exactRaster = page.locator(
    `[data-node-id="${RASTER_ID}"] canvas[data-raster-exact-backing="true"]`
  );
  const samplingSurface = page.locator(
    `[data-node-id="${RASTER_ID}"] [data-raster-sampling]`
  );
  const pixelGrid = page.locator('[data-pixel-grid-kind="raster"]');

  await expect(exactRaster).toBeVisible();
  await expect(pixelGrid).toBeVisible();
  await expect(samplingSurface).toHaveAttribute(
    "data-raster-sampling",
    "exact"
  );
  const textureProbeInstalled = await installDelayedRasterUploadProbe(page);
  const hostBox = await host.boundingBox();
  const viewport = page.viewportSize();

  if (!(hostBox && viewport)) {
    throw new Error("Expected canvas host");
  }

  const beforeDocument = await serializeDocument(page);
  const start = {
    x: hostBox.x + hostBox.width / 2,
    y: hostBox.y + hostBox.height / 2,
  };
  const client = await page.context().newCDPSession(page);
  const frames: Buffer[] = [];
  let splitPublicationObserved = false;

  client.on("Page.screencastFrame", (event) => {
    frames.push(Buffer.from(event.data, "base64"));
    client
      .send("Page.screencastFrameAck", { sessionId: event.sessionId })
      .catch(() => undefined);
  });
  await client.send("Page.startScreencast", {
    everyNthFrame: 1,
    format: "png",
  });

  await page.keyboard.down("Space");
  await expect(host).toHaveAttribute("data-panning", "true");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();

  try {
    for (let frame = 0; frame < 120; frame += 1) {
      const phase = frame / 8;

      if (frame > 0 && frame % 30 === 0) {
        await page.keyboard.down("Space");
      }
      if (frame === 60 && textureProbeInstalled) {
        await page.evaluate(() => {
          (
            window as typeof window & {
              __PUNCHPRESS_DELAY_RASTER_UPLOADS__?: number;
            }
          ).__PUNCHPRESS_DELAY_RASTER_UPLOADS__ = 8;
        });
      }

      await page.mouse.move(
        start.x + Math.sin(phase) * 300,
        start.y + Math.sin(frame / 10) * 250
      );
      await page.waitForTimeout(frame === 60 ? 100 : 8);
    }
  } finally {
    await page.mouse.up();
    await page.keyboard.up("Space");
    await client.send("Page.stopScreencast");
    await client.detach();
    splitPublicationObserved = await page.evaluate(() => {
      return Boolean(
        (
          window as typeof window & {
            __PUNCHPRESS_SPLIT_RASTER_PUBLICATION__?: boolean;
          }
        ).__PUNCHPRESS_SPLIT_RASTER_PUBLICATION__
      );
    });
    await removeDelayedRasterUploadProbe(page);
  }

  expect(textureProbeInstalled).toBe(true);
  expect(frames.length).toBeGreaterThan(30);
  const frameChanges = frames.slice(1).map((frame, index) => ({
    changedRatio: getChangedPixelRatio({
      current: decodePng(frame),
      hostBox,
      previous: decodePng(frames[index]),
      viewport,
    }),
    frame: index + 1,
  }));
  const abruptChanges = frameChanges.filter(
    ({ changedRatio }) => changedRatio > 0.5
  );
  const sourceCoordinates = frames.map((frame, index) => ({
    coordinate: getDominantSourceCoordinate(
      decodePng(frame),
      hostBox,
      viewport
    ),
    frame: index,
  }));
  const sourceJumps = sourceCoordinates.slice(1).flatMap((current, index) => {
    const previous = sourceCoordinates[index];

    if (!(current.coordinate && previous.coordinate)) {
      return [];
    }

    const delta = {
      x: current.coordinate.x - previous.coordinate.x,
      y: current.coordinate.y - previous.coordinate.y,
    };

    return Math.abs(delta.x) <= 4 && Math.abs(delta.y) <= 4
      ? []
      : [{ current, delta, previous }];
  });

  expect(abruptChanges, JSON.stringify(frameChanges, null, 2)).toEqual([]);
  expect(sourceJumps, JSON.stringify(sourceCoordinates, null, 2)).toEqual([]);
  expect(splitPublicationObserved).toBe(false);
  await expect(pixelGrid).toBeVisible();
  await expect(samplingSurface).toHaveAttribute(
    "data-raster-sampling",
    "exact"
  );
  expect(await serializeDocument(page)).toBe(beforeDocument);
});

const createCheckerSource = (page) => {
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
        const index = (y * size + x) * 4;
        const expected = [x % 251, y % 251, (x * 17 + y * 31) % 251, 255];

        image.data.set(expected, index);
      }
    }

    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }, RASTER_SIZE);
};

const installDelayedRasterUploadProbe = (page) => {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-node-id="space-pan-presentation-raster"] canvas[data-raster-exact-backing="true"]'
    );
    const context = canvas?.getContext("2d");

    if (!context) {
      return false;
    }

    const original = context.drawImage.bind(context);
    const originalClear = context.clearRect.bind(context);
    (
      context as typeof context & {
        __PUNCHPRESS_ORIGINAL_DRAW_IMAGE__?: typeof context.drawImage;
      }
    ).__PUNCHPRESS_ORIGINAL_DRAW_IMAGE__ = context.drawImage;
    (
      context as typeof context & {
        __PUNCHPRESS_ORIGINAL_CLEAR_RECT__?: typeof context.clearRect;
      }
    ).__PUNCHPRESS_ORIGINAL_CLEAR_RECT__ = context.clearRect;
    Object.defineProperty(context, "clearRect", {
      configurable: true,
      value: (...args: Parameters<typeof context.clearRect>) => {
        const testWindow = window as typeof window & {
          __PUNCHPRESS_DELAY_RASTER_UPLOADS__?: number;
          __PUNCHPRESS_RASTER_CLEAR_PENDING__?: boolean;
          __PUNCHPRESS_SPLIT_RASTER_PUBLICATION__?: boolean;
        };

        if ((testWindow.__PUNCHPRESS_DELAY_RASTER_UPLOADS__ ?? 0) > 0) {
          testWindow.__PUNCHPRESS_RASTER_CLEAR_PENDING__ = true;
          testWindow.__PUNCHPRESS_SPLIT_RASTER_PUBLICATION__ = true;
        }

        Reflect.apply(originalClear, context, args);
      },
    });
    Object.defineProperty(context, "drawImage", {
      configurable: true,
      value: (...args: unknown[]) => {
        const testWindow = window as typeof window & {
          __PUNCHPRESS_DELAY_RASTER_UPLOADS__?: number;
          __PUNCHPRESS_RASTER_CLEAR_PENDING__?: boolean;
        };

        if (
          testWindow.__PUNCHPRESS_RASTER_CLEAR_PENDING__ &&
          (testWindow.__PUNCHPRESS_DELAY_RASTER_UPLOADS__ ?? 0) > 0
        ) {
          testWindow.__PUNCHPRESS_DELAY_RASTER_UPLOADS__ =
            (testWindow.__PUNCHPRESS_DELAY_RASTER_UPLOADS__ ?? 0) - 1;
          testWindow.__PUNCHPRESS_RASTER_CLEAR_PENDING__ = false;
          return;
        }

        testWindow.__PUNCHPRESS_RASTER_CLEAR_PENDING__ = false;
        Reflect.apply(original, context, args);
      },
    });

    return true;
  });
};

const removeDelayedRasterUploadProbe = (page) => {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-node-id="space-pan-presentation-raster"] canvas[data-raster-exact-backing="true"]'
    );
    const context = canvas?.getContext("2d") as
      | (CanvasRenderingContext2D & {
          __PUNCHPRESS_ORIGINAL_CLEAR_RECT__?: CanvasRenderingContext2D["clearRect"];
          __PUNCHPRESS_ORIGINAL_DRAW_IMAGE__?: CanvasRenderingContext2D["drawImage"];
        })
      | null;

    if (context?.__PUNCHPRESS_ORIGINAL_DRAW_IMAGE__) {
      if (context.__PUNCHPRESS_ORIGINAL_CLEAR_RECT__) {
        Object.defineProperty(context, "clearRect", {
          configurable: true,
          value: context.__PUNCHPRESS_ORIGINAL_CLEAR_RECT__,
        });
        context.__PUNCHPRESS_ORIGINAL_CLEAR_RECT__ = undefined;
      }
      Object.defineProperty(context, "drawImage", {
        configurable: true,
        value: context.__PUNCHPRESS_ORIGINAL_DRAW_IMAGE__,
      });
      context.__PUNCHPRESS_ORIGINAL_DRAW_IMAGE__ = undefined;
    }
    (
      window as typeof window & {
        __PUNCHPRESS_DELAY_RASTER_UPLOADS__?: number;
        __PUNCHPRESS_RASTER_CLEAR_PENDING__?: boolean;
        __PUNCHPRESS_SPLIT_RASTER_PUBLICATION__?: boolean;
      }
    ).__PUNCHPRESS_DELAY_RASTER_UPLOADS__ = undefined;
    (
      window as typeof window & {
        __PUNCHPRESS_RASTER_CLEAR_PENDING__?: boolean;
      }
    ).__PUNCHPRESS_RASTER_CLEAR_PENDING__ = undefined;
    (
      window as typeof window & {
        __PUNCHPRESS_SPLIT_RASTER_PUBLICATION__?: boolean;
      }
    ).__PUNCHPRESS_SPLIT_RASTER_PUBLICATION__ = undefined;
  });
};

const createRasterDocument = (src: string) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-space-pan-presentation",
        baseHeight: RASTER_SIZE,
        baseWidth: RASTER_SIZE,
        baseX: 0,
        baseY: 0,
        height: RASTER_SIZE,
        id: RASTER_ID,
        mimeType: "image/png",
        name: "Space Pan Presentation Raster",
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
        width: RASTER_SIZE,
      },
    ],
    version: "1.8",
  });

const getChangedPixelRatio = ({ current, hostBox, previous, viewport }) => {
  const scaleX = current.width / viewport.width;
  const scaleY = current.height / viewport.height;
  const minX = Math.max(
    0,
    Math.floor((hostBox.x + hostBox.width * 0.1) * scaleX)
  );
  const maxX = Math.min(
    current.width,
    Math.ceil((hostBox.x + hostBox.width * 0.9) * scaleX)
  );
  const minY = Math.max(
    0,
    Math.floor((hostBox.y + hostBox.height * 0.1) * scaleY)
  );
  const maxY = Math.min(
    current.height,
    Math.ceil((hostBox.y + hostBox.height * 0.9) * scaleY)
  );
  let changed = 0;
  let sampled = 0;

  for (let y = minY; y < maxY; y += 4) {
    for (let x = minX; x < maxX; x += 4) {
      const index = (y * current.width + x) * 4;
      const delta =
        Math.abs(current.data[index] - previous.data[index]) +
        Math.abs(current.data[index + 1] - previous.data[index + 1]) +
        Math.abs(current.data[index + 2] - previous.data[index + 2]);

      changed += delta > 96 ? 1 : 0;
      sampled += 1;
    }
  }

  return changed / sampled;
};

const getDominantSourceCoordinate = (screenshot, hostBox, viewport) => {
  const scaleX = screenshot.width / viewport.width;
  const scaleY = screenshot.height / viewport.height;
  const centerX = Math.round((hostBox.x + hostBox.width / 2) * scaleX);
  const centerY = Math.round((hostBox.y + hostBox.height / 2) * scaleY);
  const candidates = new Map<string, number>();

  for (let y = centerY - 8; y <= centerY + 8; y += 1) {
    for (let x = centerX - 8; x <= centerX + 8; x += 1) {
      const index = (y * screenshot.width + x) * 4;
      const red = screenshot.data[index];
      const green = screenshot.data[index + 1];
      const blue = screenshot.data[index + 2];

      if ((red * 17 + green * 31) % 251 !== blue) {
        continue;
      }

      const key = `${red}:${green}`;

      candidates.set(key, (candidates.get(key) ?? 0) + 1);
    }
  }

  const dominant = [...candidates.entries()].sort(
    ([, leftCount], [, rightCount]) => rightCount - leftCount
  )[0];

  if (!dominant) {
    return null;
  }

  const [x, y] = dominant[0].split(":").map(Number);

  return { x, y };
};
