import { expect, test } from "@playwright/test";
import {
  getSelectionSnapshot,
  gotoEditor,
  loadDocument,
} from "./helpers/editor";

const OVERLAPPING_SHAPES_DOCUMENT = JSON.stringify({
  nodes: [
    {
      cornerRadius: 0,
      fill: "#3366ff",
      height: 160,
      id: "bottom-shape",
      parentId: "root",
      shape: "polygon",
      stroke: null,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 220,
        y: 200,
      },
      type: "shape",
      visible: true,
      width: 180,
    },
    {
      cornerRadius: 0,
      fill: "#ff6633",
      height: 160,
      id: "top-shape",
      parentId: "root",
      shape: "polygon",
      stroke: null,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 300,
        y: 260,
      },
      type: "shape",
      visible: true,
      width: 180,
    },
  ],
  version: "1.7",
});

const getCanvasPointClientPoint = async (page, point) => {
  const clientPoint = await page.evaluate((nextPoint) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const host = editor?.hostRef;
    const viewer = editor?.viewerRef;

    if (!(editor && host && viewer && nextPoint)) {
      return null;
    }

    const rect = host.getBoundingClientRect();

    return {
      x: rect.left + (nextPoint.x - viewer.getScrollLeft()) * editor.zoom,
      y: rect.top + (nextPoint.y - viewer.getScrollTop()) * editor.zoom,
    };
  }, point);

  if (!clientPoint) {
    throw new Error("Missing client point for canvas coordinate");
  }

  return clientPoint;
};

test("clicking overlapping artwork selects the topmost visible object", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, OVERLAPPING_SHAPES_DOCUMENT);

  await expect(page.locator('[data-node-id="bottom-shape"]')).toBeVisible();
  await expect(page.locator('[data-node-id="top-shape"]')).toBeVisible();

  const overlapPoint = await getCanvasPointClientPoint(page, {
    x: 330,
    y: 290,
  });

  await page.mouse.click(overlapPoint.x, overlapPoint.y);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual(["top-shape"]);
});
