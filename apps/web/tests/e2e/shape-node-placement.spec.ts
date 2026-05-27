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

const getViewportSnapshot = (page) => {
  return page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const viewer = editor?.viewerRef;

    return {
      x: viewer?.getScrollLeft?.() ?? null,
      y: viewer?.getScrollTop?.() ?? null,
      zoom: editor?.zoom ?? null,
    };
  });
};

const getExpectedClickShapeSize = (page) => {
  return page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const host = editor?.hostRef;
    const rect = host?.getBoundingClientRect?.();
    const worldWidth = rect && editor?.zoom ? rect.width / editor.zoom : 1400;
    const width = Math.max(10, Math.round((worldWidth * 0.2) / 10) * 10);

    return {
      height: Math.max(10, Math.round((width * 0.64) / 10) * 10),
      width,
    };
  });
};

test("clicking with the shape tool places a default-size rectangle", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.keyboard.press("r");

  const point = await getCanvasStagePoint(page, { x: 260, y: 220 });
  const expectedSize = await getExpectedClickShapeSize(page);

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
      height: expectedSize.height,
      type: "shape",
      width: expectedSize.width,
    });
});

test("dragging with the shape tool places and sizes a rectangle in one gesture", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.keyboard.press("r");

  const start = await getCanvasStagePoint(page, { x: 300, y: 160 });
  const end = await getCanvasStagePoint(page, { x: 540, y: 340 });

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
      x: 420,
      y: 250,
    });
});

test("dragging the first shape does not refocus the viewport on release", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.keyboard.press("r");

  const start = await getCanvasStagePoint(page, { x: 300, y: 160 });
  const end = await getCanvasStagePoint(page, { x: 540, y: 340 });
  const beforeViewport = await getViewportSnapshot(page);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();

  await page.waitForFunction(() => {
    return !window.__PUNCHPRESS_EDITOR__?.pendingViewportFocusFrame;
  });

  await expect.poll(() => getViewportSnapshot(page)).toEqual(beforeViewport);
});

test("holding shift while dragging places a square shape", async ({ page }) => {
  await gotoEditor(page);
  await page.keyboard.press("r");

  const start = await getCanvasStagePoint(page, { x: 300, y: 160 });
  const end = await getCanvasStagePoint(page, { x: 540, y: 340 });

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
      x: 420,
      y: 280,
    });
});

test("keeps live square artwork pinned to the placement shell while dragging", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.keyboard.press("r");

  const start = await getCanvasStagePoint(page, { x: 300, y: 160 });
  const first = await getCanvasStagePoint(page, { x: 520, y: 260 });
  const second = await getCanvasStagePoint(page, { x: 570, y: 420 });

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.keyboard.down("Shift");
  await page.mouse.move(first.x, first.y, { steps: 4 });

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.some((node) => node.type === "shape");
    })
    .toBe(true);

  await page.mouse.move(second.x, second.y, { steps: 1 });

  const liveRects = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(
      "[data-node-shell='true']"
    );
    const path = shell?.querySelector<SVGPathElement>("svg path");
    const shellRect = shell?.getBoundingClientRect();
    const pathRect = path?.getBoundingClientRect();

    return shellRect && pathRect
      ? {
          pathHeight: pathRect.height,
          pathLeft: pathRect.left,
          pathTop: pathRect.top,
          pathWidth: pathRect.width,
          shellHeight: shellRect.height,
          shellLeft: shellRect.left,
          shellTop: shellRect.top,
          shellWidth: shellRect.width,
        }
      : null;
  });

  await page.mouse.up();
  await page.keyboard.up("Shift");

  expect(liveRects?.pathLeft).toBeCloseTo(liveRects?.shellLeft ?? 0, 1);
  expect(liveRects?.pathTop).toBeCloseTo(liveRects?.shellTop ?? 0, 1);
  expect(liveRects?.pathWidth).toBeCloseTo(liveRects?.shellWidth ?? 0, 1);
  expect(liveRects?.pathHeight).toBeCloseTo(liveRects?.shellHeight ?? 0, 1);
});
