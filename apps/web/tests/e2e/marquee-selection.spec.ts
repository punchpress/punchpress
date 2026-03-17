import { expect, test } from "@playwright/test";
import { getBoundingUnion } from "./helpers/canvas";
import {
  expectHandleAlignedToNodeCorner,
  getSelectionSnapshot,
  gotoEditor,
  loadDocumentFixture,
  marqueeSelect,
  pauseForUi,
  waitForNodeReady,
  waitForSelectionHandles,
} from "./helpers/editor";

test("marquee selection moves multiple layers together", async ({ page }) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "marquee-selection-move.punch");
  const firstNodeId = "marquee-move-first-node";
  const secondNodeId = "marquee-move-second-node";

  const firstBefore = await waitForNodeReady(page, firstNodeId);
  const secondBefore = await waitForNodeReady(page, secondNodeId);
  const start = {
    x:
      Math.min(firstBefore.elementRect.left, secondBefore.elementRect.left) -
      96,
    y: Math.min(firstBefore.elementRect.top, secondBefore.elementRect.top) - 96,
  };
  const end = {
    x:
      Math.max(firstBefore.elementRect.right, secondBefore.elementRect.right) +
      96,
    y:
      Math.max(
        firstBefore.elementRect.bottom,
        secondBefore.elementRect.bottom
      ) + 96,
  };

  await marqueeSelect(page, start, end);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([firstNodeId, secondNodeId]);

  const dragStart = {
    x: firstBefore.elementRect.x + firstBefore.elementRect.width / 2,
    y: firstBefore.elementRect.y + firstBefore.elementRect.height / 2,
  };

  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragStart.x + 90, dragStart.y + 55, {
    steps: 12,
  });
  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const firstAfterRect = await page
        .locator(`[data-node-id="${firstNodeId}"]`)
        .boundingBox();
      const secondAfterRect = await page
        .locator(`[data-node-id="${secondNodeId}"]`)
        .boundingBox();

      if (!(firstAfterRect && secondAfterRect)) {
        return null;
      }

      return {
        first: {
          x: Math.round(firstAfterRect.x),
          y: Math.round(firstAfterRect.y),
        },
        second: {
          x: Math.round(secondAfterRect.x),
          y: Math.round(secondAfterRect.y),
        },
      };
    })
    .toEqual({
      first: {
        x: Math.round(firstBefore.elementRect.x + 90),
        y: Math.round(firstBefore.elementRect.y + 55),
      },
      second: {
        x: Math.round(secondBefore.elementRect.x + 90),
        y: Math.round(secondBefore.elementRect.y + 55),
      },
    });
});

test("marquee selection shows one wrapper box around the whole group", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "marquee-selection-wrapper.punch");
  const firstNodeId = "marquee-wrapper-first-node";
  const secondNodeId = "marquee-wrapper-second-node";
  const thirdNodeId = "marquee-wrapper-third-node";

  const firstNode = await waitForNodeReady(page, firstNodeId);
  const secondNode = await waitForNodeReady(page, secondNodeId);
  const thirdNode = await waitForNodeReady(page, thirdNodeId);
  const groupBounds = getBoundingUnion([
    firstNode.elementRect,
    secondNode.elementRect,
    thirdNode.elementRect,
  ]);

  await marqueeSelect(
    page,
    {
      x: groupBounds.left - 96,
      y: groupBounds.top - 96,
    },
    {
      x: groupBounds.right + 96,
      y: groupBounds.bottom + 96,
    }
  );
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([firstNodeId, secondNodeId, thirdNodeId]);

  const selection = await waitForSelectionHandles(page);

  expectHandleAlignedToNodeCorner(selection.handles.nw, groupBounds, "nw");
  expectHandleAlignedToNodeCorner(selection.handles.se, groupBounds, "se");
});
