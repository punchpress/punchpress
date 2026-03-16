import { expect, test } from "@playwright/test";
import {
  createTextNode,
  dragLayerBelow,
  expectHandleAlignedToNodeCorner,
  getCanvasNodeIds,
  getSelectionSnapshot,
  getStateSnapshot,
  gotoEditor,
  marqueeSelect,
  pauseForUi,
  shiftClickLayer,
  waitForNodeReady,
  waitForSelectionHandles,
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

const getBoundingUnion = (rects) => {
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));

  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
};

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

test("hiding one layer in a multi-selection keeps the visible layer draggable", async ({
  page,
}) => {
  await gotoEditor(page);

  const firstNodeId = await createTextNode(page, {
    text: "Visible after hide",
    x: 520,
    y: 300,
  });
  const secondNodeId = await createTextNode(page, {
    text: "Hide after select",
    x: 820,
    y: 460,
  });

  const firstBefore = await waitForNodeReady(page, firstNodeId);
  const secondBefore = await waitForNodeReady(page, secondNodeId);
  const selectionBounds = getBoundingUnion([
    firstBefore.elementRect,
    secondBefore.elementRect,
  ]);

  await marqueeSelect(
    page,
    {
      x: selectionBounds.left - 96,
      y: selectionBounds.top - 96,
    },
    {
      x: selectionBounds.right + 96,
      y: selectionBounds.bottom + 96,
    }
  );
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([firstNodeId, secondNodeId]);

  await page.getByRole("button", { name: "Hide layer" }).first().click();
  await pauseForUi(page);

  const stateAfterHide = await getStateSnapshot(page);
  const visibleNodeId = stateAfterHide.nodes.find(
    (node) => node.visible !== false
  )?.id;

  expect(visibleNodeId).toBe(firstNodeId);

  const selection = await waitForSelectionHandles(page);

  expect(selection.handles.nw).not.toBeNull();
  expect(selection.handles.se).not.toBeNull();

  const visibleBefore = await waitForNodeReady(page, visibleNodeId);
  const dragStart = {
    x: visibleBefore.elementRect.x + visibleBefore.elementRect.width / 2,
    y: visibleBefore.elementRect.y + visibleBefore.elementRect.height / 2,
  };

  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragStart.x + 70, dragStart.y + 45, {
    steps: 10,
  });
  await page.mouse.up();
  await pauseForUi(page);

  const visibleAfter = await waitForNodeReady(page, visibleNodeId);

  expect(visibleAfter.x).toBeCloseTo(visibleBefore.x + 70, 1);
  expect(visibleAfter.y).toBeCloseTo(visibleBefore.y + 45, 1);
});

test("marquee selection moves multiple layers together", async ({ page }) => {
  await gotoEditor(page);

  const firstNodeId = await createTextNode(page, {
    text: "A",
    x: 640,
    y: 320,
  });
  const secondNodeId = await createTextNode(page, {
    text: "B",
    x: 880,
    y: 500,
  });

  const firstBefore = await waitForNodeReady(page, firstNodeId);
  const secondBefore = await waitForNodeReady(page, secondNodeId);
  const start = {
    x:
      Math.min(firstBefore.elementRect.left, secondBefore.elementRect.left) -
      96,
    y: Math.min(firstBefore.elementRect.top, secondBefore.elementRect.top) - 96,
  };
  const end = {
    x:
      Math.max(firstBefore.elementRect.right, secondBefore.elementRect.right) +
      96,
    y:
      Math.max(
        firstBefore.elementRect.bottom,
        secondBefore.elementRect.bottom
      ) + 96,
  };

  await marqueeSelect(page, start, end);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([firstNodeId, secondNodeId]);

  const dragStart = {
    x: firstBefore.elementRect.x + firstBefore.elementRect.width / 2,
    y: firstBefore.elementRect.y + firstBefore.elementRect.height / 2,
  };

  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragStart.x + 90, dragStart.y + 55, {
    steps: 12,
  });
  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const firstAfterRect = await page
        .locator(`[data-node-id="${firstNodeId}"]`)
        .boundingBox();
      const secondAfterRect = await page
        .locator(`[data-node-id="${secondNodeId}"]`)
        .boundingBox();

      if (!(firstAfterRect && secondAfterRect)) {
        return null;
      }

      return {
        first: {
          x: Math.round(firstAfterRect.x),
          y: Math.round(firstAfterRect.y),
        },
        second: {
          x: Math.round(secondAfterRect.x),
          y: Math.round(secondAfterRect.y),
        },
      };
    })
    .toEqual({
      first: {
        x: Math.round(firstBefore.elementRect.x + 90),
        y: Math.round(firstBefore.elementRect.y + 55),
      },
      second: {
        x: Math.round(secondBefore.elementRect.x + 90),
        y: Math.round(secondBefore.elementRect.y + 55),
      },
    });
});

