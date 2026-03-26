import { expect, test } from "@playwright/test";
import { getStateSnapshot, gotoEditor } from "./helpers/editor";

const getCanvasStagePoint = async (page, offset) => {
  const box = await page.getByTestId("canvas-stage").boundingBox();

  if (!box) {
    throw new Error("Missing canvas stage");
  }

  return {
    x: box.x + offset.x,
    y: box.y + offset.y,
  };
};

test("clicking with the shape tool places a default-size rectangle", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.keyboard.press("r");

  const point = await getCanvasStagePoint(page, { x: 260, y: 220 });

  await page.mouse.click(point.x, point.y);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      const shapeNode = state.nodes.find((node) => node.type === "shape");

      return {
        activeTool: state.activeTool,
        count: state.nodes.length,
        height: shapeNode?.height ?? null,
        type: shapeNode?.type ?? null,
        width: shapeNode?.width ?? null,
      };
    })
    .toEqual({
      activeTool: "pointer",
      count: 1,
      height: 180,
      type: "shape",
      width: 280,
    });
});

test("dragging with the shape tool places and sizes a rectangle in one gesture", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.keyboard.press("r");

  const start = await getCanvasStagePoint(page, { x: 180, y: 160 });
  const end = await getCanvasStagePoint(page, { x: 420, y: 340 });

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.length;
    })
    .toBe(0);

  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      const shapeNode = state.nodes.find((node) => node.type === "shape");

      return {
        activeTool: state.activeTool,
        count: state.nodes.length,
        height: shapeNode?.height ?? null,
        width: shapeNode?.width ?? null,
        x: shapeNode?.x ?? null,
        y: shapeNode?.y ?? null,
      };
    })
    .toEqual({
      activeTool: "pointer",
      count: 1,
      height: 180,
      width: 240,
      x: 300,
      y: 250,
    });
});

test("holding shift while dragging places a square shape", async ({ page }) => {
  await gotoEditor(page);
  await page.keyboard.press("r");

  const start = await getCanvasStagePoint(page, { x: 180, y: 160 });
  const end = await getCanvasStagePoint(page, { x: 420, y: 340 });

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.keyboard.down("Shift");
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Shift");

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      const shapeNode = state.nodes.find((node) => node.type === "shape");

      return {
        activeTool: state.activeTool,
        count: state.nodes.length,
        height: shapeNode?.height ?? null,
        width: shapeNode?.width ?? null,
        x: shapeNode?.x ?? null,
        y: shapeNode?.y ?? null,
      };
    })
    .toEqual({
      activeTool: "pointer",
      count: 1,
      height: 240,
      width: 240,
      x: 300,
      y: 280,
    });
});
