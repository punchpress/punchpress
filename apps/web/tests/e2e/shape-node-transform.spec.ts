import { expect, test } from "@playwright/test";
import {
  dragNodeBy,
  expectCoordinateShift,
  expectHandleAlignedToNodeCorner,
  expectRectShift,
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
  resizeSelectionFromCorner,
  resizeSelectionFromEdge,
  rotateSelectionFromCorner,
  waitForNodeReady,
  waitForSelectionHandles,
  zoomOut,
} from "./helpers/editor";

const getRectCenter = (rect) => {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
};

const getElementRect = (page, selector) => {
  return page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    const rect = element?.getBoundingClientRect?.();

    if (!rect) {
      return null;
    }

    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
      x: rect.x,
      y: rect.y,
    };
  }, selector);
};

test("moves a rectangle shape node around the canvas", async ({ page }) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "shape-node-transform.punch");
  const nodeId = "shape-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();

  const before = await waitForNodeReady(page, nodeId);
  await pauseForUi(page);

  const delta = { x: 140, y: 80 };
  await dragNodeBy(page, nodeId, delta);
  await pauseForUi(page);

  const after = await waitForNodeReady(page, nodeId);
  const selection = await waitForSelectionHandles(page);

  expectCoordinateShift(before, after, delta, 8);
  expectRectShift(before.elementRect, after.elementRect, delta, 10);
  expectHandleAlignedToNodeCorner(
    selection.handles.nw,
    after.elementRect,
    "nw"
  );
  expectHandleAlignedToNodeCorner(
    selection.handles.se,
    after.elementRect,
    "se"
  );
});

test("resizes a rectangle shape node from the lower-right corner", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "shape-node-transform.punch");
  const nodeId = "shape-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();

  const before = await waitForNodeReady(page, nodeId);
  await pauseForUi(page);

  await resizeSelectionFromCorner(page, {
    corner: "se",
    drag: { x: 80, y: 60 },
  });
  await pauseForUi(page);

  const after = await waitForNodeReady(page, nodeId);
  const selection = await waitForSelectionHandles(page);

  expect(after.elementRect.width).toBeGreaterThan(
    before.elementRect.width + 20
  );
  expect(after.elementRect.height).toBeGreaterThan(
    before.elementRect.height + 10
  );
  expect(after.elementRect.left).toBeCloseTo(before.elementRect.left, 1);
  expect(after.elementRect.top).toBeCloseTo(before.elementRect.top, 1);
  expectHandleAlignedToNodeCorner(
    selection.handles.nw,
    after.elementRect,
    "nw"
  );
  expectHandleAlignedToNodeCorner(
    selection.handles.se,
    after.elementRect,
    "se"
  );
});

test("resizes a rectangle shape node from the east edge without changing its height", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "shape-node-transform.punch");
  const nodeId = "shape-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();

  const before = await waitForNodeReady(page, nodeId);
  await pauseForUi(page);

  await resizeSelectionFromEdge(page, {
    drag: { x: 120, y: 0 },
    edge: "e",
  });
  await pauseForUi(page);

  const after = await waitForNodeReady(page, nodeId);

  expect(after.width).toBeGreaterThan((before.width ?? 0) + 100);
  expect(after.height).toBeCloseTo(before.height ?? 0, 1);
  expect(after.x).toBeGreaterThan((before.x ?? 0) + 40);
  expect(after.y).toBeCloseTo(before.y ?? 0, 1);
});

test("freeform corner resize changes a rectangle shape aspect ratio by default", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "shape-node-transform.punch");
  const nodeId = "shape-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();

  const before = await waitForNodeReady(page, nodeId);
  const beforeAspect = (before.width ?? 1) / (before.height ?? 1);
  await pauseForUi(page);

  await resizeSelectionFromCorner(page, {
    corner: "se",
    drag: { x: 140, y: 20 },
  });
  await pauseForUi(page);

  const after = await waitForNodeReady(page, nodeId);
  const afterAspect = (after.width ?? 1) / (after.height ?? 1);

  expect(after.width).toBeGreaterThan((before.width ?? 0) + 100);
  expect(after.height).toBeGreaterThan(before.height ?? 0);
  expect(afterAspect).toBeGreaterThan(beforeAspect + 0.2);
});

