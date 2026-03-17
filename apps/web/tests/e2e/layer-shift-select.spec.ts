import { expect, test } from "@playwright/test";
import {
  getSelectionSnapshot,
  getStateSnapshot,
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
  shiftClickLayer,
  waitForNodeReady,
} from "./helpers/editor";

test("shift-click layer selection groups layers in layer order", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "layer-shift-select.punch");
  const backNodeId = "shift-back-node";
  const middleNodeId = "shift-middle-node";
  const frontNodeId = "shift-front-node";

  await waitForNodeReady(page, backNodeId);
  await waitForNodeReady(page, middleNodeId);
  await waitForNodeReady(page, frontNodeId);

  await page.getByRole("button", { name: "Shift back" }).first().click();
  await shiftClickLayer(page, "Shift middle");
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([backNodeId, middleNodeId]);
});

test("shift-clicking another layer while editing exits text editing first", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "layer-shift-select-while-editing.punch");
  const editingNodeId = "shift-editing-node";
  const otherNodeId = "shift-other-node";

  await waitForNodeReady(page, editingNodeId);
  await waitForNodeReady(page, otherNodeId);

  await page.getByRole("button", { name: "Editing node" }).first().dblclick();

  await expect(page.getByTestId("canvas-text-input")).toBeVisible();

  await shiftClickLayer(page, "Other node");
  await pauseForUi(page);

  await expect(page.getByTestId("canvas-text-input")).toHaveCount(0);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);

      return {
        activeTool: state.activeTool,
        editingNodeId: state.editingNodeId,
        selectedNodeIds: state.selectedNodeIds,
      };
    })
    .toEqual({
      activeTool: "pointer",
      editingNodeId: null,
      selectedNodeIds: [editingNodeId, otherNodeId],
    });
});
