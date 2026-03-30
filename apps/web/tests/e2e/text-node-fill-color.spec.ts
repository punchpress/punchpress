import { expect, test } from "@playwright/test";
import {
  getStateSnapshot,
  gotoEditor,
  loadDocumentFixture,
} from "./helpers/editor";

const getFillAndStrokeSection = (page) => {
  return page.locator("section").filter({ hasText: "Fill & Stroke" });
};

const getFillColorInput = (page) => {
  return getFillAndStrokeSection(page).getByRole("textbox").nth(0);
};

const getFillColorButton = (page) => {
  return getFillAndStrokeSection(page)
    .getByRole("button", { name: "Choose color" })
    .nth(0);
};

const getSelectedNodeFill = async (page, nodeId) => {
  const state = await getStateSnapshot(page);
  const node = state?.nodes?.find((candidate) => candidate.id === nodeId);

  return node?.fill ?? null;
};

const getFillAlpha = (fill) => {
  if (typeof fill !== "string") {
    return null;
  }

  const rgbaMatch = fill.match(
    /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)/
  );

  if (rgbaMatch) {
    return Number.parseFloat(rgbaMatch[1] || "0");
  }

  if (fill.startsWith("#")) {
    return 1;
  }

  return null;
};

test("normalizes a typed fill color and applies it to the selected node", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "color-picker-field.punch");
  const nodeId = "color-node";
  await page.getByRole("button", { name: "Color" }).first().click();
  const fillInput = getFillColorInput(page);

  await expect.poll(() => getSelectedNodeFill(page, nodeId)).toBe("#ffffff");

  await fillInput.fill("#11aa22");
  await fillInput.blur();

  await expect(fillInput).toHaveValue("#11AA22");
  await expect.poll(() => getSelectedNodeFill(page, nodeId)).toBe("#11AA22");
});

test("reverts an invalid fill draft to the last committed color on blur", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "color-picker-field.punch");
  const nodeId = "color-node";
  await page.getByRole("button", { name: "Color" }).first().click();
  const fillInput = getFillColorInput(page);

  await fillInput.fill("#112233");
  await fillInput.blur();
  await expect(fillInput).toHaveValue("#112233");

  await fillInput.fill("not-a-color");
  await fillInput.blur();

  await expect(fillInput).toHaveValue("#112233");
  await expect.poll(() => getSelectedNodeFill(page, nodeId)).toBe("#112233");
});

test("updates the selected node when the alpha slider changes", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "color-picker-field.punch");
  const nodeId = "color-node";
  await page.getByRole("button", { name: "Color" }).first().click();
  const fillInput = getFillColorInput(page);

  await fillInput.fill("#FF0000");
  await fillInput.blur();

  await getFillColorButton(page).click();

  const picker = page.locator("[data-slot='color-picker']").last();
  const alphaSlider = picker
    .getByRole("slider", { name: "Color picker slider" })
    .nth(1);

  await alphaSlider.focus();
  await alphaSlider.press("Home");

  await expect
    .poll(() => getSelectedNodeFill(page, nodeId))
    .toBe("rgba(255, 0, 0, 0)");
  await expect(fillInput).toHaveValue("rgba(255, 0, 0, 0)");
});

test("clicking the alpha slider applies the clicked value instead of resetting to zero", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "color-picker-field.punch");
  const nodeId = "color-node";
  await page.getByRole("button", { name: "Color" }).first().click();
  const fillInput = getFillColorInput(page);

  await fillInput.fill("#FF0000");
  await fillInput.blur();

  await getFillColorButton(page).click();

  const picker = page.locator("[data-slot='color-picker']").last();
  const alphaSlider = picker
    .getByRole("slider", { name: "Color picker slider" })
    .nth(1);

  const alphaSliderBox = await alphaSlider.boundingBox();
  expect(alphaSliderBox).not.toBeNull();
  if (!alphaSliderBox) {
    return;
  }

  await page.mouse.click(
    alphaSliderBox.x + alphaSliderBox.width * 0.72,
    alphaSliderBox.y + alphaSliderBox.height / 2
  );

  await expect
    .poll(async () => {
      const alpha = getFillAlpha(await getSelectedNodeFill(page, nodeId));
      return alpha !== null && alpha > 0.55 && alpha < 0.85;
    })
    .toBe(true);
  await expect(picker).toBeVisible();
});

test("keeps the color picker open while dragging the alpha slider with the mouse", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "color-picker-field.punch");
  const nodeId = "color-node";
  await page.getByRole("button", { name: "Color" }).first().click();
  const fillInput = getFillColorInput(page);

  await fillInput.fill("#FF0000");
  await fillInput.blur();

  await getFillColorButton(page).click();

  const picker = page.locator("[data-slot='color-picker']").last();
  const alphaSlider = picker
    .getByRole("slider", { name: "Color picker slider" })
    .nth(1);

  await expect(picker).toBeVisible();
  await expect(alphaSlider).toBeVisible();

  const alphaSliderBox = await alphaSlider.boundingBox();
  expect(alphaSliderBox).not.toBeNull();
  if (!alphaSliderBox) {
    return;
  }

  const initialFill = await getSelectedNodeFill(page, nodeId);
  const startPoint = {
    x: alphaSliderBox.x + alphaSliderBox.width / 2,
    y: alphaSliderBox.y + alphaSliderBox.height / 2,
  };
  const endPoint = {
    x: startPoint.x - 80,
    y: startPoint.y,
  };

  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down();
  await page.mouse.move(endPoint.x, endPoint.y, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(async () => {
      return getFillAlpha(await getSelectedNodeFill(page, nodeId));
    })
    .toBeLessThan(0.3);
  await expect
    .poll(() => getSelectedNodeFill(page, nodeId))
    .not.toBe(initialFill);
  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state?.selectedNodeId || null;
    })
    .toBe(nodeId);
  await expect(picker).toBeVisible();
});