test("holding shift preserves a rectangle shape aspect ratio while resizing from a corner", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "shape-node-transform.punch");
  const nodeId = "shape-node";
  const handle = page.locator(".canvas-moveable .moveable-control.moveable-se");

  await page.locator(`[data-node-id="${nodeId}"]`).click();

  const before = await waitForNodeReady(page, nodeId);
  const beforeAspect = (before.width ?? 1) / (before.height ?? 1);
  const box = await handle.boundingBox();

  if (!box) {
    throw new Error("Missing se resize handle");
  }

  const start = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };

  await handle.hover();
  await page.mouse.down();
  await page.keyboard.down("Shift");
  await page.mouse.move(start.x + 140, start.y + 20, { steps: 24 });
  await page.keyboard.up("Shift");
  await page.mouse.up();
  await pauseForUi(page);

  const after = await waitForNodeReady(page, nodeId);
  const afterAspect = (after.width ?? 1) / (after.height ?? 1);

  expect(after.width).toBeGreaterThan((before.width ?? 0) + 100);
  expect(after.height).toBeGreaterThan((before.height ?? 0) + 50);
  expect(afterAspect).toBeCloseTo(beforeAspect, 1);
});

test("rotates a rectangle shape node without drifting away from its transform outline", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "shape-node-transform.punch");
  const nodeId = "shape-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();
  await waitForNodeReady(page, nodeId);
  await zoomOut(page, 5);
  await pauseForUi(page);

  const before = await waitForNodeReady(page, nodeId);
  await rotateSelectionFromCorner(page, {
    corner: "nw",
    drag: { x: 120, y: 80 },
  });
  await pauseForUi(page);

  const after = await waitForNodeReady(page, nodeId);
  const beforeCenter = getRectCenter(before.elementRect);
  const afterCenter = getRectCenter(after.elementRect);
  const overlayRect = await getElementRect(
    page,
    ".canvas-single-node-transform-overlay"
  );
  const nodeRect = await getElementRect(page, `[data-node-id="${nodeId}"]`);

  expect(Math.abs(after.rotation)).toBeGreaterThan(5);
  expect(after.x).toBeCloseTo(before.x, 1);
  expect(after.y).toBeCloseTo(before.y, 1);
  expect(afterCenter.x).toBeCloseTo(beforeCenter.x, 1);
  expect(afterCenter.y).toBeCloseTo(beforeCenter.y, 1);
  expect(overlayRect).not.toBeNull();
  expect(nodeRect).not.toBeNull();
  expect(nodeRect.x).toBeCloseTo(overlayRect.x, 1);
  expect(nodeRect.y).toBeCloseTo(overlayRect.y, 1);
  expect(nodeRect.width).toBeCloseTo(overlayRect.width, 1);
  expect(nodeRect.height).toBeCloseTo(overlayRect.height, 1);
});

test("keeps a star shape aligned with its transform outline", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "star-node-transform.punch");
  const nodeId = "star-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();
  await waitForNodeReady(page, nodeId);
  await pauseForUi(page);

  const overlayRect = await getElementRect(
    page,
    ".canvas-single-node-transform-overlay"
  );
  const nodeRect = await getElementRect(page, `[data-node-id="${nodeId}"]`);

  expect(overlayRect).not.toBeNull();
  expect(nodeRect).not.toBeNull();
  expect(nodeRect.x).toBeCloseTo(overlayRect.x, 1);
  expect(nodeRect.y).toBeCloseTo(overlayRect.y, 1);
  expect(nodeRect.width).toBeCloseTo(overlayRect.width, 1);
  expect(nodeRect.height).toBeCloseTo(overlayRect.height, 1);
});
