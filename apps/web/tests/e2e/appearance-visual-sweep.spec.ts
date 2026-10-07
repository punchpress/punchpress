import { expect, type Page, test } from "@playwright/test";
import { gotoEditor, loadDocument, setViewport } from "./helpers/editor";
import { decodePng } from "./helpers/png";

// DPR-matched zoom-ladder sweep for appearance stacks. A rectangle paints a blue
// fill under a wide black stroke under a thin yellow stroke; samples across its
// left edge must show each layer in stack order at every zoom where the band is
// wide enough to resolve, at DPR 2 and 1, and again after serialize → reload.
// Export parity rasterizes the artboard SVG export the way PNG export does and
// samples the same world points.

// Full Chromium with GPU raster, like the raster sweep.
test.use({ channel: "chromium" });

const ZOOM_LADDER = [1, 0.5, 0.35, 0.21, 0.1, 0.05, 0.01];
const NODE_ID = "sweep-shape";
const ARTBOARD = { height: 1200, width: 1600, x: 0, y: 0 };
const WIDE = 60;
const THIN = 20;
const COLORS = {
  background: [255, 255, 255],
  fill: [31, 111, 235],
  thin: [255, 204, 0],
  wide: [0, 0, 0],
};
const MIN_RESOLVABLE_DEVICE_PX = 4;
const CHANNEL_TOLERANCE = 48;

const stroke = (id: string, color: string, width: number) => ({
  align: "center",
  cap: "round",
  enabled: true,
  id,
  join: "miter",
  miterLimit: 4,
  opacity: 1,
  paint: { color, kind: "solid" },
  width,
});

const SWEEP_DOCUMENT = JSON.stringify({
  assets: {},
  nodes: [
    {
      background: "#ffffff",
      height: ARTBOARD.height,
      id: "sweep-artboard",
      locked: false,
      name: "Sweep",
      opacity: 1,
      parentId: "root",
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      type: "artboard",
      visible: true,
      width: ARTBOARD.width,
    },
    {
      appearance: {
        fills: [
          {
            enabled: true,
            id: "fill-1",
            opacity: 1,
            paint: { color: "#1f6feb", kind: "solid" },
          },
        ],
        strokes: [
          stroke("stroke-1", "#000000", WIDE),
          stroke("stroke-2", "#ffcc00", THIN),
        ],
      },
      cornerRadius: 0,
      height: 500,
      id: NODE_ID,
      opacity: 1,
      parentId: "sweep-artboard",
      shape: "polygon",
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 800, y: 600 },
      type: "shape",
      visible: true,
      width: 700,
    },
  ],
  version: "1.9",
});

// World x offsets from the geometry's left edge, each with the layer that
// must win there and the half-width of the band that layer owns.
const SAMPLES = [
  { color: COLORS.background, halfWidth: 30, name: "outside", offset: -90 },
  {
    color: COLORS.wide,
    halfWidth: (WIDE - THIN) / 4,
    name: "wide outer",
    offset: -20,
  },
  { color: COLORS.thin, halfWidth: THIN / 2, name: "thin", offset: 0 },
  {
    color: COLORS.wide,
    halfWidth: (WIDE - THIN) / 4,
    name: "wide inner",
    offset: 20,
  },
  { color: COLORS.fill, halfWidth: 60, name: "fill", offset: 120 },
] as const;

const getEdgeWorld = (page: Page) => {
  return page.evaluate((nodeId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const bounds = editor?.getNodeRenderFrame(nodeId)?.bounds;

    if (!bounds) {
      throw new Error("Expected sweep node frame");
    }

    // The render frame includes half the widest stroke.
    return {
      x: bounds.minX + 30,
      y: (bounds.minY + bounds.maxY) / 2,
    };
  }, NODE_ID);
};

