import { expect, test } from "@playwright/test";
import {
  getSelectionSnapshot,
  getStateSnapshot,
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
  waitForNodeReady,
} from "./editor-helpers";
import { clickEmptyCanvas } from "./layer-helpers";

const DUPLICATE_MENU_ITEM_NAME = /Duplicate/;

test("duplicates the selected layer with the keyboard shortcut", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "layer-duplicate-shortcut.punch");
  const originalNodeId = "duplicate-shortcut-node";
  await page.getByRole("button", { name: "Duplicate me" }).first().click();

  const original = await waitForNodeReady(page, originalNodeId);
  await page.keyboard.press("ControlOrMeta+J");
  await pauseForUi(page);

  const selection = await getSelectionSnapshot(page);
  const duplicateNodeId = selection.selectedNodeId;

  expect(duplicateNodeId).not.toBe(originalNodeId);

  const duplicate = await waitForNodeReady(page, duplicateNodeId);
  const state = await getStateSnapshot(page);

  expect(state.nodes).toHaveLength(2);
  expect(duplicate.text).toBe(original.text);
  expect(duplicate.x).toBe(original.x + 120);
  expect(duplicate.y).toBe(original.y + 120);
});

test("duplicate exits text editing before selecting the new layer", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "layer-duplicate-while-editing.punch");
  const originalNodeId = "duplicate-editing-node";

  await waitForNodeReady(page, originalNodeId);
  await page
    .getByRole("button", { name: "Duplicate while editing" })
    .first()
    .dblclick();
  await page
    .getByRole("button", { name: "Duplicate while editing" })
    .first()
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: DUPLICATE_MENU_ITEM_NAME }).click();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return {
        activeTool: state.activeTool,
        editingNodeId: state.editingNodeId,
        nodeCount: state.nodes.length,
      };
    })
    .toEqual({
      activeTool: "pointer",
      editingNodeId: null,
      nodeCount: 2,
    });

  await clickEmptyCanvas(page);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.length;
    })
    .toBe(2);
});
