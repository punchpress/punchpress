import { expect, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocumentFixture,
  waitForNodeReady,
} from "./helpers/editor";

const getNodeCursor = (page, nodeId) => {
  return page.locator(`[data-node-id="${nodeId}"]`).evaluate((element) => {
    return window.getComputedStyle(element).cursor;
  });
};

test("uses pointer for unselected hover and grab for selected hover", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "hover-preview.punch");
  const nodeId = "hover-node";
  await waitForNodeReady(page, nodeId);

  const node = page.locator(`[data-node-id="${nodeId}"]`);
  const box = await node.boundingBox();

  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  await node.hover();
  await expect.poll(() => getNodeCursor(page, nodeId)).toBe("pointer");

  await node.click();
  await node.hover();
  await expect.poll(() => getNodeCursor(page, nodeId)).toBe("grab");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => getNodeCursor(page, nodeId)).toBe("grab");
  await page.mouse.move(box.x + box.width / 2 + 8, box.y + box.height / 2 + 8);
  await expect.poll(() => getNodeCursor(page, nodeId)).toBe("grabbing");
  await page.mouse.up();
});
