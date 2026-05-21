import { expect, test } from "@playwright/test";
import { getStateSnapshot, gotoEditor, pauseForUi } from "./helpers/editor";

const helloWorldLayerName = /Hello world/;

test("creates and commits a text layer", async ({ page }) => {
  await gotoEditor(page);

  await expect(page.getByText("No layers yet.")).toBeVisible();

  await page.getByRole("button", { name: "Text (T)" }).click();
  await pauseForUi(page);

  await page.getByTestId("canvas-stage").click({
    position: { x: 400, y: 300 },
  });
  await pauseForUi(page);

  await expect
    .poll(async () => (await getStateSnapshot(page)).activeTool)
    .toBe("pointer");
  await expect
    .poll(async () => (await getStateSnapshot(page)).editingNodeId)
    .not.toBeNull();
  await expect
    .poll(() => {
      return page
        .locator(".canvas-surface")
        .evaluate((element) => window.getComputedStyle(element).cursor);
    })
    .not.toBe("crosshair");

  const textInput = page.getByTestId("canvas-text-input");
  await textInput.fill("Hello world");
  await pauseForUi(page);
  await textInput.press("Enter");
  await pauseForUi(page);

  await expect(
    page.getByRole("button", { name: helloWorldLayerName })
  ).toBeVisible();
  await expect(page.locator("[data-node-id]")).toHaveCount(1);
});

test("centers the placed text editor over the click point", async ({
  page,
}) => {
  await gotoEditor(page);

  const stage = page.getByTestId("canvas-stage");
  const stageBox = await stage.boundingBox();

  expect(stageBox).not.toBeNull();

  if (!stageBox) {
    return;
  }

  const clickPoint = {
    x: stageBox.x + stageBox.width * 0.5,
    y: stageBox.y + 300,
  };

  await page.keyboard.press("t");
  await pauseForUi(page);
  await page.mouse.click(clickPoint.x, clickPoint.y);
  await pauseForUi(page);

  const textInputBox = await page
    .getByTestId("canvas-text-input")
    .boundingBox();

  expect(textInputBox).not.toBeNull();

  if (!textInputBox) {
    return;
  }

  expect(textInputBox.x + textInputBox.width / 2).toBeCloseTo(clickPoint.x, 1);
  expect(textInputBox.y + textInputBox.height / 2).toBeCloseTo(clickPoint.y, 1);
});