test("marquee selection shows one wrapper box around the whole group", async ({
  page,
}) => {
  await gotoEditor(page);

  const firstNodeId = await createTextNode(page, {
    text: "Top left",
    x: 560,
    y: 260,
  });
  const secondNodeId = await createTextNode(page, {
    text: "Middle",
    x: 860,
    y: 470,
  });
  const thirdNodeId = await createTextNode(page, {
    text: "Bottom left",
    x: 600,
    y: 690,
  });

  const firstNode = await waitForNodeReady(page, firstNodeId);
  const secondNode = await waitForNodeReady(page, secondNodeId);
  const thirdNode = await waitForNodeReady(page, thirdNodeId);
  const groupBounds = getBoundingUnion([
    firstNode.elementRect,
    secondNode.elementRect,
    thirdNode.elementRect,
  ]);

  await marqueeSelect(
    page,
    {
      x: groupBounds.left - 96,
      y: groupBounds.top - 96,
    },
    {
      x: groupBounds.right + 96,
      y: groupBounds.bottom + 96,
    }
  );
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([firstNodeId, secondNodeId, thirdNodeId]);

  const selection = await waitForSelectionHandles(page);

  expectHandleAlignedToNodeCorner(selection.handles.nw, groupBounds, "nw");
  expectHandleAlignedToNodeCorner(selection.handles.se, groupBounds, "se");
});

test("shift-click layer selection groups layers in layer order", async ({
  page,
}) => {
  await gotoEditor(page);

  const backNodeId = await createTextNode(page, {
    text: "Shift back",
    x: 360,
    y: 260,
  });
  const middleNodeId = await createTextNode(page, {
    text: "Shift middle",
    x: 520,
    y: 340,
  });
  const frontNodeId = await createTextNode(page, {
    text: "Shift front",
    x: 680,
    y: 420,
  });

  await waitForNodeReady(page, backNodeId);
  await waitForNodeReady(page, middleNodeId);
  await waitForNodeReady(page, frontNodeId);

  await page.getByRole("button", { name: "Shift back" }).first().click();
  await shiftClickLayer(page, "Shift middle");
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([backNodeId, middleNodeId]);
});

test("shift-clicking another layer while editing exits text editing first", async ({
  page,
}) => {
  await gotoEditor(page);

  const editingNodeId = await createTextNode(page, {
    text: "Editing node",
    x: 440,
    y: 280,
  });
  const otherNodeId = await createTextNode(page, {
    text: "Other node",
    x: 720,
    y: 360,
  });

  await waitForNodeReady(page, editingNodeId);
  await waitForNodeReady(page, otherNodeId);

  await page.getByRole("button", { name: "Editing node" }).first().dblclick();

  await expect(page.getByTestId("canvas-text-input")).toBeVisible();

  await shiftClickLayer(page, "Other node");
  await pauseForUi(page);

  await expect(page.getByTestId("canvas-text-input")).toHaveCount(0);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);

      return {
        activeTool: state.activeTool,
        editingNodeId: state.editingNodeId,
        selectedNodeIds: state.selectedNodeIds,
      };
    })
    .toEqual({
      activeTool: "pointer",
      editingNodeId: null,
      selectedNodeIds: [editingNodeId, otherNodeId],
    });
});
