import { test } from "@playwright/test";
import {
  dragNodeBy,
  expectCoordinateShift,
  expectRectShift,
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
  waitForNodeReady,
} from "./helpers/editor";

test("moves a text node around the canvas", async ({ page }) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-move.punch");
  const nodeId = "move-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();

  const before = await waitForNodeReady(page, nodeId);
  await pauseForUi(page);

  await dragNodeBy(page, nodeId, { x: 140, y: 80 });
  await pauseForUi(page);

  const after = await waitForNodeReady(page, nodeId);

  expectCoordinateShift(before, after, { x: 140, y: 80 });
  expectRectShift(before.elementRect, after.elementRect, { x: 140, y: 80 });
});
