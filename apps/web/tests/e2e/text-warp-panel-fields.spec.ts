import { expect, test } from "@playwright/test";
import { gotoEditor, pauseForUi } from "./helpers/editor";

const TEST_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
};

const loadPlainTextDocument = async (page) => {
  await page.evaluate((font) => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return false;
    }

    editor.loadDocument(
      JSON.stringify({
        nodes: [
          {
            fill: "#000000",
            font,
            fontSize: 120,
            id: "plain-text-node",
            parentId: "root",
            stroke: null,
            strokeWidth: 0,
            text: "PLAIN",
            tracking: 0,
            transform: {
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              x: 380,
              y: 260,
            },
            type: "text",
            visible: true,
            warp: {
              kind: "none",
            },
          },
        ],
        version: "1.7",
      })
    );

    return true;
  }, TEST_FONT);
};

test("uses scrub sliders for all warp panel inputs", async ({ page }) => {
  await gotoEditor(page);
  await loadPlainTextDocument(page);
  await page.locator('.canvas-node[data-node-id="plain-text-node"]').click();
  await pauseForUi(page);

  await page.getByRole("button", { name: "Arch" }).click();
  await expect(page.getByRole("slider", { name: "Bend" })).toBeVisible();

  await page.getByRole("button", { name: "Wave" }).click();
  await expect(page.getByRole("slider", { name: "Amplitude" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Cycles" })).toBeVisible();

  await page.getByRole("button", { name: "Circle" }).click();
  await expect(page.getByRole("slider", { name: "Radius" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Sweep" })).toBeVisible();

  await page.getByRole("button", { name: "Slant" }).click();
  await expect(page.getByRole("slider", { name: "Slant" })).toBeVisible();
});
