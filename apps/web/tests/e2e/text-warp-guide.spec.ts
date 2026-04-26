import { expect, test } from "@playwright/test";
import { clickNodeCenter } from "./helpers/canvas";
import { gotoEditor, loadDocument, pauseForUi } from "./helpers/editor";

const ARCH_TEXT_DOCUMENT = {
  nodes: [
    {
      fill: "#ffffff",
      font: {
        family: "Arial",
        fullName: "Arial",
        postscriptName: "ArialMT",
        style: "Regular",
      },
      fontSize: 220,
      id: "arch-text-node",
      parentId: "root",
      stroke: "#000000",
      strokeWidth: 12,
      text: "YOUR TEXT",
      tracking: 10,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 420,
        y: 260,
      },
      type: "text",
      visible: true,
      warp: {
        bend: 0.4,
        kind: "arch",
      },
    },
  ],
  version: "1.7",
} as const;

test("arch text warp hides the guide until the warp handle is actively dragged", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, JSON.stringify(ARCH_TEXT_DOCUMENT));
  await pauseForUi(page);

  await clickNodeCenter(page, "arch-text-node");
  await pauseForUi(page);

  const warpHandle = page.getByTestId("text-path-handle-bend");
  await expect(warpHandle).toBeVisible();
  await expect(page.getByTestId("text-path-guide")).toHaveCount(0);

  const handleBox = await warpHandle.boundingBox();

  if (!handleBox) {
    throw new Error("Missing text warp handle bounds");
  }

  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2 + 12,
    { steps: 4 }
  );
  await pauseForUi(page);

  await expect(page.getByTestId("text-path-guide")).toBeVisible();

  await page.mouse.up();
  await pauseForUi(page);

  await expect(page.getByTestId("text-path-guide")).toHaveCount(0);
});
