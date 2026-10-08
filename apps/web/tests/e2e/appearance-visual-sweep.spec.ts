import { expect, type Page, test } from "@playwright/test";
import {
  centerOn,
  expectColor,
  MIN_RESOLVABLE_DEVICE_PX,
  readExportPixels,
  readPixel,
  toScreen,
  ZOOM_LADDER,
} from "./helpers/appearance-sweep";
import { gotoEditor, loadDocument } from "./helpers/editor";

// DPR-matched zoom-ladder sweep for appearance stacks. A rectangle paints a blue
// fill under a wide black stroke under a thin yellow stroke; samples across its
// left edge must show each layer in stack order at every zoom where the band is
// wide enough to resolve, at DPR 2 and 1, and again after serialize → reload.
// Export parity rasterizes the artboard SVG export the way PNG export does and
// samples the same world points.

// Full Chromium with GPU raster, like the raster sweep.
test.use({ channel: "chromium" });

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
    const exported = await readExportPixels(
      page,
      "sweep-artboard",
      SAMPLES.map((sample) => ({
        x: edge.x + sample.offset - ARTBOARD.x,
        y: edge.y - ARTBOARD.y,
      }))
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

// A 600 × 120 rectangle filled black → white left to right. Sampling at 10%,
// 50%, and 90% of its width must read about 10%, 50%, and 90% gray at every
// zoom where the box is wide enough, after reload, and in export.
const GRADIENT_ID = "sweep-gradient";
const GRADIENT_BOX = { height: 120, width: 600, x: 800, y: 200 };
const GRADIENT_SAMPLES = [0.1, 0.5, 0.9];
const GRADIENT_TOLERANCE = 24;

const GRADIENT_DOCUMENT = JSON.stringify({
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
            paint: {
              end: { x: 1, y: 0.5 },
              kind: "linear-gradient",
              start: { x: 0, y: 0.5 },
              stops: [
                { color: "#000000", id: "s1", offset: 0, opacity: 1 },
                { color: "#ffffff", id: "s2", offset: 1, opacity: 1 },
              ],
            },
          },
        ],
        strokes: [],
      },
      cornerRadius: 0,
      height: GRADIENT_BOX.height,
      id: GRADIENT_ID,
      opacity: 1,
      parentId: "sweep-artboard",
      shape: "polygon",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: GRADIENT_BOX.x,
        y: GRADIENT_BOX.y,
      },
      type: "shape",
      visible: true,
      width: GRADIENT_BOX.width,
    },
  ],
  version: "1.10",
});

const getGradientPoint = (fraction: number) => ({
  x: GRADIENT_BOX.x - GRADIENT_BOX.width / 2 + GRADIENT_BOX.width * fraction,
  y: GRADIENT_BOX.y,
});

const expectGray = (actual: number[], fraction: number, label: string) => {
  const expected = Math.round(255 * fraction);
  const delta = Math.max(
    ...actual.map((channel) => Math.abs(channel - expected))
  );

  expect
    .soft(delta, `${label}: got rgb(${actual.join(", ")}), want ~${expected}`)
    .toBeLessThanOrEqual(GRADIENT_TOLERANCE);
};

const sweepGradient = async (page: Page, dpr: number, phase: string) => {
  for (const zoom of ZOOM_LADDER) {
    if (GRADIENT_BOX.width * zoom * dpr < 40) {
      continue;
    }

    await centerOn(page, getGradientPoint(0.5), zoom);

    for (const fraction of GRADIENT_SAMPLES) {
      const screen = await toScreen(page, getGradientPoint(fraction));

      expectGray(
        await readPixel(page, screen),
        fraction,
        `${phase} DPR ${dpr} zoom ${zoom} at ${fraction}`
      );
    }
  }
};

for (const dpr of [2, 1]) {
  test.describe(`gradient sweep @ DPR ${dpr}`, () => {
    test.use({
      deviceScaleFactor: dpr,
      viewport: { height: 900, width: 1400 },
    });

    test("a linear gradient ramps across its paint box at every zoom and after reload", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await gotoEditor(page);
      await loadDocument(page, GRADIENT_DOCUMENT);
      await sweepGradient(page, dpr, "loaded");

      const saved = await page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.serializeDocument();
      });

      await loadDocument(page, saved);
      await sweepGradient(page, dpr, "reloaded");
    });
  });
}

test.describe("gradient export parity", () => {
  test.use({ deviceScaleFactor: 1, viewport: { height: 900, width: 1400 } });

  test("exported PNG ramps the same as the canvas", async ({ page }) => {
    await gotoEditor(page);
    await loadDocument(page, GRADIENT_DOCUMENT);

    const exported = await readExportPixels(
      page,
      "sweep-artboard",
      GRADIENT_SAMPLES.map(getGradientPoint)
    );

    await centerOn(page, getGradientPoint(0.5), 1);

    for (const [index, fraction] of GRADIENT_SAMPLES.entries()) {
      const canvasColor = await readPixel(
        page,
        await toScreen(page, getGradientPoint(fraction))
      );

      expectGray(exported[index], fraction, `export at ${fraction}`);
      expectColor(
        canvasColor,
        exported[index],
        `canvas vs export at ${fraction}`
      );
    }
  });
});
