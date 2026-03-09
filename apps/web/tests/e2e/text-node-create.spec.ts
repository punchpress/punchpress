import { expect, test } from "@playwright/test";
import { gotoEditor, pauseForUi } from "./editor-helpers";

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