const centerOn = async (page: Page, point, zoom: number) => {
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

const toScreen = (page: Page, world: { x: number; y: number }) => {
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

const readPixel = async (page: Page, screen: { x: number; y: number }) => {
  const clip = { height: 3, width: 3, x: screen.x - 1, y: screen.y - 1 };

  // A first capture forces pending raster; the second is asserted.
  await page.screenshot({ clip });

  const image = decodePng(await page.screenshot({ clip }));
  const center =
    (Math.floor(image.height / 2) * image.width + Math.floor(image.width / 2)) *
    4;

  return [image.data[center], image.data[center + 1], image.data[center + 2]];
};

const expectColor = (actual: number[], expected: readonly number[], label) => {
  const delta = Math.max(
    ...actual.map((channel, index) => Math.abs(channel - expected[index]))
  );

  expect
    .soft(delta, `${label}: got rgb(${actual.join(", ")})`)
    .toBeLessThanOrEqual(CHANNEL_TOLERANCE);
};

const sweepLadder = async (page: Page, dpr: number, phase: string) => {
  const edge = await getEdgeWorld(page);

  for (const zoom of ZOOM_LADDER) {
    await centerOn(page, edge, zoom);

    for (const sample of SAMPLES) {
      // Only assert bands that resolve to a few device pixels at this zoom.
      if (sample.halfWidth * 2 * zoom * dpr < MIN_RESOLVABLE_DEVICE_PX) {
        continue;
      }

      const screen = await toScreen(page, {
        x: edge.x + sample.offset,
        y: edge.y,
      });

      expectColor(
        await readPixel(page, screen),
        sample.color,
        `${phase} DPR ${dpr} zoom ${zoom} ${sample.name}`
      );
    }
  }
};

for (const dpr of [2, 1]) {
  test.describe(`appearance sweep @ DPR ${dpr}`, () => {
    test.use({
      deviceScaleFactor: dpr,
      viewport: { height: 900, width: 1400 },
    });

    test("stacked layers paint in order across the zoom ladder and after reload", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await gotoEditor(page);
      await loadDocument(page, SWEEP_DOCUMENT);
      await sweepLadder(page, dpr, "loaded");

      const saved = await page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.serializeDocument();
      });

      await loadDocument(page, saved);
      await sweepLadder(page, dpr, "reloaded");
    });
  });
}

test.describe("appearance export parity", () => {
  test.use({ deviceScaleFactor: 1, viewport: { height: 900, width: 1400 } });

  test("artboard PNG rasterization paints the same layers as the canvas", async ({
    page,
  }) => {
    await gotoEditor(page);
    await loadDocument(page, SWEEP_DOCUMENT);

    const edge = await getEdgeWorld(page);
    const exported = await page.evaluate(
      async ({ points }) => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const svg = await editor?.exportSelectedArtboardSvg("sweep-artboard");

        if (!svg) {
          throw new Error("Expected artboard export");
        }

        const image = new Image();

        image.src = URL.createObjectURL(
          new Blob([svg], { type: "image/svg+xml" })
        );
        await image.decode();

        const canvas = document.createElement("canvas");

        canvas.width = image.width;
        canvas.height = image.height;

        const context = canvas.getContext("2d", { willReadFrequently: true });

        context?.drawImage(image, 0, 0);

        return points.map((point) => {
          const data = context?.getImageData(
            Math.round(point.x),
            Math.round(point.y),
            1,
            1
          ).data;

          return data ? [data[0], data[1], data[2]] : [];
        });
      },
      {
        points: SAMPLES.map((sample) => ({
          x: edge.x + sample.offset - ARTBOARD.x,
          y: edge.y - ARTBOARD.y,
        })),
      }
    );

    await centerOn(page, edge, 1);

    for (const [index, sample] of SAMPLES.entries()) {
      const canvasColor = await readPixel(
        page,
        await toScreen(page, { x: edge.x + sample.offset, y: edge.y })
      );

      expectColor(exported[index], sample.color, `export ${sample.name}`);
      expectColor(
        canvasColor,
        exported[index],
        `canvas vs export ${sample.name}`
      );
    }
  });
});
