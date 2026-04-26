import { expect, test } from "@playwright/test";
import {
  getHandleIconRotationDeg,
  getStateSnapshot,
  gotoEditor,
  pauseForUi,
} from "./helpers/editor";

const TEST_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
};

const loadArchDocument = async (page) => {
  await page.evaluate((font) => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return false;
    }

    editor.loadDocument(
      JSON.stringify({
        nodes: [
          {
            fill: "#000000",
            font,
            fontSize: 120,
            id: "arch-node",
            parentId: "root",
            stroke: null,
            strokeWidth: 0,
            text: "HEY",
            tracking: 0,
            transform: {
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              x: 380,
              y: 260,
            },
            type: "text",
            visible: true,
            warp: {
              bend: 0.4,
              kind: "arch",
            },
          },
        ],
        version: "1.7",
      })
    );

    return true;
  }, TEST_FONT);
};

test("edits arch bend from the on-canvas handle", async ({ page }) => {
  await gotoEditor(page);
  await loadArchDocument(page);
  await page.locator('.canvas-node[data-node-id="arch-node"]').click();
  await pauseForUi(page);

  await expect(page.getByRole("button", { name: "Edit path (E)" })).toHaveCount(
    0
  );

  const bendHandle = page.getByTestId("text-path-handle-bend");

  await expect(bendHandle).toBeVisible();

  const before = await getStateSnapshot(page);
  const handleBox = await bendHandle.boundingBox();
  const nodeBox = await page
    .locator('.canvas-node[data-node-id="arch-node"]')
    .boundingBox();
  const iconRotationDeg = await getHandleIconRotationDeg(bendHandle);

  expect(handleBox).not.toBeNull();

  if (!handleBox) {
    return;
  }

  expect(iconRotationDeg).toBe(-90);

  if (nodeBox) {
    expect(handleBox.x + handleBox.width / 2).toBeCloseTo(
      nodeBox.x + nodeBox.width / 2,
      1
    );
  }

  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2 - 80,
    {
      steps: 6,
    }
  );
  await page.mouse.up();
  await pauseForUi(page);

  const after = await getStateSnapshot(page);
  const beforeNode = before.nodes.find((node) => node.id === "arch-node");
  const afterNode = after.nodes.find((node) => node.id === "arch-node");

  expect(beforeNode?.warp?.kind).toBe("arch");
  expect(afterNode?.warp?.kind).toBe("arch");

  if (
    !(beforeNode?.warp?.kind === "arch" && afterNode?.warp?.kind === "arch")
  ) {
    return;
  }

  expect(afterNode.warp.bend).toBeLessThan(beforeNode.warp.bend);
});

test("moves an arch node by dragging the visible text with inline warp controls", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadArchDocument(page);

  const node = page.locator('.canvas-node[data-node-id="arch-node"]');

  await node.click();
  await pauseForUi(page);

  const before = await getStateSnapshot(page);
  const nodeBox = await node.boundingBox();

  expect(nodeBox).not.toBeNull();

  if (!nodeBox) {
    return;
  }

  const startX = nodeBox.x + nodeBox.width * 0.22;
  const startY = nodeBox.y + nodeBox.height * 0.72;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 40, { steps: 12 });
  await page.mouse.up();
  await pauseForUi(page);

  const after = await getStateSnapshot(page);
  const movedNode = after.nodes.find((entry) => entry.id === "arch-node");
  const beforeNode = before.nodes.find((entry) => entry.id === "arch-node");

  expect(movedNode?.x).toBeGreaterThan((beforeNode?.x || 0) + 50);
  expect(movedNode?.y).toBeGreaterThan((beforeNode?.y || 0) + 20);
});

test("dragging the arch handle downward moves the handle downward with the guide", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadArchDocument(page);
  await page.locator('.canvas-node[data-node-id="arch-node"]').click();
  await pauseForUi(page);

  const bendHandle = page.getByTestId("text-path-handle-bend");
  await expect(bendHandle).toBeVisible();

  const before = await getStateSnapshot(page);
  const beforeBox = await bendHandle.boundingBox();

  expect(beforeBox).not.toBeNull();

  if (!beforeBox) {
    return;
  }

  const startX = beforeBox.x + beforeBox.width / 2;
  const startY = beforeBox.y + beforeBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + 80, { steps: 6 });
  await page.mouse.up();
  await pauseForUi(page);

  const after = await getStateSnapshot(page);
  const afterBox = await bendHandle.boundingBox();
  const beforeNode = before.nodes.find((node) => node.id === "arch-node");
  const afterNode = after.nodes.find((node) => node.id === "arch-node");

  expect(afterBox).not.toBeNull();

  if (
    !(
      afterBox &&
      beforeNode?.warp?.kind === "arch" &&
      afterNode?.warp?.kind === "arch"
    )
  ) {
    return;
  }

  expect(afterNode.warp.bend).toBeGreaterThan(beforeNode.warp.bend);
  expect(afterBox.y + afterBox.height / 2).toBeGreaterThanOrEqual(
    beforeBox.y + beforeBox.height / 2 - 1
  );
});
