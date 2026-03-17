import { expect, test } from "@playwright/test";
import { clickEmptyCanvas, getBoundingUnion } from "./helpers/canvas";
import {
  getSelectionSnapshot,
  getStateSnapshot,
  gotoEditor,
  loadDocumentFixture,
  marqueeSelect,
  pauseForUi,
  waitForNodeReady,
  waitForSelectionHandles,
} from "./helpers/editor";

test("hiding a layer removes it from canvas but keeps it selected", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "layer-hide-single.punch");
  const nodeId = "hide-single-node";

  await waitForNodeReady(page, nodeId);
  await page.getByRole("button", { name: "Hide me" }).first().dblclick();

  await page.getByRole("button", { name: "Hide layer" }).click();
  await pauseForUi(page);

  await expect(page.locator(`[data-node-id="${nodeId}"]`)).toHaveCount(0);

  await expect
    .poll(async () => {
      const selection = await getSelectionSnapshot(page);
      const state = await getStateSnapshot(page);
      const node = state.nodes.find((item) => item.id === nodeId);

      return {
        activeTool: state.activeTool,
        selectedNodeId: selection.selectedNodeId,
        visible: node?.visible ?? true,
      };
    })
    .toEqual({
      activeTool: "pointer",
      selectedNodeId: nodeId,
      visible: false,
    });

  await clickEmptyCanvas(page);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.length;
    })
    .toBe(1);
});

test("hiding one layer in a multi-selection keeps the visible layer draggable", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "layer-hide-multiselect.punch");
  const firstNodeId = "hide-visible-node";
  const secondNodeId = "hide-selected-node";

  const firstBefore = await waitForNodeReady(page, firstNodeId);
  const secondBefore = await waitForNodeReady(page, secondNodeId);
  const selectionBounds = getBoundingUnion([
    firstBefore.elementRect,
    secondBefore.elementRect,
  ]);

  await marqueeSelect(
    page,
    {
      x: selectionBounds.left - 96,
      y: selectionBounds.top - 96,
    },
    {
      x: selectionBounds.right + 96,
      y: selectionBounds.bottom + 96,
    }
  );
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([firstNodeId, secondNodeId]);

  await page.getByRole("button", { name: "Hide layer" }).first().click();
  await pauseForUi(page);

  const stateAfterHide = await getStateSnapshot(page);
  const visibleNodeId = stateAfterHide.nodes.find(
    (node) => node.visible !== false
  )?.id;

  expect(visibleNodeId).toBe(firstNodeId);

  const selection = await waitForSelectionHandles(page);

  expect(selection.handles.nw).not.toBeNull();
  expect(selection.handles.se).not.toBeNull();

  const visibleBefore = await waitForNodeReady(page, visibleNodeId);
  const dragStart = {
    x: visibleBefore.elementRect.x + visibleBefore.elementRect.width / 2,
    y: visibleBefore.elementRect.y + visibleBefore.elementRect.height / 2,
  };

  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragStart.x + 70, dragStart.y + 45, {
    steps: 10,
  });
  await page.mouse.up();
  await pauseForUi(page);

  const visibleAfter = await waitForNodeReady(page, visibleNodeId);

  expect(visibleAfter.x).toBeCloseTo(visibleBefore.x + 70, 1);
  expect(visibleAfter.y).toBeCloseTo(visibleBefore.y + 45, 1);
});
