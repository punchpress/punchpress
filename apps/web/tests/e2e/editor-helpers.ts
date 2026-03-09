import { expect } from "@playwright/test";

const stepDelayMs = process.env.CI ? 0 : 450;

export const gotoEditor = async (page) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Text (T)" })).toBeVisible();
};

export const pauseForUi = async (page, duration = stepDelayMs) => {
  if (duration <= 0) {
    return;
  }

  await page.waitForTimeout(duration);
};

export const createTextNode = (page, options) => {
  return page.evaluate((nextOptions) => {
    return (
      window as Window & {
        __PUNCHPRESS_E2E__: {
          createTextNode: (options?: Record<string, unknown>) => string;
          moveSelectedNodeBy: (delta?: {
            x?: number;
            y?: number;
          }) => string | null;
          scaleSelectedGroupBy: (options?: {
            corner?: "ne" | "nw" | "se" | "sw";
            scale?: number;
          }) => string[];
          scaleSelectedNodeBy: (options?: { scale?: number }) => string | null;
        };
      }
    ).__PUNCHPRESS_E2E__.createTextNode(nextOptions);
  }, options);
};

export const getNodeSnapshot = (page, nodeId) => {
  return page.evaluate((nextNodeId) => {
    return (
      window as Window & {
        __PUNCHPRESS_E2E__?: {
          getNodeSnapshot: (nodeId: string) => Record<string, unknown> | null;
        };
      }
    ).__PUNCHPRESS_E2E__?.getNodeSnapshot(nextNodeId);
  }, nodeId);
};

export const getSelectionSnapshot = (page) => {
  return page.evaluate(() => {
    return (
      window as Window & {
        __PUNCHPRESS_E2E__?: {
          getSelectionSnapshot: () => Record<string, unknown>;
        };
      }
    ).__PUNCHPRESS_E2E__?.getSelectionSnapshot();
  });
};

export const getStateSnapshot = (page) => {
  return page.evaluate(() => {
    return (
      window as Window & {
        __PUNCHPRESS_E2E__?: {
          getStateSnapshot: () => Record<string, unknown>;
        };
      }
    ).__PUNCHPRESS_E2E__?.getStateSnapshot();
  });
};

export const getCanvasNodeIds = (page) => {
  return page.locator("[data-node-id]").evaluateAll((elements) => {
    return elements
      .map((element) => element.getAttribute("data-node-id"))
      .filter(Boolean);
  });
};

export const moveSelectedNodeBy = (page, delta) => {
  return page.evaluate((nextDelta) => {
    return (
      window as Window & {
        __PUNCHPRESS_E2E__?: {
          moveSelectedNodeBy: (delta?: {
            x?: number;
            y?: number;
          }) => string | null;
        };
      }
    ).__PUNCHPRESS_E2E__?.moveSelectedNodeBy(nextDelta);
  }, delta);
};

export const scaleSelectedNodeBy = (page, options) => {
  return page.evaluate((nextOptions) => {
    return (
      window as Window & {
        __PUNCHPRESS_E2E__?: {
          scaleSelectedNodeBy: (options?: { scale?: number }) => string | null;
        };
      }
    ).__PUNCHPRESS_E2E__?.scaleSelectedNodeBy(nextOptions);
  }, options);
};

export const scaleSelectedGroupBy = (page, options) => {
  return page.evaluate((nextOptions) => {
    return (
      window as Window & {
        __PUNCHPRESS_E2E__?: {
          scaleSelectedGroupBy: (options?: {
            corner?: "ne" | "nw" | "se" | "sw";
            scale?: number;
          }) => string[];
        };
      }
    ).__PUNCHPRESS_E2E__?.scaleSelectedGroupBy(nextOptions);
  }, options);
};

export const dragLayerBelow = async (page, sourceLabel, targetLabel) => {
  const source = page.getByRole("button", { name: sourceLabel }).first();
  const target = page.getByRole("button", { name: targetLabel }).first();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!(sourceBox && targetBox)) {
    throw new Error("Missing layer row bounds for drag reorder");
  }

  const sourceX = sourceBox.x + Math.min(36, sourceBox.width / 2);
  const sourceY = sourceBox.y + sourceBox.height / 2;
  const targetX = targetBox.x + Math.min(36, targetBox.width / 2);
  const targetY = targetBox.y + targetBox.height * 0.8;

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.mouse.move(sourceX, sourceY + 12, { steps: 4 });
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await page.mouse.up();
};

export const marqueeSelect = async (page, from, to) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
};

export const shiftClickLayer = async (page, label) => {
  await page.keyboard.down("Shift");
  await page.getByRole("button", { name: label }).first().click();
  await page.keyboard.up("Shift");
};

export const waitForNodeReady = async (page, nodeId) => {
  await expect
    .poll(async () => {
      const snapshot = await getNodeSnapshot(page, nodeId);
      if (!(snapshot?.ready && snapshot.elementRect)) {
        return null;
      }

      return snapshot;
    })
    .not.toBeNull();

  return getNodeSnapshot(page, nodeId);
};

export const waitForSelectionHandles = async (page) => {
  await expect
    .poll(async () => {
      const selection = await getSelectionSnapshot(page);
      return Boolean(selection.handles.nw && selection.handles.se);
    })
    .toBe(true);

  return getSelectionSnapshot(page);
};

export const zoomIn = async (page, times = 1) => {
  for (let index = 0; index < times; index += 1) {
    await page.getByRole("button", { name: "Zoom in" }).click();
  }
};

export const expectRectShift = (
  beforeRect,
  afterRect,
  delta,
  tolerance = 6
) => {
  expect(Math.abs(afterRect.x - beforeRect.x - delta.x)).toBeLessThanOrEqual(
    tolerance
  );
  expect(Math.abs(afterRect.y - beforeRect.y - delta.y)).toBeLessThanOrEqual(
    tolerance
  );
};

export const expectCoordinateShift = (before, after, delta, tolerance = 6) => {
  expect(Math.abs(after.x - before.x - delta.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(after.y - before.y - delta.y)).toBeLessThanOrEqual(tolerance);
};

export const expectHandleAlignedToNodeCorner = (
  handleRect,
  nodeRect,
  corner,
  tolerance = 14
) => {
  const handleCenterX = handleRect.x + handleRect.width / 2;
  const handleCenterY = handleRect.y + handleRect.height / 2;

  const expectedX = corner.endsWith("e") ? nodeRect.right : nodeRect.left;
  const expectedY = corner.startsWith("s") ? nodeRect.bottom : nodeRect.top;

  expect(Math.abs(handleCenterX - expectedX)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(handleCenterY - expectedY)).toBeLessThanOrEqual(tolerance);
};
