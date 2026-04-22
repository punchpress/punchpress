import { expect, test } from "@playwright/test";
import { clickNodeCenter } from "./helpers/canvas";
import {
  getDebugDump,
  getSelectionSnapshot,
  gotoEditor,
  loadDocument,
} from "./helpers/editor";

const CANVAS_CONTEXT_MENU_DOCUMENT = JSON.stringify({
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

const CANVAS_CONTEXT_MENU_VECTOR_DOCUMENT = JSON.stringify({
  nodes: [
    {
      closed: true,
      fill: "#3366FF",
      fillRule: "nonzero",
      id: "path-back",
      parentId: "root",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -120, y: -90 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 120, y: -90 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 120, y: 90 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -120, y: 90 },
          pointType: "corner",
        },
      ],
      stroke: "#111111",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 6,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 420,
        y: 260,
      },
      type: "path",
      visible: true,
    },
    {
      closed: true,
      fill: "#FF3366",
      fillRule: "nonzero",
      id: "path-front",
      parentId: "root",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -80, y: -40 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 80, y: -40 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 80, y: 40 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -80, y: 40 },
          pointType: "corner",
        },
      ],
      stroke: "#111111",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 6,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 720,
        y: 260,
      },
      type: "path",
      visible: true,
    },
  ],
  version: "1.7",
});

const getCanvasNode = (page, nodeId: string) => {
  return page.locator(`.canvas-node[data-node-id="${nodeId}"]`);
};

test("right-clicking a selected canvas node preserves multi-selection and duplicates the full target set", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, CANVAS_CONTEXT_MENU_DOCUMENT);

  await getCanvasNode(page, "shape-a").click();
  await page.keyboard.down("Shift");
  await getCanvasNode(page, "shape-b").click();
  await page.keyboard.up("Shift");

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual(["shape-a", "shape-b"]);

  await clickNodeCenter(page, "shape-b", { button: "right" });

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

test("right-clicking an unselected canvas node collapses the context target to that node", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, CANVAS_CONTEXT_MENU_DOCUMENT);

  await getCanvasNode(page, "shape-a").click();
  await page.keyboard.down("Shift");
  await getCanvasNode(page, "shape-b").click();
  await page.keyboard.up("Shift");

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual(["shape-a", "shape-b"]);

  await getCanvasNode(page, "shape-c").click({ button: "right" });

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

test("canvas node context menu exposes compound actions from the shared node menu", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, CANVAS_CONTEXT_MENU_VECTOR_DOCUMENT);

  await getCanvasNode(page, "path-back").click();
  await page.keyboard.down("Shift");
  await getCanvasNode(page, "path-front").click();
  await page.keyboard.up("Shift");

  await clickNodeCenter(page, "path-front", { button: "right" });

  await expect(
    page.getByRole("menuitem", { name: "Make Compound Path" })
  ).toBeVisible();
});
