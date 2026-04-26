import { expect, test } from "@playwright/test";
import { clickNodeCenter } from "./helpers/canvas";
import {
  getSelectionSnapshot,
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
  rotateSelectionFromCorner,
  rotateSelectionFromCornerWithoutRelease,
  shiftClickLayer,
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

const getHandleRect = (handles) => {
  const corners = ["nw", "ne", "sw", "se"]
    .map((corner) => handles?.[corner])
    .filter(Boolean);

  if (corners.length === 0) {
    return null;
  }

  const centers = corners.map((handle) => ({
    x: handle.x + handle.width / 2,
    y: handle.y + handle.height / 2,
  }));

  const left = Math.min(...centers.map((point) => point.x));
  const top = Math.min(...centers.map((point) => point.y));
  const right = Math.max(...centers.map((point) => point.x));
  const bottom = Math.max(...centers.map((point) => point.y));

  return {
    bottom,
    left,
    right,
    top,
  };
};

const getSingleNodeOverlayCorners = (page) => {
  return page.evaluate(() => {
    const root = document.querySelector(".canvas-single-selection");

    if (!(root instanceof HTMLElement)) {
      return null;
    }

    const offsetParent =
      root.offsetParent instanceof HTMLElement ? root.offsetParent : null;
    const parentRect = offsetParent?.getBoundingClientRect?.();
    const transform = window.getComputedStyle(root).transform;
    const transformOrigin = window.getComputedStyle(root).transformOrigin;

    if (!(parentRect && transformOrigin)) {
      return null;
    }

    const matrix =
      transform && transform !== "none"
        ? new DOMMatrixReadOnly(transform)
        : new DOMMatrixReadOnly();
    const [originXToken, originYToken] = transformOrigin.split(" ");
    const originX = Number.parseFloat(originXToken);
    const originY = Number.parseFloat(originYToken);
    const baseLeft = parentRect.left + root.offsetLeft;
    const baseTop = parentRect.top + root.offsetTop;
    const width = root.offsetWidth;
    const height = root.offsetHeight;

    const projectCorner = (x, y) => {
      const localX = x - originX;
      const localY = y - originY;

      return {
        x:
          baseLeft + originX + matrix.a * localX + matrix.c * localY + matrix.e,
        y: baseTop + originY + matrix.b * localX + matrix.d * localY + matrix.f,
      };
    };

    const getHandleCenter = (corner) => {
      const handle = root.querySelector(`.moveable-control.moveable-${corner}`);
      const rect = handle?.getBoundingClientRect?.();

      if (!rect) {
        return null;
      }

      return {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      };
    };

    return {
      handles: {
        ne: getHandleCenter("ne"),
        nw: getHandleCenter("nw"),
        se: getHandleCenter("se"),
        sw: getHandleCenter("sw"),
      },
      corners: {
        ne: projectCorner(width, 0),
        nw: projectCorner(0, 0),
        se: projectCorner(width, height),
        sw: projectCorner(0, height),
      },
    };
  });
};

const startSelectionHandleAngleCapture = (page) => {
  return page.evaluate(() => {
    window.__selectionAngleCaptureActive = true;
    window.__selectionAngleCaptureSamples = [];

    const getHandleCenter = (corner) => {
      const rect = window.__PUNCHPRESS_EDITOR__?.hostRef
        ?.querySelector(`.canvas-moveable .moveable-control.moveable-${corner}`)
        ?.getBoundingClientRect?.();

      if (!rect) {
        return null;
      }

      return {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      };
    };

    const sample = () => {
      const nw = getHandleCenter("nw");
      const ne = getHandleCenter("ne");
      const angle =
        nw && ne
          ? (Math.atan2(ne.y - nw.y, ne.x - nw.x) * 180) / Math.PI
          : null;

      window.__selectionAngleCaptureSamples.push({
        angle,
        timestamp: performance.now(),
      });

      if (window.__selectionAngleCaptureActive) {
        window.requestAnimationFrame(sample);
      }
    };

    window.requestAnimationFrame(sample);
  });
};

const stopSelectionHandleAngleCapture = (page) => {
  return page.evaluate(() => {
    window.__selectionAngleCaptureActive = false;
    return window.__selectionAngleCaptureSamples || [];
  });
};

const rotateSelectionSlowlyWithoutRelease = async (
  page,
  { corner = "nw", drag = { x: 120, y: 80 }, offset = 20, steps = 24 } = {}
) => {
  const selection = await waitForSelectionHandles(page);
  const handle = selection.handles[corner];

  if (!handle) {
    throw new Error(`Missing ${corner} selection handle for slow rotation`);
  }

  const start = {
    x: handle.x + handle.width / 2 + (corner.endsWith("e") ? offset : -offset),
    y:
      handle.y +
      handle.height / 2 +
      (corner.startsWith("s") ? offset : -offset),
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();

  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;

    await page.mouse.move(
      start.x + drag.x * progress,
      start.y + drag.y * progress
    );
    await page.waitForTimeout(16);
  }
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

test("keeps single-node handles centered on the overlay corners", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "scaled-text-node.punch");
  const nodeId = "scaled-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();
  await pauseForUi(page);
  await waitForSelectionHandles(page);

  const snapshot = await getSingleNodeOverlayCorners(page);

  expect(snapshot).not.toBeNull();

  for (const corner of ["nw", "ne", "sw", "se"]) {
    const handle = snapshot?.handles?.[corner];
    const overlayCorner = snapshot?.corners?.[corner];

    expect(handle).not.toBeNull();
    expect(overlayCorner).not.toBeNull();
    expect(Math.abs((handle?.x || 0) - (overlayCorner?.x || 0))).toBeLessThan(
      4
    );
    expect(Math.abs((handle?.y || 0) - (overlayCorner?.y || 0))).toBeLessThan(
      4
    );
  }
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

test("rotating an actual group keeps a stable rotated selection box", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "group-basic.punch");
  await zoomOut(page, 5);
  await pauseForUi(page);

  const firstNodeId = "basic-group-first-node";
  const groupNodeId = "basic-group-node";
  const secondNodeId = "basic-group-second-node";

  await waitForNodeReady(page, firstNodeId);
  await waitForNodeReady(page, secondNodeId);
  await clickNodeCenter(page, firstNodeId);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([groupNodeId]);

  await startSelectionHandleAngleCapture(page);
  await rotateSelectionSlowlyWithoutRelease(page, {
    drag: { x: 220, y: 160 },
    steps: 32,
  });
  const angleSamples = await stopSelectionHandleAngleCapture(page);
  const liveRotation = await page.evaluate((nodeId) => {
    const node = window.__PUNCHPRESS_EDITOR__
      ?.getDebugDump()
      ?.nodes.find((item) => item.id === nodeId);

    return node?.rotation ?? null;
  }, firstNodeId);

  await page.mouse.up();

  const firstRotatedSampleIndex = angleSamples.findIndex((sample) => {
    return typeof sample.angle === "number" && Math.abs(sample.angle) > 8;
  });

  expect(Math.abs(liveRotation || 0)).toBeGreaterThan(8);
  expect(firstRotatedSampleIndex).toBeGreaterThanOrEqual(0);

  const uprightSamplesAfterRotation = angleSamples
    .slice(firstRotatedSampleIndex)
    .filter((sample) => typeof sample.angle === "number")
    .filter((sample) => Math.abs(sample.angle) < 4);

  expect(uprightSamplesAfterRotation).toEqual([]);
});

test("group rotation overlay stays stable through release", async ({
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
  const beforeReleaseSelection = await waitForSelectionHandles(page);

  await page.mouse.up();
  await pauseForUi(page);

  const afterFirst = await waitForNodeReady(page, firstNodeId);
  const afterSecond = await waitForNodeReady(page, secondNodeId);
  const afterReleaseSelection = await waitForSelectionHandles(page);
  const beforeReleaseRect = getHandleRect(beforeReleaseSelection.handles);
  const afterReleaseRect = getHandleRect(afterReleaseSelection.handles);

  expect(afterFirst.elementRect).not.toBeNull();
  expect(afterSecond.elementRect).not.toBeNull();
  expectRectsClose(beforeReleaseRect, afterReleaseRect);
});
