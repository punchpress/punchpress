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

const getActiveSelectionHandleCenters = (page) => {
  return page.evaluate(() => {
    const controlBox = document.querySelector(
      ".moveable-control-box.canvas-moveable"
    );

    if (!(controlBox instanceof Element)) {
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
  });
};

const isActiveSelectionBoxVisible = (page) => {
  return page.evaluate(() => {
    const controlBox = document.querySelector(
      ".canvas-moveable.moveable-control-box"
    );

    if (!(controlBox instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(controlBox);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number.parseFloat(style.opacity || "1") > 0.9
    );
  });
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

const samplePostDropSelectionFrames = (page, rootSelector, nodeId) => {
  return page.evaluate(
    async ({ nodeId, rootSelector }) => {
      const getHandleCenters = () => {
        const controlBox = document.querySelector(rootSelector);

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
      };

      const getNodeRect = () => {
        return document
          .querySelector(`[data-node-id="${nodeId}"]`)
          ?.getBoundingClientRect();
      };

      const samples = [{ handles: getHandleCenters(), rect: getNodeRect() }];

      for (let index = 0; index < 3; index += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        samples.push({ handles: getHandleCenters(), rect: getNodeRect() });
      }

      return samples;
    },
    { nodeId, rootSelector }
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

test("keeps the selection box aligned after dropping a newly created text node", async ({
  page,
}) => {
  await gotoEditor(page);

  await page.keyboard.press("t");
  await page.getByTestId("canvas-stage").click({
    position: { x: 400, y: 300 },
  });

  const textInput = page.getByTestId("canvas-text-input");
  await textInput.fill("Hello world");
  await textInput.press("Enter");
  await pauseForUi(page);

  const createdNode = page.locator("[data-node-id]").first();
  const createdNodeRect = await createdNode.boundingBox();

  expect(createdNodeRect).not.toBeNull();

  const deselectPoint = {
    x: (createdNodeRect?.x || 0) + (createdNodeRect?.width || 0) / 2,
    y: Math.max(140, (createdNodeRect?.y || 0) - 80),
  };

  await page.mouse.click(deselectPoint.x, deselectPoint.y);
  await pauseForUi(page);

  const node = createdNode;
  await node.click();

  const nodeId = await node.getAttribute("data-node-id");

  expect(nodeId).not.toBeNull();

  const before = await waitForNodeReady(page, nodeId);

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
  await page.mouse.up();

  const samples = await samplePostDropSelectionFrames(
    page,
    ".moveable-control-box.canvas-moveable",
    nodeId
  );

  expect(
    samples.every((sample) =>
      expectPreviewHandlesAlignedToRect(sample.handles, sample.rect)
    )
  ).toBe(true);
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
      const previewHandles = await getActiveSelectionHandleCenters(page);

      return (
        (await isActiveSelectionBoxVisible(page)) &&
        expectHandleCentersToShift(beforeHandles, previewHandles, {
          x: 140,
          y: 80,
        })
      );
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
      const previewHandles = await getActiveSelectionHandleCenters(page);
      const node = await waitForNodeReady(page, nodeId);

      return (
        (await isActiveSelectionBoxVisible(page)) &&
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
      const previewHandles = await getActiveSelectionHandleCenters(page);

      return (
        (await isActiveSelectionBoxVisible(page)) &&
        expectHandleCentersToShift(beforeHandles, previewHandles, {
          x: 140,
          y: 80,
        })
      );
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
      const previewHandles = await getActiveSelectionHandleCenters(page);

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
      const previewHandles = await getActiveSelectionHandleCenters(page);
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
