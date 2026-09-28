import { expect, test } from "@playwright/test";
import {
  getNodeSnapshot,
  getSelectionSnapshot,
  gotoEditor,
  loadDocumentFixture,
  waitForNodeReady,
} from "./helpers/editor";

const dragAfterPrewarm = async (
  page,
  locator,
  delta,
  startLocator = locator,
  followUpDeltas = []
) => {
  const box = await startLocator.boundingBox();

  if (!box) {
    throw new Error("Missing drag surface bounds");
  }

  const start = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.move(start.x + delta.x, start.y + delta.y);

  for (const followUpDelta of followUpDeltas) {
    await page.mouse.move(start.x + followUpDelta.x, start.y + followUpDelta.y);
  }

  await page.mouse.up();
};

const expectNoMove = async (page, nodeId, before) => {
  const after = await getNodeSnapshot(page, nodeId);

  expect(after?.x).toBeCloseTo(before.x, 1);
  expect(after?.y).toBeCloseTo(before.y, 1);
  expect(await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.canUndo)).toBe(
    false
  );
};

test("single-selection prewarm keeps sub-threshold motion inert", async ({
  page,
}, testInfo) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "shape-node-transform.punch");
  const nodeId = "shape-node";

  await page.locator(`.canvas-node[data-node-id="${nodeId}"]`).click();
  await expect(page.locator(".canvas-single-selection")).toBeVisible();
  await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.resetHistory());

  const before = await waitForNodeReady(page, nodeId);
  await page.screenshot({
    path: testInfo.outputPath("single-before.png"),
  });

  await dragAfterPrewarm(page, page.locator(".canvas-single-selection"), {
    x: 1,
    y: 0,
  });

  await expectNoMove(page, nodeId, before);
  await page.screenshot({
    path: testInfo.outputPath("single-after-sub-threshold.png"),
  });

  await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.resetHistory());
  const beforeDrag = await getNodeSnapshot(page, nodeId);

  await dragAfterPrewarm(page, page.locator(".canvas-single-selection"), {
    x: 4,
    y: 0,
  });

  const afterDrag = await getNodeSnapshot(page, nodeId);
  expect(afterDrag?.x).toBeCloseTo((beforeDrag?.x || 0) + 4, 1);
  expect(await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.canUndo)).toBe(
    true
  );
  await page.screenshot({
    path: testInfo.outputPath("single-after-qualifying-drag.png"),
  });

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    editor?.undo();
    editor?.resetHistory();
  });
  const beforeReturn = await getNodeSnapshot(page, nodeId);

  await dragAfterPrewarm(
    page,
    page.locator(".canvas-single-selection"),
    { x: 4, y: 0 },
    page.locator(".canvas-single-selection"),
    [
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]
  );

  const afterReturn = await getNodeSnapshot(page, nodeId);
  expect(afterReturn?.x).toBeCloseTo(beforeReturn?.x || 0, 1);
  expect(afterReturn?.y).toBeCloseTo(beforeReturn?.y || 0, 1);
  expect(await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.canUndo)).toBe(
    false
  );
  await page.screenshot({
    path: testInfo.outputPath("single-after-return-to-origin.png"),
  });
});

test("multi-selection prewarm keeps sub-threshold motion inert", async ({
  page,
}, testInfo) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "properties-panel-selection.punch");

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    editor?.select("text-node");
    editor?.toggleSelection("shape-node");
    editor?.resetHistory();
  });
  await expect(page.locator(".canvas-multi-selection")).toBeVisible();

  const beforeText = await waitForNodeReady(page, "text-node");
  const beforeShape = await waitForNodeReady(page, "shape-node");
  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual(["text-node", "shape-node"]);
  await page.screenshot({
    path: testInfo.outputPath("multi-before.png"),
  });

  const multiSelection = page.locator(".canvas-multi-selection");
  const selectedShape = page.locator('.canvas-node[data-node-id="shape-node"]');

  await dragAfterPrewarm(page, multiSelection, { x: 1, y: 0 }, selectedShape);

  await expectNoMove(page, "text-node", beforeText);
  await expectNoMove(page, "shape-node", beforeShape);
  await page.screenshot({
    path: testInfo.outputPath("multi-after-sub-threshold.png"),
  });

  await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.resetHistory());
  const beforeDragText = await getNodeSnapshot(page, "text-node");
  const beforeDragShape = await getNodeSnapshot(page, "shape-node");

  await dragAfterPrewarm(page, multiSelection, { x: 4, y: 0 }, selectedShape);

  const afterDragText = await getNodeSnapshot(page, "text-node");
  const afterDragShape = await getNodeSnapshot(page, "shape-node");
  expect(afterDragText?.x).toBeCloseTo((beforeDragText?.x || 0) + 4, 1);
  expect(afterDragShape?.x).toBeCloseTo((beforeDragShape?.x || 0) + 4, 1);
  expect(await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.canUndo)).toBe(
    true
  );
  await page.screenshot({
    path: testInfo.outputPath("multi-after-qualifying-drag.png"),
  });

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    editor?.undo();
    editor?.resetHistory();
  });
  const beforeReturnText = await getNodeSnapshot(page, "text-node");
  const beforeReturnShape = await getNodeSnapshot(page, "shape-node");

  await dragAfterPrewarm(page, multiSelection, { x: 4, y: 0 }, selectedShape, [
    { x: 1, y: 0 },
    { x: 0, y: 0 },
  ]);

  const afterReturnText = await getNodeSnapshot(page, "text-node");
  const afterReturnShape = await getNodeSnapshot(page, "shape-node");
  expect(afterReturnText?.x).toBeCloseTo(beforeReturnText?.x || 0, 1);
  expect(afterReturnShape?.x).toBeCloseTo(beforeReturnShape?.x || 0, 1);
  expect(await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.canUndo)).toBe(
    false
  );
  await page.screenshot({
    path: testInfo.outputPath("multi-after-return-to-origin.png"),
  });
});
