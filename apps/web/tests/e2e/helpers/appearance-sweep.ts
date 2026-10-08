import { expect, type Page } from "@playwright/test";
import { setViewport } from "./editor";
import { decodePng } from "./png";

// Shared probes for the appearance pixel sweeps: center the viewport on a
// world point, project world points to the screen, read rendered pixels, and
// rasterize an artboard export the way PNG export does.

export const ZOOM_LADDER = [1, 0.5, 0.35, 0.21, 0.1, 0.05, 0.01];
export const MIN_RESOLVABLE_DEVICE_PX = 4;
export const CHANNEL_TOLERANCE = 48;

interface Point {
  x: number;
  y: number;
}

export const centerOn = async (page: Page, point: Point, zoom: number) => {
  const host = await page.evaluate(() => {
    const rect = window.__PUNCHPRESS_EDITOR__?.hostRef?.getBoundingClientRect();

    return { height: rect?.height ?? 0, width: rect?.width ?? 0 };
  });

  await setViewport(page, {
    x: point.x - host.width / (2 * zoom),
    y: point.y - host.height / (2 * zoom),
    zoom,
  });
  await page.evaluate(async () => {
    for (let index = 0; index < 3; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
};

export const toScreen = (page: Page, world: Point) => {
  return page.evaluate((point) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const viewer = editor?.viewerRef;
    const host = editor?.hostRef?.getBoundingClientRect();

    if (!(editor && viewer && host)) {
      throw new Error("Expected viewport projection");
    }

    return {
      x: host.left + (point.x - viewer.getScrollLeft()) * editor.zoom,
      y: host.top + (point.y - viewer.getScrollTop()) * editor.zoom,
    };
  }, world);
};

export const readPixel = async (page: Page, screen: Point) => {
  const clip = { height: 3, width: 3, x: screen.x - 1, y: screen.y - 1 };

  // A first capture forces pending raster; the second is asserted.
  await page.screenshot({ clip });

  const image = decodePng(await page.screenshot({ clip }));
  const center =
    (Math.floor(image.height / 2) * image.width + Math.floor(image.width / 2)) *
    4;

  return [image.data[center], image.data[center + 1], image.data[center + 2]];
};

export const expectColor = (
  actual: number[],
  expected: readonly number[],
  label: string,
  tolerance = CHANNEL_TOLERANCE
) => {
  const delta = Math.max(
    ...actual.map((channel, index) => Math.abs(channel - expected[index]))
  );

  expect
    .soft(delta, `${label}: got rgb(${actual.join(", ")})`)
    .toBeLessThanOrEqual(tolerance);
};

// Rasterizes the artboard's SVG export through an <img> into a canvas at
// `scale` device pixels per unit, as PNG export does, and reads the colors at
// artboard-local points.
export const readExportPixels = (
  page: Page,
  artboardId: string,
  points: readonly Point[],
  scale = 1
) => {
  return page.evaluate(
    async ({ artboardId: id, points: samples, scale: factor }) => {
      const svg =
        await window.__PUNCHPRESS_EDITOR__?.exportSelectedArtboardSvg(id);

      if (!svg) {
        throw new Error("Expected artboard export");
      }

      const image = new Image();

      image.src = URL.createObjectURL(
        new Blob([svg], { type: "image/svg+xml" })
      );
      await image.decode();

      const canvas = document.createElement("canvas");

      canvas.width = image.width * factor;
      canvas.height = image.height * factor;

      const context = canvas.getContext("2d", { willReadFrequently: true });

      context?.drawImage(image, 0, 0, canvas.width, canvas.height);

      return samples.map((point) => {
        const data = context?.getImageData(
          Math.round(point.x * factor),
          Math.round(point.y * factor),
          1,
          1
        ).data;

        return data ? [data[0], data[1], data[2]] : [];
      });
    },
    { artboardId, points, scale }
  );
};
