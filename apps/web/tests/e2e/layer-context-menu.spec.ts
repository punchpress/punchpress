import { expect, test } from "@playwright/test";
import {
  getDebugDump,
  getSelectionSnapshot,
  gotoEditor,
  loadDocument,
} from "./helpers/editor";

const LAYER_CONTEXT_MENU_DOCUMENT = JSON.stringify({
  nodes: [
    {
      cornerRadius: 0,
      fill: "#3366ff",
      height: 110,
      id: "shape-a",
      parentId: "root",
      shape: "polygon",
      stroke: null,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 180,
        y: 180,
      },
      type: "shape",
      visible: true,
      width: 140,
    },
    {
      cornerRadius: 0,
      fill: "#ff6633",
      height: 120,
      id: "shape-b",
      parentId: "root",
      shape: "ellipse",
      stroke: null,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 390,
        y: 220,
      },
      type: "shape",
      visible: true,
      width: 130,
    },
    {
      cornerRadius: 0,
      fill: "#22aa66",
      height: 100,
      id: "shape-c",
      parentId: "root",
      shape: "polygon",
      stroke: null,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 600,
        y: 220,
      },
      type: "shape",
      visible: true,
      width: 120,
    },
  ],
  version: "1.7",
});

const getLayerButton = (page, nodeId) => {
  return page.locator(`[data-layer-node-id="${nodeId}"]`);
};

const getVisibleNodeState = async (page) => {
  const dump = await getDebugDump(page);
  const nodes = dump?.nodes || [];

  return nodes
    .filter((node) => ["shape-a", "shape-b", "shape-c"].includes(node.id))
    .map((node) => ({
      id: node.id,
      visible: node.visible,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
};

test("right-clicking a selected layer preserves multi-selection and duplicates the full target set", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, LAYER_CONTEXT_MENU_DOCUMENT);

  await getLayerButton(page, "shape-a").click();
  await page.keyboard.down("Shift");
  await getLayerButton(page, "shape-b").click();
  await page.keyboard.up("Shift");

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual(["shape-a", "shape-b"]);

  await getLayerButton(page, "shape-b").click({ button: "right" });

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual(["shape-a", "shape-b"]);

  await page.getByRole("menuitem", { name: "Duplicate" }).click();

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return dump?.nodes.filter((node) => node.type === "shape").length;
    })
    .toBe(5);
});

test("right-clicking a selected layer applies visibility changes to the full target set", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, LAYER_CONTEXT_MENU_DOCUMENT);

  await getLayerButton(page, "shape-a").click();
  await page.keyboard.down("Shift");
  await getLayerButton(page, "shape-b").click();
  await page.keyboard.up("Shift");

  await getLayerButton(page, "shape-b").click({ button: "right" });

  await expect(
    page.getByRole("menuitem", { name: "Hide Selected" })
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Hide Selected" }).click();

  await expect
    .poll(() => getVisibleNodeState(page))
    .toEqual([
      { id: "shape-a", visible: false },
      { id: "shape-b", visible: false },
      { id: "shape-c", visible: true },
    ]);

  await getLayerButton(page, "shape-a").click({ button: "right" });

  await expect(
    page.getByRole("menuitem", { name: "Show Selected" })
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Show Selected" }).click();

  await expect
    .poll(() => getVisibleNodeState(page))
    .toEqual([
      { id: "shape-a", visible: true },
      { id: "shape-b", visible: true },
      { id: "shape-c", visible: true },
    ]);
});

test("right-clicking an unselected layer collapses the context target to that row", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, LAYER_CONTEXT_MENU_DOCUMENT);

  await getLayerButton(page, "shape-a").click();
  await page.keyboard.down("Shift");
  await getLayerButton(page, "shape-b").click();
  await page.keyboard.up("Shift");

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual(["shape-a", "shape-b"]);

  await getLayerButton(page, "shape-c").click({ button: "right" });

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual(["shape-c"]);

  await page.getByRole("menuitem", { name: "Duplicate" }).click();

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return dump?.nodes.filter((node) => node.type === "shape").length;
    })
    .toBe(4);
});

test("right-clicking a three-layer selection keeps generic actions and hides compound actions", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, LAYER_CONTEXT_MENU_DOCUMENT);

  await getLayerButton(page, "shape-a").click();
  await page.keyboard.down("Shift");
  await getLayerButton(page, "shape-b").click();
  await getLayerButton(page, "shape-c").click();
  await page.keyboard.up("Shift");

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual(["shape-a", "shape-b", "shape-c"]);

  await getLayerButton(page, "shape-b").click({ button: "right" });

  await expect(page.getByRole("menuitem", { name: "Duplicate" })).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Hide Selected" })
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Make Compound Path" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "Release Compound Path" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "Compound Operation" })
  ).toHaveCount(0);
});
