import { expect, test } from "@playwright/test";
import {
  getSelectionSnapshot,
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
  waitForNodeReady,
  waitForSelectionHandles,
  zoomIn,
} from "./helpers/editor";

test("keeps resize handles the same size while zooming", async ({ page }) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "zoom-handle-size.punch");
  const nodeId = "zoom-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();

  await waitForNodeReady(page, nodeId);
  await pauseForUi(page);

  const before = await waitForSelectionHandles(page);

  await zoomIn(page, 3);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).zoom)
    .toBeGreaterThan(1.5);

  const after = await waitForSelectionHandles(page);

  expect(
    Math.abs(after.handles.se.width - before.handles.se.width)
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(after.handles.se.height - before.handles.se.height)
  ).toBeLessThanOrEqual(1);
});
