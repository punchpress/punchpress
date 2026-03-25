import { expect, test } from "@playwright/test";
import {
  dragNodeBy,
  expectCoordinateShift,
  expectRectShift,
  getNodeSnapshot,
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

test("alt-drag keeps the duplicated node content visible during the drag", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-move.punch");
  const originalNodeId = "move-node";
  const dragDelta = { x: 120, y: 72 };

  await page.locator(`[data-node-id="${originalNodeId}"]`).click();

  const originalBefore = await waitForNodeReady(page, originalNodeId);
  const start = {
    x: originalBefore.elementRect.x + originalBefore.elementRect.width / 2,
    y: originalBefore.elementRect.y + originalBefore.elementRect.height / 2,
  };
  const end = {
    x: start.x + dragDelta.x,
    y: start.y + dragDelta.y,
  };

  const overlayBox = await page
    .locator(".canvas-single-node-transform-overlay")
    .boundingBox();

  if (!overlayBox) {
    throw new Error("Missing single-node transform overlay");
  }

  await page.keyboard.down("Alt");
  await page.mouse.move(
    overlayBox.x + overlayBox.width / 2,
    overlayBox.y + overlayBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      const duplicateNodeId = state.selectedNodeId;

      if (!(state.nodes.length === 2 && duplicateNodeId)) {
        return null;
      }

      const duplicate = state.nodes.find((node) => node.id === duplicateNodeId);
      const snapshot = await getNodeSnapshot(page, duplicateNodeId);

      return {
        duplicateNodeId,
        rect: snapshot?.elementRect || null,
        text: duplicate?.text || "",
      };
    })
    .not.toBeNull();

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      const duplicateNodeId = state.selectedNodeId;

      if (!(state.nodes.length === 2 && duplicateNodeId)) {
        return null;
      }

      const duplicate = state.nodes.find((node) => node.id === duplicateNodeId);
      const snapshot = await getNodeSnapshot(page, duplicateNodeId);
      const renderedContent = await page.evaluate((nodeId) => {
        const element = document.querySelector(`[data-node-id="${nodeId}"]`);
        const paths = [...(element?.querySelectorAll("path") || [])];
        const visiblePathRect = paths
          .map((path) => path.getBoundingClientRect?.())
          .find((rect) => rect && rect.width > 0 && rect.height > 0);

        return {
          pathCount: paths.length,
          visiblePathRect: visiblePathRect
            ? {
                height: visiblePathRect.height,
                width: visiblePathRect.width,
              }
            : null,
        };
      }, duplicateNodeId);

      return {
        duplicateNodeId,
        pathCount: renderedContent.pathCount,
        rect: snapshot?.elementRect || null,
        rectShift: snapshot?.elementRect
          ? {
              x: Math.round(
                snapshot.elementRect.x - originalBefore.elementRect.x
              ),
              y: Math.round(
                snapshot.elementRect.y - originalBefore.elementRect.y
              ),
            }
          : null,
        text: duplicate?.text || "",
        visiblePathRect: renderedContent.visiblePathRect,
      };
    })
    .toEqual(
      expect.objectContaining({
        duplicateNodeId: expect.any(String),
        pathCount: expect.any(Number),
        rect: expect.objectContaining({
          height: expect.any(Number),
          width: expect.any(Number),
        }),
        rectShift: {
          x: dragDelta.x,
          y: dragDelta.y,
        },
        text: "Move me",
        visiblePathRect: expect.objectContaining({
          height: expect.any(Number),
          width: expect.any(Number),
        }),
      })
    );

  const duplicateState = await getStateSnapshot(page);
  const duplicateDuringDragNodeId = duplicateState.selectedNodeId;
  const duplicateDuringDrag = duplicateDuringDragNodeId
    ? await getNodeSnapshot(page, duplicateDuringDragNodeId)
    : null;

  expect(duplicateDuringDragNodeId).not.toBe(originalNodeId);
  expect(duplicateDuringDrag?.elementRect?.width || 0).toBeGreaterThan(20);
  expect(duplicateDuringDrag?.elementRect?.height || 0).toBeGreaterThan(20);

  await page.mouse.up();
  await page.keyboard.up("Alt");
});
