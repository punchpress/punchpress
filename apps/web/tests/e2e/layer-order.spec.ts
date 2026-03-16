import { expect, test } from "@playwright/test";
import {
  dragLayerBelow,
  getCanvasNodeIds,
  getStateSnapshot,
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
  waitForNodeReady,
} from "./editor-helpers";

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
