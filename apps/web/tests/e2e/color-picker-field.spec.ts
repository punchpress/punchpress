import { expect, test } from "@playwright/test";
import { createTextNode, getStateSnapshot, gotoEditor } from "./editor-helpers";

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

test("normalizes a typed fill color and applies it to the selected node", async ({
  page,
}) => {
  await gotoEditor(page);
  const nodeId = await createTextNode(page, {
    text: "Color",
    x: 240,
    y: 240,
  });
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
  const nodeId = await createTextNode(page, {
    text: "Color",
    x: 240,
    y: 240,
  });
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
  const nodeId = await createTextNode(page, {
    text: "Color",
    x: 240,
    y: 240,
  });
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
