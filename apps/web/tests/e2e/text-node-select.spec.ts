import { expect, test } from "@playwright/test";
import {
  createTextNode,
  getSelectionSnapshot,
  gotoEditor,
  waitForNodeReady,
} from "./editor-helpers";

test("selecting a text node does not flash the muted moveable frame", async ({
  page,
}) => {
  await gotoEditor(page);

  const nodeId = await createTextNode(page, {
    text: "Select me",
    x: 620,
    y: 420,
  });

  const node = await waitForNodeReady(page, nodeId);

  await page.keyboard.press("Escape");
  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([]);

  const center = {
    x: node.elementRect.x + node.elementRect.width / 2,
    y: node.elementRect.y + node.elementRect.height / 2,
  };

  await page.mouse.move(center.x, center.y);
  await page.mouse.down();

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([nodeId]);
  await expect
    .poll(async () => (await getSelectionSnapshot(page)).isMoveableMuted)
    .toBe(false);

  await page.mouse.up();

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).isMoveableMuted)
    .toBe(false);
});
