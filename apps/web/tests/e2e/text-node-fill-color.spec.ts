import { expect, test } from "@playwright/test";
import {
  getStateSnapshot,
  gotoEditor,
  loadDocumentFixture,
} from "./helpers/editor";

const getFillItem = (page) => {
  return page.getByTestId("appearance-fills-item").first();
};

const getFillColorInput = (page) => {
  return getFillItem(page).getByLabel("Hex color");
};

const getFillOpacityInput = (page) => {
  return getFillItem(page).getByLabel("Color opacity");
};

// The color field's popover trigger wraps its hex input.
const getFillColorButton = (page) => {
  return getFillColorInput(page).locator("xpath=..");
};

const clickColorSwatch = async (locator) => {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("Missing color swatch bounds");
  }

  await locator.page().mouse.click(box.x + 14, box.y + box.height / 2);
};

const getSelectedNodeFill = async (page, nodeId) => {
  const state = await getStateSnapshot(page);
  const node = state?.nodes?.find((candidate) => candidate.id === nodeId);

  return node?.fill ?? null;
};

// Alpha lives on the primary fill layer's opacity.
const getSelectedNodeFillAlpha = async (page, nodeId) => {
  const state = await getStateSnapshot(page);
  const node = state?.nodes?.find((candidate) => candidate.id === nodeId);

  return node?.appearance?.fills?.[0]?.opacity ?? null;
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

  await expect(fillInput).toHaveValue("11AA22");
  await expect.poll(() => getSelectedNodeFill(page, nodeId)).toBe("#11aa22");
});

test("keeps keyboard-entered hex colors intact until they are committed", async ({
  page,
}) => {
  await gotoEditor(page);

  for (const nextHex of ["123456", "FF0000"]) {
    await loadDocumentFixture(page, "color-picker-field.punch");
    const nodeId = "color-node";
    await page.getByRole("button", { name: "Color" }).first().click();
    const fillInput = getFillColorInput(page);

    await fillInput.click();
    await fillInput.pressSequentially(nextHex);

    await expect(fillInput).toHaveValue(nextHex);
    await expect.poll(() => getSelectedNodeFill(page, nodeId)).toBe("#ffffff");

    await fillInput.blur();

    await expect(fillInput).toHaveValue(nextHex);
    await expect
      .poll(() => getSelectedNodeFill(page, nodeId))
      .toBe(`#${nextHex.toLowerCase()}`);
  }
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
  await expect(fillInput).toHaveValue("112233");

  await fillInput.fill("not-a-color");
  await fillInput.blur();

  await expect(fillInput).toHaveValue("112233");
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
  const fillOpacityInput = getFillOpacityInput(page);

  await fillInput.fill("#FF0000");
  await fillInput.blur();

  await clickColorSwatch(getFillColorButton(page));

  const picker = page.locator("[data-slot='color-picker']").last();
  const alphaSlider = picker
    .getByRole("slider", { name: "Color picker slider" })
    .nth(1);

  await alphaSlider.focus();
  await alphaSlider.press("Home");

  await expect.poll(() => getSelectedNodeFill(page, nodeId)).toBe("#ff0000");
  await expect.poll(() => getSelectedNodeFillAlpha(page, nodeId)).toBe(0);
  await expect(fillInput).toHaveValue("FF0000");
  await expect(fillOpacityInput).toHaveValue("0");
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

  await clickColorSwatch(getFillColorButton(page));

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
      const alpha = await getSelectedNodeFillAlpha(page, nodeId);
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

  await clickColorSwatch(getFillColorButton(page));

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

  const initialAlpha = await getSelectedNodeFillAlpha(page, nodeId);
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
    .poll(() => getSelectedNodeFillAlpha(page, nodeId))
    .toBeLessThan(0.3);
  await expect
    .poll(() => getSelectedNodeFillAlpha(page, nodeId))
    .not.toBe(initialAlpha);
  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state?.selectedNodeId || null;
    })
    .toBe(nodeId);
  await expect(picker).toBeVisible();
});
