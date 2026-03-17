import { expect, test } from "@playwright/test";
import {
  dragLayerBelow,
  getCanvasNodeIds,
  getDebugDump,
  getStateSnapshot,
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
  waitForNodeReady,
} from "./helpers/editor";

test("reordering layers updates canvas stacking order", async ({ page }) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "layer-order.punch");
  const backNodeId = "reorder-back-node";
  const frontNodeId = "reorder-front-node";

  await waitForNodeReady(page, backNodeId);
  await waitForNodeReady(page, frontNodeId);

  await expect
    .poll(async () => getCanvasNodeIds(page))
    .toEqual([backNodeId, frontNodeId]);

  await dragLayerBelow(page, "Front layer", "Back layer");
  await pauseForUi(page);

  await expect
    .poll(async () => getCanvasNodeIds(page))
    .toEqual([frontNodeId, backNodeId]);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.map((node) => node.id);
    })
    .toEqual([frontNodeId, backNodeId]);
});

test("reordering layers within a group updates the grouped child order", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "group-basic.punch");
  const firstNodeId = "basic-group-first-node";
  const secondNodeId = "basic-group-second-node";

  await waitForNodeReady(page, firstNodeId);
  await waitForNodeReady(page, secondNodeId);

  await expect
    .poll(async () => getCanvasNodeIds(page))
    .toEqual([firstNodeId, secondNodeId]);

  await dragLayerBelow(page, "Second", "First");
  await pauseForUi(page);

  await expect
    .poll(async () => getCanvasNodeIds(page))
    .toEqual([secondNodeId, firstNodeId]);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      return dump?.nodes
        ?.filter((node) => node.parentId === "basic-group-node")
        .map((node) => node.id);
    })
    .toEqual([secondNodeId, firstNodeId]);
});

test("moving an unrelated layer around a group does not renumber the group label", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "group-label-stability.punch");

  await expect(page.getByRole("button", { name: "Group 1" })).toBeVisible();

  await dragLayerBelow(page, "Loose layer", "Group 1");
  await pauseForUi(page);

  await expect(page.getByRole("button", { name: "Group 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Group 2" })).toHaveCount(0);
});

test("renaming a group keeps the explicit name", async ({ page }) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "group-basic.punch");

  await page
    .getByRole("button", { name: "Group 1" })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename group…" }).click();
  const renameInput = page.locator("input").first();
  await expect(renameInput).toBeVisible();
  await expect(renameInput).toHaveValue("Group 1");
  await renameInput.fill("Hero lockup");
  await renameInput.press("Enter");

  await expect(page.getByRole("button", { name: "Hero lockup" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Group 1" })).toHaveCount(0);
});
