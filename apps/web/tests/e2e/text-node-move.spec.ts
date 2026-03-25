import { expect, test } from "@playwright/test";
import {
  dragNodeBy,
  expectCoordinateShift,
  expectRectShift,
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
  shiftClickLayer,
  waitForNodeReady,
  zoomOut,
} from "./helpers/editor";

const getMoveableHandleCenters = (page, rootSelector) => {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);

    if (!root) {
      return null;
    }

    const controlBox =
      [root, ...root.querySelectorAll(".moveable-control-box")]
        .filter((element) => element.classList.contains("moveable-control-box"))
        .map((element) => ({
          area:
            element.getBoundingClientRect().width *
            element.getBoundingClientRect().height,
          element,
        }))
        .sort((left, right) => right.area - left.area)[0]?.element || null;

    if (!controlBox) {
      return null;
    }

    return Object.fromEntries(
      ["nw", "ne", "sw", "se"].map((corner) => {
        const handle = controlBox.querySelector(
          `.moveable-control.moveable-${corner}`
        );
        const rect = handle?.getBoundingClientRect?.();

        if (!rect) {
          return [corner, null];
        }

        return [
          corner,
          {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
          },
        ];
      })
    );
  }, rootSelector);
};

const expectHandleCentersToShift = (beforeHandles, afterHandles, delta) => {
  return ["nw", "ne", "sw", "se"].every((corner) => {
    const beforeHandle = beforeHandles?.[corner];
    const afterHandle = afterHandles?.[corner];

    if (!(beforeHandle && afterHandle)) {
      return false;
    }

    return (
      Math.abs(afterHandle.x - beforeHandle.x - delta.x) <= 8 &&
      Math.abs(afterHandle.y - beforeHandle.y - delta.y) <= 8
    );
  });
};

const getRectCenter = (rect) => {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
};

const getCombinedRect = (...rects) => {
  const definedRects = rects.filter(Boolean);

  if (definedRects.length === 0) {
    return null;
  }

  const left = Math.min(...definedRects.map((rect) => rect.left));
  const top = Math.min(...definedRects.map((rect) => rect.top));
  const right = Math.max(...definedRects.map((rect) => rect.right));
  const bottom = Math.max(...definedRects.map((rect) => rect.bottom));

  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
    x: left,
    y: top,
  };
};

const expectPreviewHandlesAlignedToRect = (handles, rect, tolerance = 10) => {
  if (!(handles?.nw && handles?.ne && handles?.sw && handles?.se && rect)) {
    return false;
  }

  const expectedHandles = {
    ne: { x: rect.right, y: rect.top },
    nw: { x: rect.left, y: rect.top },
    se: { x: rect.right, y: rect.bottom },
    sw: { x: rect.left, y: rect.bottom },
  };

  return ["nw", "ne", "sw", "se"].every((corner) => {
    return (
      Math.abs(handles[corner].x - expectedHandles[corner].x) <= tolerance &&
      Math.abs(handles[corner].y - expectedHandles[corner].y) <= tolerance
    );
  });
};

const expectRectShiftMatchesDelta = (
  beforeRect,
  afterRect,
  delta,
  tolerance
) => {
  if (!(beforeRect && afterRect)) {
    return false;
  }

  return (
    Math.abs(afterRect.x - beforeRect.x - delta.x) <= tolerance &&
    Math.abs(afterRect.y - beforeRect.y - delta.y) <= tolerance
  );
};

test("moves a text node around the canvas", async ({ page }) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-move.punch");
  const nodeId = "move-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();

  const before = await waitForNodeReady(page, nodeId);
  await pauseForUi(page);

  await dragNodeBy(page, nodeId, { x: 140, y: 80 });
  await pauseForUi(page);

  const after = await waitForNodeReady(page, nodeId);

  expectCoordinateShift(before, after, { x: 140, y: 80 });
  expectRectShift(before.elementRect, after.elementRect, { x: 140, y: 80 });
});

test("keeps the selection preview aligned while dragging a text node", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-move.punch");
  const nodeId = "move-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();

  const before = await waitForNodeReady(page, nodeId);
  const beforeHandles = await getMoveableHandleCenters(
    page,
    ".moveable-control-box.canvas-moveable"
  );

  await page.mouse.move(
    before.elementRect.x + before.elementRect.width / 2,
    before.elementRect.y + before.elementRect.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    before.elementRect.x + before.elementRect.width / 2 + 140,
    before.elementRect.y + before.elementRect.height / 2 + 80,
    { steps: 12 }
  );

  await expect
    .poll(async () => {
      const previewHandles = await getMoveableHandleCenters(
        page,
        ".canvas-selection-drag-preview"
      );

      return expectHandleCentersToShift(beforeHandles, previewHandles, {
        x: 140,
        y: 80,
      });
    })
    .toBe(true);

  await page.mouse.up();
  await pauseForUi(page);
});

