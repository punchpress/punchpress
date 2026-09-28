import { expect, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocument,
  resetViewport,
  setViewport,
} from "./helpers/editor";

const CONTROL_NAMES = [
  "Brush size",
  "Brush opacity",
  "Brush flow",
  "Brush hardness",
  "Brush spacing",
  "Brush angle",
  "Brush roundness",
  "Brush smoothing",
  "Brush scatter",
  "Brush size jitter",
  "Brush angle jitter",
];

test("edits temporary built-in settings independently for Brush and Eraser", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.keyboard.press("b");

  const preset = page.getByRole("combobox", { name: "Brush preset" });

  await expect(preset).toHaveText("Hard Round");
  for (const name of CONTROL_NAMES) {
    await expect(
      page.getByRole("slider", { exact: true, name })
    ).toBeAttached();
  }

  await preset.click();
  await page.getByRole("option", { name: "Chalk" }).click();
  await setSliderValue(page, "Brush size", 77);
  await setSliderValue(page, "Brush flow", 20);

  await page.keyboard.press("e");
  await expect(preset).toHaveText("Hard Round");
  await preset.click();
  await page.getByRole("option", { name: "Pixel" }).click();
  await setSliderValue(page, "Brush size", 12);

  await page.keyboard.press("b");
  await expect(preset).toHaveText("Chalk");

  expect(
    await page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;

      return {
        brush: {
          presetId: editor?.getBrushToolPresetId("brush"),
          settings: editor?.getBrushToolSettings("brush"),
        },
        eraser: {
          presetId: editor?.getBrushToolPresetId("eraser"),
          settings: editor?.getBrushToolSettings("eraser"),
        },
      };
    })
  ).toMatchObject({
    brush: {
      presetId: "chalk",
      settings: {
        flow: 0.2,
        size: 77,
        tip: { kind: "sampled", sampleId: "chalk" },
      },
    },
    eraser: {
      presetId: "pixel",
      settings: {
        size: 12,
        tip: { kind: "sampled", sampleId: "pixel" },
      },
    },
  });
});

test("renders preset Dabs through the non-resident raster fallback", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");

    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/png");
  });

  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          assetId: "asset-large-raster",
          baseHeight: 1600,
          baseWidth: 2200,
          baseX: 0,
          baseY: 0,
          height: 1600,
          id: "large-raster",
          mimeType: "image/png",
          name: "Large Raster",
          opacity: 1,
          parentId: "root",
          src,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 220,
            y: 160,
          },
          type: "image",
          visible: true,
          width: 2200,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("large-raster");
  });
  await page.keyboard.press("b");

  const preset = page.getByRole("combobox", { name: "Brush preset" });

  await preset.click();
  await page.getByRole("option", { name: "Pixel" }).click();

  const stage = await page.getByTestId("canvas-stage").boundingBox();

  if (!stage) {
    throw new Error("Missing canvas stage");
  }

  await page.mouse.move(stage.x + 360, stage.y + 260);
  await page.mouse.down();

  await expect(page.getByTestId("raster-resident-canvas")).toBeVisible();
  expect(
    await page.evaluate(() => ({
      settings: window.__PUNCHPRESS_EDITOR__?.getBrushToolSettings("brush"),
      surface: window.__PUNCHPRESS_EDITOR__?.rasterSurface?.getPresentation?.(
        "large-raster"
      )?.canvas
        ? "canvas"
        : null,
    }))
  ).toMatchObject({
    settings: { tip: { kind: "sampled", sampleId: "pixel" } },
    surface: "canvas",
  });

  await page.mouse.up();
});

const setSliderValue = async (page, name: string, value: number) => {
  const slider = page.getByRole("slider", { exact: true, name });

  await slider.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type(String(value));
  await page.keyboard.press("Enter");
};
