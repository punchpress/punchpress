import { expect, test } from "@playwright/test";
import {
  createTextNode,
  getGroupRotationPreviewRect,
  getSelectionSnapshot,
  gotoEditor,
  pauseForUi,
  rotateSelectionFromCorner,
  rotateSelectionFromCornerWithoutRelease,
  scaleSelectedGroupBy,
  scaleSelectedNodeBy,
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

const getNodeCorner = (snapshot, corner) => {
  const center = {
    x: (snapshot.bbox.minX + snapshot.bbox.maxX) / 2,
    y: (snapshot.bbox.minY + snapshot.bbox.maxY) / 2,
  };
  const point = {
    x: corner.endsWith("e") ? snapshot.bbox.maxX : snapshot.bbox.minX,
    y: corner.startsWith("s") ? snapshot.bbox.maxY : snapshot.bbox.minY,
  };
  const rotatedOffset = rotatePointAround(
    {
      x: point.x - center.x,
      y: point.y - center.y,
    },
    { x: 0, y: 0 },
    snapshot.rotation
  );

  return {
    x: snapshot.x + center.x + rotatedOffset.x,
    y: snapshot.y + center.y + rotatedOffset.y,
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

  const nodeId = await createTextNode(page, {
    text: "Rotate me",
    x: 600,
    y: 450,
  });

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

test("resizes a rotated text node from the opposite corner anchor", async ({
  page,
}) => {
  await gotoEditor(page);

  const nodeId = await createTextNode(page, {
    text: "Resize rotate",
    x: 620,
    y: 420,
  });

  await waitForNodeReady(page, nodeId);
  await zoomOut(page, 5);
  await pauseForUi(page);

  await rotateSelectionFromCorner(page);
  await pauseForUi(page);

  const beforeResize = await waitForNodeReady(page, nodeId);
  const fixedCornerBefore = getNodeCorner(beforeResize, "nw");

  await scaleSelectedNodeBy(page, { scale: 1.25 });
  await pauseForUi(page);

  const afterResize = await waitForNodeReady(page, nodeId);
  const fixedCornerAfter = getNodeCorner(afterResize, "nw");

  expect(afterResize.fontSize).toBeGreaterThan(beforeResize.fontSize);
  expect(afterResize.rotation).toBeCloseTo(beforeResize.rotation, 1);
  expect(fixedCornerAfter.x).toBeCloseTo(fixedCornerBefore.x, 1);
  expect(fixedCornerAfter.y).toBeCloseTo(fixedCornerBefore.y, 1);
});

test("rotates a selected group of text nodes around the shared selection center", async ({
  page,
}) => {
  await gotoEditor(page);

  const firstNodeId = await createTextNode(page, {
    text: "Rotate first",
    x: 520,
    y: 320,
  });
  const secondNodeId = await createTextNode(page, {
    text: "Rotate second",
    x: 760,
    y: 520,
  });

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

  const firstNodeId = await createTextNode(page, {
    text: "Preview first",
    x: 520,
    y: 320,
  });
  const secondNodeId = await createTextNode(page, {
    text: "Preview second",
    x: 760,
    y: 520,
  });

  await waitForNodeReady(page, firstNodeId);
  await waitForNodeReady(page, secondNodeId);
  await zoomOut(page, 5);
  await pauseForUi(page);

  await page.getByRole("button", { name: "Preview first" }).first().click();
  await shiftClickLayer(page, "Preview second");
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

test("resizes a rotated selection without shifting the fixed group anchor", async ({
  page,
}) => {
  await gotoEditor(page);

  const firstNodeId = await createTextNode(page, {
    text: "Scale first",
    x: 560,
    y: 320,
  });
  const secondNodeId = await createTextNode(page, {
    text: "Scale second",
    x: 780,
    y: 520,
  });

  await waitForNodeReady(page, firstNodeId);
  await waitForNodeReady(page, secondNodeId);
  await zoomOut(page, 5);
  await pauseForUi(page);

  const firstBefore = await waitForNodeReady(page, firstNodeId);
  const secondBefore = await waitForNodeReady(page, secondNodeId);

  await page.getByRole("button", { name: "Scale first" }).first().click();
  await shiftClickLayer(page, "Scale second");
  await pauseForUi(page);

  await rotateSelectionFromCorner(page);
  await pauseForUi(page);

  const rotatedFirst = await waitForNodeReady(page, firstNodeId);
  const rotatedSecond = await waitForNodeReady(page, secondNodeId);
  const beforeBounds = {
    bottom: Math.max(
      rotatedFirst.elementRect.bottom,
      rotatedSecond.elementRect.bottom
    ),
    left: Math.min(
      rotatedFirst.elementRect.left,
      rotatedSecond.elementRect.left
    ),
    right: Math.max(
      rotatedFirst.elementRect.right,
      rotatedSecond.elementRect.right
    ),
    top: Math.min(rotatedFirst.elementRect.top, rotatedSecond.elementRect.top),
  };

  await scaleSelectedGroupBy(page, { corner: "sw", scale: 1.2 });
  await pauseForUi(page);

  const scaledFirst = await waitForNodeReady(page, firstNodeId);
  const scaledSecond = await waitForNodeReady(page, secondNodeId);
  const afterBounds = {
    bottom: Math.max(
      scaledFirst.elementRect.bottom,
      scaledSecond.elementRect.bottom
    ),
    left: Math.min(scaledFirst.elementRect.left, scaledSecond.elementRect.left),
    right: Math.max(
      scaledFirst.elementRect.right,
      scaledSecond.elementRect.right
    ),
    top: Math.min(scaledFirst.elementRect.top, scaledSecond.elementRect.top),
  };

  expect(afterBounds.left).toBeLessThan(beforeBounds.left);
  expect(afterBounds.bottom).toBeGreaterThan(beforeBounds.bottom);
  expect(afterBounds.right).toBeCloseTo(beforeBounds.right, 1);
  expect(afterBounds.top).toBeCloseTo(beforeBounds.top, 1);
});
