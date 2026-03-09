import { expect, test } from "@playwright/test";
import {
  createTextNode,
  dragLayerBelow,
  getCanvasNodeIds,
  getSelectionSnapshot,
  getStateSnapshot,
  gotoEditor,
  pauseForUi,
  waitForNodeReady,
} from "./editor-helpers";

const clickEmptyCanvas = async (page) => {
  const canvas = page.getByTestId("canvas-stage");
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error("Missing canvas bounds");
  }

  await page.mouse.click(box.x + box.width - 80, box.y + 80);
};

const DUPLICATE_MENU_ITEM_NAME = /Duplicate/;

test("duplicates the selected layer with the keyboard shortcut", async ({
  page,
}) => {
  await gotoEditor(page);

  const originalNodeId = await createTextNode(page, {
    text: "Duplicate me",
    x: 420,
    y: 280,
  });

  const original = await waitForNodeReady(page, originalNodeId);
  await page.keyboard.press("ControlOrMeta+J");
  await pauseForUi(page);

  const selection = await getSelectionSnapshot(page);
  const duplicateNodeId = selection.selectedNodeId;

  expect(duplicateNodeId).not.toBe(originalNodeId);

  const duplicate = await waitForNodeReady(page, duplicateNodeId);
  const state = await getStateSnapshot(page);

  expect(state.nodes).toHaveLength(2);
  expect(duplicate.text).toBe(original.text);
  expect(duplicate.x).toBe(original.x + 120);
  expect(duplicate.y).toBe(original.y + 120);
});

test("duplicate exits text editing before selecting the new layer", async ({
  page,
}) => {
  await gotoEditor(page);

  const originalNodeId = await createTextNode(page, {
    text: "Duplicate while editing",
    x: 440,
    y: 300,
  });

  await waitForNodeReady(page, originalNodeId);
  await page
    .getByRole("button", { name: "Duplicate while editing" })
    .first()
    .dblclick();
  await page
    .getByRole("button", { name: "Duplicate while editing" })
    .first()
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: DUPLICATE_MENU_ITEM_NAME }).click();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return {
        activeTool: state.activeTool,
        editingNodeId: state.editingNodeId,
        nodeCount: state.nodes.length,
      };
    })
    .toEqual({
      activeTool: "pointer",
      editingNodeId: null,
      nodeCount: 2,
    });

  await clickEmptyCanvas(page);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.length;
    })
    .toBe(2);
});

test("reordering layers updates canvas stacking order", async ({ page }) => {
  await gotoEditor(page);

  const backNodeId = await createTextNode(page, {
    text: "Back layer",
    x: 440,
    y: 320,
  });
  const frontNodeId = await createTextNode(page, {
    text: "Front layer",
    x: 440,
    y: 320,
  });

  await waitForNodeReady(page, backNodeId);
  await waitForNodeReady(page, frontNodeId);

  await expect
    .poll(async () => getCanvasNodeIds(page))
    .toEqual([backNodeId, frontNodeId]);

  await dragLayerBelow(page, "Front layer", "Back layer");
  await pauseForUi(page);

  await expect
    .poll(async () => getCanvasNodeIds(page))
    .toEqual([frontNodeId, backNodeId]);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.map((node) => node.id);
    })
    .toEqual([frontNodeId, backNodeId]);
});

test("hiding a layer removes it from canvas but keeps it selected", async ({
  page,
}) => {
  await gotoEditor(page);

  const nodeId = await createTextNode(page, {
    text: "Hide me",
    x: 520,
    y: 340,
  });

  await waitForNodeReady(page, nodeId);
  await page.getByRole("button", { name: "Hide me" }).first().dblclick();

  await page.getByRole("button", { name: "Hide layer" }).click();
  await pauseForUi(page);

  await expect(page.locator(`[data-node-id="${nodeId}"]`)).toHaveCount(0);

  await expect
    .poll(async () => {
      const selection = await getSelectionSnapshot(page);
      const state = await getStateSnapshot(page);
      const node = state.nodes.find((item) => item.id === nodeId);

      return {
        selectedNodeId: selection.selectedNodeId,
        activeTool: state.activeTool,
        visible: node?.visible ?? true,
      };
    })
    .toEqual({
      activeTool: "pointer",
      selectedNodeId: nodeId,
      visible: false,
    });

  await clickEmptyCanvas(page);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.length;
    })
    .toBe(1);
});
