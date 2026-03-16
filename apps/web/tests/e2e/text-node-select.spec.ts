import { expect, test } from "@playwright/test";
import {
  getSelectionSnapshot,
  gotoEditor,
  loadDocumentFixture,
  waitForNodeReady,
} from "./editor-helpers";

test("clicking, shift-clicking, and escape drive selection through the browser", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-select.punch");
  const firstNodeId = "select-first-node";
  const secondNodeId = "select-second-node";

  await waitForNodeReady(page, firstNodeId);
  await waitForNodeReady(page, secondNodeId);

  await page.keyboard.press("Escape");
  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([]);

  await page.getByRole("button", { name: "Select first" }).first().click();

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([firstNodeId]);
  await expect
    .poll(async () => (await getSelectionSnapshot(page)).isMoveableMuted)
    .toBe(false);

  await page.keyboard.down("Shift");
  await page.getByRole("button", { name: "Select second" }).first().click();
  await page.keyboard.up("Shift");

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([firstNodeId, secondNodeId]);

  await page.keyboard.press("Escape");

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([]);
});