test("keeps the selection preview aligned with a text node while zoomed out", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-move.punch");
  const nodeId = "move-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();
  await zoomOut(page, 5);
  await pauseForUi(page);

  const before = await waitForNodeReady(page, nodeId);
  const beforeCenter = getRectCenter(before.elementRect);

  await page.mouse.move(beforeCenter.x, beforeCenter.y);
  await page.mouse.down();
  await page.mouse.move(beforeCenter.x + 140, beforeCenter.y + 80, {
    steps: 12,
  });

  await expect
    .poll(async () => {
      const previewHandles = await getMoveableHandleCenters(
        page,
        ".canvas-selection-drag-preview"
      );
      const node = await waitForNodeReady(page, nodeId);

      return (
        expectPreviewHandlesAlignedToRect(
          previewHandles,
          node?.elementRect || null
        ) &&
        expectRectShiftMatchesDelta(
          before.elementRect,
          node?.elementRect || null,
          { x: 140, y: 80 },
          10
        )
      );
    })
    .toBe(true);

  await page.mouse.up();
  await pauseForUi(page);
});

test("keeps a rotated selection preview aligned while dragging a text node", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "scaled-text-node.punch");
  const nodeId = "scaled-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();

  const before = await waitForNodeReady(page, nodeId);
  const beforeHandles = await getMoveableHandleCenters(
    page,
    ".moveable-control-box.canvas-moveable"
  );

  await page.mouse.move(
    before.elementRect.x + before.elementRect.width / 2,
    before.elementRect.y + before.elementRect.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    before.elementRect.x + before.elementRect.width / 2 + 140,
    before.elementRect.y + before.elementRect.height / 2 + 80,
    { steps: 12 }
  );

  await expect
    .poll(async () => {
      const previewHandles = await getMoveableHandleCenters(
        page,
        ".canvas-selection-drag-preview"
      );

      return expectHandleCentersToShift(beforeHandles, previewHandles, {
        x: 140,
        y: 80,
      });
    })
    .toBe(true);

  await page.mouse.up();
  await pauseForUi(page);
});

test("keeps a rotated multiselect preview aligned while dragging text nodes", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-rotated-multiselect.punch");

  await page.getByRole("button", { name: "Rotate first" }).first().click();
  await shiftClickLayer(page, "Rotate second");

  const before = await waitForNodeReady(page, "rotate-first-node");
  const beforeHandles = await getMoveableHandleCenters(
    page,
    ".moveable-control-box.canvas-moveable"
  );

  expect(Math.abs(beforeHandles.nw.y - beforeHandles.ne.y)).toBeGreaterThan(8);
  expect(Math.abs(beforeHandles.nw.x - beforeHandles.sw.x)).toBeGreaterThan(8);

  await page.mouse.move(
    before.elementRect.x + before.elementRect.width / 2,
    before.elementRect.y + before.elementRect.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    before.elementRect.x + before.elementRect.width / 2 + 140,
    before.elementRect.y + before.elementRect.height / 2 + 80,
    { steps: 12 }
  );

  await expect
    .poll(async () => {
      const previewHandles = await getMoveableHandleCenters(
        page,
        ".canvas-selection-drag-preview"
      );

      return expectHandleCentersToShift(beforeHandles, previewHandles, {
        x: 140,
        y: 80,
      });
    })
    .toBe(true);

  await page.mouse.up();
  await pauseForUi(page);
});

test("keeps a multiselect preview aligned with the selected nodes while zoomed out", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-rotate-group.punch");

  await page.getByRole("button", { name: "Rotate first" }).first().click();
  await shiftClickLayer(page, "Rotate second");
  await zoomOut(page, 5);
  await pauseForUi(page);

  const firstBefore = await waitForNodeReady(page, "rotate-first-node");
  const secondBefore = await waitForNodeReady(page, "rotate-second-node");
  const beforeCombinedRect = getCombinedRect(
    firstBefore.elementRect,
    secondBefore.elementRect
  );
  const startCenter = getRectCenter(firstBefore.elementRect);

  await page.mouse.move(startCenter.x, startCenter.y);
  await page.mouse.down();
  await page.mouse.move(startCenter.x + 140, startCenter.y + 80, {
    steps: 12,
  });

  await expect
    .poll(async () => {
      const previewHandles = await getMoveableHandleCenters(
        page,
        ".canvas-selection-drag-preview"
      );
      const firstNode = await waitForNodeReady(page, "rotate-first-node");
      const secondNode = await waitForNodeReady(page, "rotate-second-node");
      const combinedRect = getCombinedRect(
        firstNode?.elementRect,
        secondNode?.elementRect
      );

      return (
        expectPreviewHandlesAlignedToRect(previewHandles, combinedRect) &&
        expectRectShiftMatchesDelta(
          beforeCombinedRect,
          combinedRect,
          { x: 140, y: 80 },
          10
        )
      );
    })
    .toBe(true);

  await page.mouse.up();
  await pauseForUi(page);
});
