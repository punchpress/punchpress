import { expect, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
  shiftClickLayer,
  waitForNodeReady,
} from "./helpers/editor";

const installRenderCounterSink = async (page) => {
  await page.evaluate(() => {
    window.__TEST_RENDER_COUNTERS__ = {};
    window.__PUNCHPRESS_PERF_SINK__ = {
      incrementCounter(name, amount = 1) {
        const counters = window.__TEST_RENDER_COUNTERS__;
        counters[name] = (counters[name] || 0) + amount;
      },
      recordDuration() {
        // Duration samples are irrelevant for these render-path assertions.
      },
    };
  });
};

const resetRenderCounter = async (page, counterName) => {
  await page.evaluate((name) => {
    window.__TEST_RENDER_COUNTERS__[name] = 0;
  }, counterName);
};

const getRenderCounter = async (page, counterName) => {
  return await page.evaluate((name) => {
    return window.__TEST_RENDER_COUNTERS__[name] || 0;
  }, counterName);
};

const getDebugNode = async (page, nodeId) => {
  return await page.evaluate((targetNodeId) => {
    return (
      window.__PUNCHPRESS_EDITOR__
        ?.getDebugDump()
        ?.nodes.find((node) => node.id === targetNodeId) || null
    );
  }, nodeId);
};

const isNear = (left, right, tolerance = 2) => {
  return Math.abs(left - right) <= tolerance;
};

test("single-node drag keeps the node wrapper off the render path through drop", async ({
  page,
}) => {
  await gotoEditor(page);
  await installRenderCounterSink(page);
  await loadDocumentFixture(page, "text-node-move.punch");
  const nodeId = "move-node";

  await page.locator(`[data-node-id="${nodeId}"]`).click();
  await pauseForUi(page);
  await waitForNodeReady(page, nodeId);
  await resetRenderCounter(page, "render.canvas.node");

  const beforeNode = await getDebugNode(page, nodeId);
  const beforeRect = beforeNode?.elementRect;

  await page.mouse.move(
    beforeRect.x + beforeRect.width / 2,
    beforeRect.y + beforeRect.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    beforeRect.x + beforeRect.width / 2 + 140,
    beforeRect.y + beforeRect.height / 2 + 80,
    { steps: 12 }
  );

  await expect
    .poll(async () => {
      const currentNode = await getDebugNode(page, nodeId);
      const renderCount = await getRenderCounter(page, "render.canvas.node");

      return (
        renderCount === 0 &&
        isNear(currentNode.elementRect.x - beforeRect.x, 140) &&
        isNear(currentNode.elementRect.y - beforeRect.y, 80) &&
        currentNode.transform.x === beforeNode.transform.x &&
        currentNode.transform.y === beforeNode.transform.y
      );
    })
    .toBe(true);

  await page.mouse.up();

  await expect
    .poll(async () => {
      const currentNode = await getDebugNode(page, nodeId);
      const renderCount = await getRenderCounter(page, "render.canvas.node");

      return (
        renderCount === 0 &&
        isNear(currentNode.transform.x - beforeNode.transform.x, 140) &&
        isNear(currentNode.transform.y - beforeNode.transform.y, 80)
      );
    })
    .toBe(true);
});

test("multiselect drag keeps node wrappers off the render path through drop", async ({
  page,
}) => {
  await gotoEditor(page);
  await installRenderCounterSink(page);
  await loadDocumentFixture(page, "text-node-rotate-group.punch");

  await page.getByRole("button", { name: "Rotate first" }).first().click();
  await shiftClickLayer(page, "Rotate second");
  await pauseForUi(page);
  await waitForNodeReady(page, "rotate-first-node");
  await waitForNodeReady(page, "rotate-second-node");
  await resetRenderCounter(page, "render.canvas.node");

  const beforeFirst = await getDebugNode(page, "rotate-first-node");
  const beforeSecond = await getDebugNode(page, "rotate-second-node");

  await page.mouse.move(
    beforeFirst.elementRect.x + beforeFirst.elementRect.width / 2,
    beforeFirst.elementRect.y + beforeFirst.elementRect.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    beforeFirst.elementRect.x + beforeFirst.elementRect.width / 2 + 140,
    beforeFirst.elementRect.y + beforeFirst.elementRect.height / 2 + 80,
    { steps: 12 }
  );

  await expect
    .poll(async () => {
      const firstNode = await getDebugNode(page, "rotate-first-node");
      const secondNode = await getDebugNode(page, "rotate-second-node");
      const renderCount = await getRenderCounter(page, "render.canvas.node");

      return (
        renderCount === 0 &&
        isNear(firstNode.elementRect.x - beforeFirst.elementRect.x, 140) &&
        isNear(firstNode.elementRect.y - beforeFirst.elementRect.y, 80) &&
        isNear(secondNode.elementRect.x - beforeSecond.elementRect.x, 140) &&
        isNear(secondNode.elementRect.y - beforeSecond.elementRect.y, 80) &&
        firstNode.transform.x === beforeFirst.transform.x &&
        firstNode.transform.y === beforeFirst.transform.y &&
        secondNode.transform.x === beforeSecond.transform.x &&
        secondNode.transform.y === beforeSecond.transform.y
      );
    })
    .toBe(true);

  await page.mouse.up();

  await expect
    .poll(async () => {
      const firstNode = await getDebugNode(page, "rotate-first-node");
      const secondNode = await getDebugNode(page, "rotate-second-node");
      const renderCount = await getRenderCounter(page, "render.canvas.node");

      return (
        renderCount === 0 &&
        isNear(firstNode.transform.x - beforeFirst.transform.x, 140) &&
        isNear(firstNode.transform.y - beforeFirst.transform.y, 80) &&
        isNear(secondNode.transform.x - beforeSecond.transform.x, 140) &&
        isNear(secondNode.transform.y - beforeSecond.transform.y, 80)
      );
    })
    .toBe(true);
});
