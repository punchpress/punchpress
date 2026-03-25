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

const resizeMultiSelectionFromCorner = async (page, { corner, drag }) => {
  await page.evaluate(
    async ({ corner, drag }) => {
      const handle = document.querySelector(
        `.canvas-multi-node-transform-overlay .moveable-control.moveable-${corner}`
      );
      const rect = handle?.getBoundingClientRect?.();

      if (!(handle instanceof Element && rect)) {
        throw new Error(`Missing ${corner} multi-selection resize handle`);
      }

      const start = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      };
      const end = {
        x: start.x + (drag?.x || 0),
        y: start.y + (drag?.y || 0),
      };
      const dispatchPointer = (target, type, point, buttons) => {
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            button: 0,
            buttons,
            clientX: point.x,
            clientY: point.y,
            pointerId: 1,
            pointerType: "mouse",
          })
        );
      };

      dispatchPointer(handle, "pointerdown", start, 1);

      for (let step = 1; step <= 24; step += 1) {
        const progress = step / 24;
        dispatchPointer(
          window,
          "pointermove",
          {
            x: start.x + (end.x - start.x) * progress,
            y: start.y + (end.y - start.y) * progress,
          },
          1
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      dispatchPointer(window, "pointerup", end, 0);
    },
    { corner, drag }
  );
};

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

test("marquee selection resizes from the lower-right corner with the upper-left corner anchored", async ({
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

  await resizeMultiSelectionFromCorner(page, {
    corner: "se",
    drag: { x: 72, y: 72 },
  });
  await pauseForUi(page);

  const selection = await waitForSelectionHandles(page);

  expectHandleAlignedToNodeCorner(selection.handles.nw, groupBounds, "nw");
  expect(
    selection.handles.se.x + selection.handles.se.width / 2
  ).toBeGreaterThan(groupBounds.right + 16);
  expect(
    selection.handles.se.y + selection.handles.se.height / 2
  ).toBeGreaterThan(groupBounds.bottom + 16);
});
