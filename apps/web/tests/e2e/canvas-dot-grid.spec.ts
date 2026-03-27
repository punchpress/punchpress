import { expect, test } from "@playwright/test";
import { gotoEditor } from "./helpers/editor";

test("canvas dot grid renders as a visible layer under a transparent viewport shell", async ({
  page,
}) => {
  await gotoEditor(page);

  const grid = page.locator(".canvas-dot-grid");
  await expect(grid).toBeVisible();

  const gridBox = await grid.boundingBox();

  if (!gridBox) {
    throw new Error("Missing visible canvas dot grid bounds");
  }

  expect(gridBox.width).toBeGreaterThan(100);
  expect(gridBox.height).toBeGreaterThan(100);

  const surfaceBackground = await page.locator(".canvas-surface").evaluate((element) => {
    return window.getComputedStyle(element).backgroundColor;
  });

  expect(surfaceBackground).toBe("rgba(0, 0, 0, 0)");
});
