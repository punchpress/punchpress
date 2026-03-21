import { expect, test } from "@playwright/test";
import {
  getStateSnapshot,
  gotoEditor,
  pauseForUi,
  resizeSelectionFromCorner,
} from "./helpers/editor";

const TEST_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
};

const loadCircleDocument = async (page) => {
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
            id: "circle-node",
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
              y: 220,
            },
            type: "text",
            visible: true,
            warp: {
              kind: "circle",
              pathPosition: 0,
              radius: 320,
              sweepDeg: 140,
            },
          },
        ],
        version: "1.3",
      })
    );

    return true;
  }, TEST_FONT);
};

const loadPlainTextDocument = async (page) => {
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
            text: "HEY",
            tracking: 0,
            transform: {
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              x: 380,
              y: 220,
            },
            type: "text",
            visible: true,
            warp: {
              kind: "none",
            },
          },
        ],
        version: "1.3",
      })
    );

    return true;
  }, TEST_FONT);
};

const setViewportZoom = async (page, zoom) => {
  await page.evaluate((nextZoom) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const viewer = editor?.viewerRef;

    if (!(editor && viewer)) {
      return false;
    }

    viewer.setTo?.({
      x: viewer.getScrollLeft?.() || 0,
      y: viewer.getScrollTop?.() || 0,
      zoom: nextZoom,
    });
    editor.setViewportZoom(nextZoom);
    editor.onViewportChange?.();

    return true;
  }, zoom);
};

test("resizes the circle path and repositions text along it", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);
  await page.locator('.canvas-node[data-node-id="circle-node"]').click();
  await pauseForUi(page);
  await page.getByRole("button", { name: "Edit path (E)" }).click();
  await pauseForUi(page);

  const positionHandle = page.getByTestId("text-path-handle-position");

  await expect(positionHandle).toBeVisible();

  const before = await getStateSnapshot(page);
  await resizeSelectionFromCorner(page, {
    corner: "se",
    drag: { x: 56, y: 24 },
  });
  await pauseForUi(page);

  const afterResize = await getStateSnapshot(page);
  const resizedNode = afterResize.nodes.find(
    (node) => node.id === "circle-node"
  );
  expect(resizedNode?.warp?.radius).toBeGreaterThan(
    before.nodes.find((node) => node.id === "circle-node")?.warp?.radius ?? 0
  );

  const positionBox = await positionHandle.boundingBox();

  if (!positionBox) {
    throw new Error("Missing circle position handle bounds");
  }

  await page.mouse.move(
    positionBox.x + positionBox.width / 2,
    positionBox.y + positionBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    positionBox.x + positionBox.width / 2 + 340,
    positionBox.y + positionBox.height / 2 + 340,
    { steps: 20 }
  );
  await page.mouse.up();
  await pauseForUi(page);

  const afterPosition = await getStateSnapshot(page);
  const positionedNode = afterPosition.nodes.find(
    (node) => node.id === "circle-node"
  );

  expect(positionedNode?.warp?.pathPosition).toBeGreaterThan(0.12);
  expect(positionedNode?.warp?.pathPosition).toBeLessThan(0.38);
});

test("enters path edit mode when circle warp is first applied", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadPlainTextDocument(page);
  await page.locator('.canvas-node[data-node-id="plain-text-node"]').click();
  await pauseForUi(page);

  await expect(
    page.getByRole("button", { name: "Delete (Delete)" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit path (E)" })).toHaveCount(
    0
  );

  await page.getByRole("button", { name: "Circle" }).click();
  await pauseForUi(page);

  await expect(
    page.getByRole("button", { name: "Done path editing (E)" })
  ).toBeVisible();
  await expect(page.getByTestId("text-path-handle-position")).toBeVisible();
});

test("exits path edit mode when circle warp is cleared", async ({ page }) => {
  await gotoEditor(page);
  await loadCircleDocument(page);
  await page.locator('.canvas-node[data-node-id="circle-node"]').click();
  await pauseForUi(page);
  await page.getByRole("button", { name: "Edit path (E)" }).click();
  await pauseForUi(page);

  await expect(
    page.getByRole("button", { name: "Done path editing (E)" })
  ).toBeVisible();
  await expect(page.getByTestId("text-path-handle-position")).toBeVisible();

  await page.getByRole("button", { name: "Clear" }).click();
  await pauseForUi(page);

  await expect(
    page.getByRole("button", { name: "Done path editing (E)" })
  ).toHaveCount(0);
  await expect(page.getByTestId("text-path-handle-position")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Delete (Delete)" })
  ).toBeVisible();
});

test("keeps the circle path transform target scaled with viewport zoom", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);
  await page.locator('.canvas-node[data-node-id="circle-node"]').click();
  await pauseForUi(page);
  await expect(
    page.locator('.canvas-text-path-target[data-node-id="circle-node"]')
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit path (E)" })
  ).toBeVisible();
  await page.keyboard.press("e");
  await pauseForUi(page);
  await setViewportZoom(page, 0.12);
  await pauseForUi(page);

  const targetBox = await page
    .locator('.canvas-text-path-target[data-node-id="circle-node"]')
    .boundingBox();

  if (!targetBox) {
    throw new Error("Missing circle transform target bounds");
  }

  expect(targetBox.width).toBeLessThan(160);
  expect(targetBox.height).toBeLessThan(160);
});

