import { expect, test } from "@playwright/test";
import {
  dragNodeBy,
  expectCoordinateShift,
  expectRectShift,
  getStateSnapshot,
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
  waitForNodeReady,
} from "./helpers/editor";

test("alt-drag duplicates an unselected node and drags the copy", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-move.punch");
  const originalNodeId = "move-node";
  const dragDelta = { x: 140, y: 80 };

  const originalBefore = await waitForNodeReady(page, originalNodeId);
  await dragNodeBy(page, originalNodeId, dragDelta, { altKey: true });
  await pauseForUi(page);

  const state = await getStateSnapshot(page);
  const duplicateNodeId = state.selectedNodeId;

  expect(state.nodes).toHaveLength(2);
  expect(duplicateNodeId).not.toBe(originalNodeId);

  const originalAfter = await waitForNodeReady(page, originalNodeId);
  const duplicateAfter = await waitForNodeReady(page, duplicateNodeId);

  expectCoordinateShift(originalBefore, originalAfter, { x: 0, y: 0 });
  expectCoordinateShift(originalBefore, duplicateAfter, dragDelta);
  expectRectShift(originalBefore.elementRect, originalAfter.elementRect, {
    x: 0,
    y: 0,
  });
  expectRectShift(
    originalBefore.elementRect,
    duplicateAfter.elementRect,
    dragDelta
  );
});

test("alt-drag duplicates a selected node and drags the copy", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-move.punch");
  const originalNodeId = "move-node";
  const dragDelta = { x: 90, y: 60 };

  await page.locator(`[data-node-id="${originalNodeId}"]`).click();

  const originalBefore = await waitForNodeReady(page, originalNodeId);
  await dragNodeBy(page, originalNodeId, dragDelta, { altKey: true });
  await pauseForUi(page);

  const state = await getStateSnapshot(page);
  const duplicateNodeId = state.selectedNodeId;

  expect(state.nodes).toHaveLength(2);
  expect(duplicateNodeId).not.toBe(originalNodeId);

  const originalAfter = await waitForNodeReady(page, originalNodeId);
  const duplicateAfter = await waitForNodeReady(page, duplicateNodeId);

  expectCoordinateShift(originalBefore, originalAfter, { x: 0, y: 0 });
  expectCoordinateShift(originalBefore, duplicateAfter, dragDelta);
});
