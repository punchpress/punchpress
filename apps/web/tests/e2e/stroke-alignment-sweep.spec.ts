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
import { decodePng } from "./helpers/png";
import {
  ALIGNMENT_ARTBOARD_ID,
  ALIGNMENT_DOCUMENT,
  ALIGNMENT_SAMPLES,
  TEXT_NODES,
} from "./stroke-alignment-scene";

// DPR-matched zoom-ladder sweep for inside and outside strokes: masked outside
// rings under a translucent fill, clipped inside rings, even-odd and nonzero
// holes, open-path fallback, miter vs round corners, gradient rings, a 50%
// group, and stroked text on a circle and an arch. Every sample is checked on
// the canvas at each resolvable zoom, after serialize → reload, and against
// the artboard export rasterized at the same device scale.

test.use({ channel: "chromium" });

const sweep = async (page: Page, dpr: number, phase: string) => {
  for (const zoom of ZOOM_LADDER) {
    const visible = ALIGNMENT_SAMPLES.filter((sample) => {
      return sample.halfWidth * 2 * zoom * dpr >= MIN_RESOLVABLE_DEVICE_PX;
    });

    for (const sample of visible) {
      await centerOn(page, sample.point, zoom);
      expectColor(
        await readPixel(page, await toScreen(page, sample.point)),
        sample.color,
        `${phase} DPR ${dpr} zoom ${zoom} ${sample.name}`
      );
    }
  }
};

const expectExportParity = async (page: Page, dpr: number) => {
  const exported = await readExportPixels(
    page,
    ALIGNMENT_ARTBOARD_ID,
    ALIGNMENT_SAMPLES.map((sample) => sample.point),
    dpr
  );

  for (const [index, sample] of ALIGNMENT_SAMPLES.entries()) {
    await centerOn(page, sample.point, 1);

    const canvas = await readPixel(page, await toScreen(page, sample.point));

    expectColor(
      exported[index],
      sample.color,
      `export DPR ${dpr} ${sample.name}`
    );
    expectColor(
      canvas,
      exported[index],
      `canvas vs export DPR ${dpr} ${sample.name}`
    );
  }
};

// Stroked text paints both its fill and its outside ring, with one mask per
// glyph (circle text) or one for the merged warped outline (arch).
const expectStrokedText = async (page: Page, phase: string) => {
  for (const text of TEXT_NODES) {
    await centerOn(page, text.center, 0.5);

    const node = page.locator(`.canvas-node[data-node-id="${text.id}"]`);

    await expect(node.locator("mask")).toHaveCount(text.masks);

    const box = await node.boundingBox();

    if (!box) {
      throw new Error(`Expected ${text.id} on screen`);
    }

    const image = decodePng(await page.screenshot({ clip: box }));
    let ring = 0;
    let fill = 0;

    for (let index = 0; index < image.data.length; index += 4) {
      const [r, g, b] = [
        image.data[index],
        image.data[index + 1],
        image.data[index + 2],
      ];

      if (r > 200 && g > 160 && b < 80) {
        ring += 1;
      } else if (r < 60 && g < 60 && b < 60) {
        fill += 1;
      }
    }

    expect.soft(ring, `${phase} ${text.id} ring pixels`).toBeGreaterThan(200);
    expect.soft(fill, `${phase} ${text.id} fill pixels`).toBeGreaterThan(200);
  }
};

for (const dpr of [2, 1]) {
  test.describe(`stroke alignment sweep @ DPR ${dpr}`, () => {
    test.use({
      deviceScaleFactor: dpr,
      viewport: { height: 900, width: 1400 },
    });

    test("aligned strokes paint on their side across the zoom ladder, after reload, and in export", async ({
      page,
    }) => {
      test.setTimeout(240_000);
      await gotoEditor(page);
      await loadDocument(page, ALIGNMENT_DOCUMENT);
      await sweep(page, dpr, "loaded");
      await expectStrokedText(page, "loaded");
      await expectExportParity(page, dpr);

      const saved = await page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.serializeDocument();
      });

      await loadDocument(page, saved);
      await sweep(page, dpr, "reloaded");
      await expectStrokedText(page, "reloaded");
    });
  });
}
