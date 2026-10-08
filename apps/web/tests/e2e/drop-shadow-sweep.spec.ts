import { expect, type Page, test } from "@playwright/test";
import {
  SHADOW_ARTBOARD_ID,
  SHADOW_CLIPPED_POINT,
  SHADOW_DOCUMENT,
  SHADOW_SAMPLES,
} from "./drop-shadow-scene";
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

// DPR-matched zoom-ladder sweep for drop shadows: each sample must show the
// expected layer at every resolvable zoom, after serialize → reload, and in
// the artboard export rasterized at the same device scale. Group shadows stop
// at the artboard edge.

test.use({ channel: "chromium" });

const sweep = async (page: Page, dpr: number, phase: string) => {
  for (const zoom of ZOOM_LADDER) {
    for (const sample of SHADOW_SAMPLES) {
      if (sample.halfWidth * 2 * zoom * dpr < MIN_RESOLVABLE_DEVICE_PX) {
        continue;
      }

      await centerOn(page, sample.point, zoom);
      expectColor(
        await readPixel(page, await toScreen(page, sample.point)),
        sample.color,
        `${phase} DPR ${dpr} zoom ${zoom} ${sample.name}`
      );
    }
  }
};

const expectClippedAtArtboard = async (page: Page, phase: string) => {
  await centerOn(page, SHADOW_CLIPPED_POINT, 1);

  const [r, g, b] = await readPixel(
    page,
    await toScreen(page, SHADOW_CLIPPED_POINT)
  );

  expect
    .soft(Math.max(r, g, b), `${phase} group shadow past the artboard edge`)
    .toBeGreaterThan(20);
};

const expectExportParity = async (page: Page, dpr: number) => {
  const exported = await readExportPixels(
    page,
    SHADOW_ARTBOARD_ID,
    SHADOW_SAMPLES.map((sample) => sample.point),
    dpr
  );

  for (const [index, sample] of SHADOW_SAMPLES.entries()) {
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

for (const dpr of [2, 1]) {
  test.describe(`drop shadow sweep @ DPR ${dpr}`, () => {
    test.use({
      deviceScaleFactor: dpr,
      viewport: { height: 900, width: 1400 },
    });

    test("shadows paint, rotate, fade with groups, and clip to artboards at every zoom, after reload, and in export", async ({
      page,
    }) => {
      test.setTimeout(240_000);
      await gotoEditor(page);
      await loadDocument(page, SHADOW_DOCUMENT);
      await sweep(page, dpr, "loaded");
      await expectClippedAtArtboard(page, "loaded");
      await expectExportParity(page, dpr);

      const saved = await page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.serializeDocument();
      });

      await loadDocument(page, saved);
      await sweep(page, dpr, "reloaded");
      await expectClippedAtArtboard(page, "reloaded");
    });
  });
}