test("moves a selected circle path node by dragging the visible text", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);

  const node = page.locator('.canvas-node[data-node-id="circle-node"]');

  await node.click();
  await pauseForUi(page);

  const before = await getStateSnapshot(page);
  const nodeBox = await node.boundingBox();

  if (!nodeBox) {
    throw new Error("Missing circle node bounds");
  }

  const startX = nodeBox.x + nodeBox.width / 2;
  const startY = nodeBox.y + nodeBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 40, { steps: 12 });
  await page.mouse.up();
  await pauseForUi(page);

  const after = await getStateSnapshot(page);
  const movedNode = after.nodes.find((entry) => entry.id === "circle-node");
  const beforeNode = before.nodes.find((entry) => entry.id === "circle-node");

  expect(movedNode?.x).toBeGreaterThan((beforeNode?.x || 0) + 50);
  expect(movedNode?.y).toBeGreaterThan((beforeNode?.y || 0) + 20);
});

test("moves a circle path node by dragging the visible text while path editing", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);

  const node = page.locator('.canvas-node[data-node-id="circle-node"]');

  await node.click();
  await pauseForUi(page);
  await page.getByRole("button", { name: "Edit path (E)" }).click();
  await pauseForUi(page);

  const before = await getStateSnapshot(page);
  const nodeBox = await node.boundingBox();

  if (!nodeBox) {
    throw new Error("Missing circle node bounds");
  }

  const startX = nodeBox.x + nodeBox.width / 2;
  const startY = nodeBox.y + nodeBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 40, { steps: 12 });
  await page.mouse.up();
  await pauseForUi(page);

  const after = await getStateSnapshot(page);
  const movedNode = after.nodes.find((entry) => entry.id === "circle-node");
  const beforeNode = before.nodes.find((entry) => entry.id === "circle-node");

  expect(movedNode?.x).toBeGreaterThan((beforeNode?.x || 0) + 50);
  expect(movedNode?.y).toBeGreaterThan((beforeNode?.y || 0) + 20);
});

test("keeps the path action bar visible during drag", async ({ page }) => {
  await gotoEditor(page);
  await loadCircleDocument(page);

  const node = page.locator('.canvas-node[data-node-id="circle-node"]');
  const editButton = page.getByRole("button", { name: "Edit path (E)" });

  await node.click();
  await pauseForUi(page);
  await expect(editButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(1);

  const nodeBox = await node.boundingBox();

  if (!nodeBox) {
    throw new Error("Missing circle node bounds");
  }

  const startX = nodeBox.x + nodeBox.width / 2;
  const startY = nodeBox.y + nodeBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 40, { steps: 12 });

  await expect(editButton).toBeVisible();

  await page.mouse.up();
  await pauseForUi(page);

  await expect(editButton).toBeVisible();
});

test("uses text-sized hover preview for circle path nodes", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);

  await page.locator('.canvas-node[data-node-id="circle-node"]').hover();
  await pauseForUi(page);

  const hoverBox = await page.locator(".canvas-hover-preview").boundingBox();

  if (!hoverBox) {
    throw new Error("Missing hover preview bounds");
  }

  expect(hoverBox.height).toBeLessThan(280);
});
