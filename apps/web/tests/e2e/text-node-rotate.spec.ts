import { expect, test } from "@playwright/test";
import {
  getGroupRotationPreviewRect,
  getSelectionSnapshot,
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
  rotateSelectionFromCorner,
  rotateSelectionFromCornerWithoutRelease,
  shiftClickLayer,
  waitForNodeReady,
  zoomOut,
} from "./editor-helpers";

const getRectCenter = (rect) => {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
};

const rotatePointAround = (point, center, rotation) => {
  const angle = (rotation * Math.PI) / 180;
  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;

  return {
    x: center.x + offsetX * Math.cos(angle) - offsetY * Math.sin(angle),
    y: center.y + offsetX * Math.sin(angle) + offsetY * Math.cos(angle),
  };
};

const expectRectsClose = (before, after, tolerance = 8) => {
  expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(after.right - before.right)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(after.bottom - before.bottom)).toBeLessThanOrEqual(tolerance);
};

const getCombinedRect = (...rects) => {
  return {
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
    left: Math.min(...rects.map((rect) => rect.left)),
    right: Math.max(...rects.map((rect) => rect.right)),
    top: Math.min(...rects.map((rect) => rect.top)),
  };
};

test("rotates a selected text node from the moveable selection", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-rotate-single.punch");
  const nodeId = "rotate-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();

  await waitForNodeReady(page, nodeId);
  await zoomOut(page, 5);
  await pauseForUi(page);

  const before = await waitForNodeReady(page, nodeId);

  await rotateSelectionFromCorner(page);
  await pauseForUi(page);

  const after = await waitForNodeReady(page, nodeId);
  const beforeCenter = getRectCenter(before.elementRect);
  const afterCenter = getRectCenter(after.elementRect);

  expect(Math.abs(after.rotation)).toBeGreaterThan(5);
  expect(after.x).toBeCloseTo(before.x, 1);
  expect(after.y).toBeCloseTo(before.y, 1);
  expect(afterCenter.x).toBeCloseTo(beforeCenter.x, 1);
  expect(afterCenter.y).toBeCloseTo(beforeCenter.y, 1);
});

test("rotates a selected group of text nodes around the shared selection center", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-rotate-group.punch");
  const firstNodeId = "rotate-first-node";
  const secondNodeId = "rotate-second-node";

  await waitForNodeReady(page, firstNodeId);
  await waitForNodeReady(page, secondNodeId);
  await zoomOut(page, 5);
  await pauseForUi(page);

  const beforeFirst = await waitForNodeReady(page, firstNodeId);
  const beforeSecond = await waitForNodeReady(page, secondNodeId);

  await page.getByRole("button", { name: "Rotate first" }).first().click();
  await shiftClickLayer(page, "Rotate second");
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([firstNodeId, secondNodeId]);

  const groupCenter = {
    x:
      (Math.min(beforeFirst.elementRect.left, beforeSecond.elementRect.left) +
        Math.max(
          beforeFirst.elementRect.right,
          beforeSecond.elementRect.right
        )) /
      2,
    y:
      (Math.min(beforeFirst.elementRect.top, beforeSecond.elementRect.top) +
        Math.max(
          beforeFirst.elementRect.bottom,
          beforeSecond.elementRect.bottom
        )) /
      2,
  };

  await rotateSelectionFromCorner(page);
  await pauseForUi(page);

  const afterFirst = await waitForNodeReady(page, firstNodeId);
  const afterSecond = await waitForNodeReady(page, secondNodeId);
  const rotationDelta = afterFirst.rotation - beforeFirst.rotation;

  const expectedFirstCenter = rotatePointAround(
    getRectCenter(beforeFirst.elementRect),
    groupCenter,
    rotationDelta
  );
  const expectedSecondCenter = rotatePointAround(
    getRectCenter(beforeSecond.elementRect),
    groupCenter,
    rotationDelta
  );
  const afterFirstCenter = getRectCenter(afterFirst.elementRect);
  const afterSecondCenter = getRectCenter(afterSecond.elementRect);

  expect(Math.abs(rotationDelta)).toBeGreaterThan(5);
  expect(afterSecond.rotation - beforeSecond.rotation).toBeCloseTo(
    rotationDelta,
    1
  );
  expect(afterFirstCenter.x).toBeCloseTo(expectedFirstCenter.x, 1);
  expect(afterFirstCenter.y).toBeCloseTo(expectedFirstCenter.y, 1);
  expect(afterSecondCenter.x).toBeCloseTo(expectedSecondCenter.x, 1);
  expect(afterSecondCenter.y).toBeCloseTo(expectedSecondCenter.y, 1);
});

test("group rotation preview matches the live node bounds through release", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-rotate-group.punch");
  const firstNodeId = "rotate-first-node";
  const secondNodeId = "rotate-second-node";

  await waitForNodeReady(page, firstNodeId);
  await waitForNodeReady(page, secondNodeId);
  await zoomOut(page, 5);
  await pauseForUi(page);

  await page.getByRole("button", { name: "Rotate first" }).first().click();
  await shiftClickLayer(page, "Rotate second");
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([firstNodeId, secondNodeId]);

  await rotateSelectionFromCornerWithoutRelease(page);

  await expect
    .poll(async () => Boolean(await getGroupRotationPreviewRect(page)))
    .toBe(true);

  const previewRect = await getGroupRotationPreviewRect(page);

  await page.mouse.up();
  await pauseForUi(page);

  const afterFirst = await waitForNodeReady(page, firstNodeId);
  const afterSecond = await waitForNodeReady(page, secondNodeId);
  const combinedRect = getCombinedRect(
    afterFirst.elementRect,
    afterSecond.elementRect
  );

  expectRectsClose(previewRect, combinedRect);
});
