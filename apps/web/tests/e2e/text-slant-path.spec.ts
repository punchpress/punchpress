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

const loadSlantDocument = async (page, rotation = 0) => {
  await page.evaluate(
    ({ font, rotation }) => {
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
              id: "slant-node",
              parentId: "root",
              stroke: null,
              strokeWidth: 0,
              text: "SLANT",
              tracking: 0,
              transform: {
                rotation,
                scaleX: 1,
                scaleY: 1,
                x: 380,
                y: 260,
              },
              type: "text",
              visible: true,
              warp: {
                kind: "slant",
                rise: -120,
              },
            },
          ],
          version: "1.7",
        })
      );

      return true;
    },
    { font: TEST_FONT, rotation }
  );
};

test("applies slant from the panel with the default preset", async ({
  page,
}) => {
  await gotoEditor(page);
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
            id: "plain-text-node",
            parentId: "root",
            stroke: null,
            strokeWidth: 0,
            text: "PLAIN",
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
              kind: "none",
            },
          },
        ],
        version: "1.7",
      })
    );

    return true;
  }, TEST_FONT);

  await page.locator('.canvas-node[data-node-id="plain-text-node"]').click();
  await pauseForUi(page);
  await page.getByRole("button", { name: "Slant" }).click();
  await pauseForUi(page);

  await expect(page.getByRole("button", { name: "Edit path (E)" })).toHaveCount(
    0
  );
  await expect(page.getByTestId("text-path-handle-slant")).toBeVisible();

  const after = await getStateSnapshot(page);
  const node = after.nodes.find((entry) => entry.id === "plain-text-node");

  expect(node?.warp).toEqual({
    kind: "slant",
    rise: -120,
  });
});

test("edits slant from the on-canvas handle", async ({ page }) => {
  await gotoEditor(page);
  await loadSlantDocument(page);
  await page.locator('.canvas-node[data-node-id="slant-node"]').click();
  await pauseForUi(page);

  await expect(page.getByRole("button", { name: "Edit path (E)" })).toHaveCount(
    0
  );

  const slantHandle = page.getByTestId("text-path-handle-slant");

  await expect(slantHandle).toBeVisible();

  const before = await getStateSnapshot(page);
  const handleBox = await slantHandle.boundingBox();
  const nodeBox = await page
    .locator('.canvas-node[data-node-id="slant-node"]')
    .boundingBox();
  const iconRotationDeg = await getHandleIconRotationDeg(slantHandle);

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
    expect(handleBox.y + handleBox.height / 2).toBeLessThan(
      nodeBox.y + nodeBox.height * 0.35
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

  const updatedHandleBox = await slantHandle.boundingBox();

  const after = await getStateSnapshot(page);
  const beforeNode = before.nodes.find((node) => node.id === "slant-node");
  const afterNode = after.nodes.find((node) => node.id === "slant-node");

  expect(beforeNode?.warp?.kind).toBe("slant");
  expect(afterNode?.warp?.kind).toBe("slant");

  if (
    !(beforeNode?.warp?.kind === "slant" && afterNode?.warp?.kind === "slant")
  ) {
    return;
  }

  if (updatedHandleBox) {
    expect(
      Math.abs(
        updatedHandleBox.y +
          updatedHandleBox.height / 2 -
          (handleBox.y + handleBox.height / 2)
      )
    ).toBeLessThanOrEqual(6);
  }

  expect(afterNode.warp.rise).toBeLessThan(beforeNode.warp.rise);
});

test("moves a slant node by dragging the visible text with inline warp controls", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadSlantDocument(page);

  const node = page.locator('.canvas-node[data-node-id="slant-node"]');

  await node.click();
  await pauseForUi(page);

  const before = await getStateSnapshot(page);
  const nodeBox = await node.boundingBox();

  expect(nodeBox).not.toBeNull();

  if (!nodeBox) {
    return;
  }

  const startX = nodeBox.x + nodeBox.width / 2;
  const startY = nodeBox.y + nodeBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 40, { steps: 12 });
  await page.mouse.up();
  await pauseForUi(page);

  const after = await getStateSnapshot(page);
  const movedNode = after.nodes.find((entry) => entry.id === "slant-node");
  const beforeNode = before.nodes.find((entry) => entry.id === "slant-node");

  expect(movedNode?.x).toBeGreaterThan((beforeNode?.x || 0) + 50);
  expect(movedNode?.y).toBeGreaterThan((beforeNode?.y || 0) + 20);
});

test("keeps the spring motion aligned with node rotation for slant", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadSlantDocument(page, 35);
  await page.locator('.canvas-node[data-node-id="slant-node"]').click();
  await pauseForUi(page);

  const slantHandle = page.getByTestId("text-path-handle-slant");

  await expect(slantHandle).toBeVisible();

  const initialBox = await slantHandle.boundingBox();

  expect(initialBox).not.toBeNull();

  if (!initialBox) {
    return;
  }

  const startX = initialBox.x + initialBox.width / 2;
  const startY = initialBox.y + initialBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY - 80, { steps: 6 });
  await pauseForUi(page);

  const activeBox = await slantHandle.boundingBox();

  await page.mouse.up();

  expect(activeBox).not.toBeNull();

  if (!activeBox) {
    return;
  }

  const activeCenterX = activeBox.x + activeBox.width / 2;
  const activeCenterY = activeBox.y + activeBox.height / 2;

  expect(Math.abs(activeCenterX - startX)).toBeGreaterThan(1);
  expect(Math.abs(activeCenterY - startY)).toBeGreaterThan(1);
});
