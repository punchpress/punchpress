import { expect, test } from "@playwright/test";
import { gotoEditor, loadDocument, setViewport } from "./helpers/editor";

const ARTBOARD = { height: 540, id: "artboard-1", width: 450, x: 420, y: 260 };

const ARTBOARD_DOCUMENT = JSON.stringify({
  nodes: [
    {
      background: "#ffffff",
      height: ARTBOARD.height,
      id: ARTBOARD.id,
      locked: false,
      name: "Artboard 1",
      parentId: "root",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: ARTBOARD.x,
        y: ARTBOARD.y,
      },
      type: "artboard",
      visible: true,
      width: ARTBOARD.width,
    },
  ],
  version: "1.8",
});

// Camera state as the viewer, the engine, the store, and the DOM see it.
const readCamera = (page) => {
  return page.evaluate((artboardId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const viewer = editor?.viewerRef;
    const container = viewer?.getContainer?.();
    const body = document.querySelector(`[data-artboard-body="${artboardId}"]`);
    const label = document.querySelector(
      `button.canvas-node[data-node-id="${artboardId}"]`
    );
    const selection = document.querySelector(".canvas-single-selection");

    if (!(editor && viewer && container && body && label)) {
      throw new Error("Expected a mounted canvas with one artboard");
    }

    const containerRect = container.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const selectionRect = selection?.getBoundingClientRect() ?? null;

    return {
      body: {
        left: bodyRect.left - containerRect.left,
        top: bodyRect.top - containerRect.top,
        width: bodyRect.width,
      },
      engine: editor.viewport,
      interacting: editor.viewportInteracting,
      labelHeight: label.getBoundingClientRect().height,
      selection: selectionRect
        ? {
            left: selectionRect.left - containerRect.left,
            top: selectionRect.top - containerRect.top,
            width: selectionRect.width,
          }
        : null,
      store: editor.getState().viewport,
      viewer: {
        x: viewer.getScrollLeft(),
        y: viewer.getScrollTop(),
        zoom: viewer.getZoom(),
      },
    };
  }, ARTBOARD.id);
};

const expectCamera = (actual, expected) => {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
  expect(actual.zoom).toBe(expected.zoom);
};

const nextFrame = (page) => {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  );
};

test("a held camera move survives unrelated renders and settles the store once", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.evaluate((artboardId) => {
    window.__PUNCHPRESS_EDITOR__?.select(artboardId);
  }, ARTBOARD.id);
  await nextFrame(page);
  const before = await readCamera(page);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.setViewportInteracting(true);
    editor?.moveViewportTo({ x: 200, y: 120, zoom: 0.5 });
    // Unrelated store updates re-render the canvas mid-interaction.
    editor?.setActiveTool("shape");
    editor?.setActiveTool("pointer");
  });
  await nextFrame(page);
  await nextFrame(page);

  const held = await readCamera(page);
  const expected = { x: 200, y: 120, zoom: 0.5 };

  expect(held.interacting).toBe(true);
  expectCamera(held.viewer, expected);
  expect(held.engine).toEqual(held.viewer);
  expect(held.store).toEqual(before.store);
  // Artwork, artboard label, and selection chrome all follow the live camera.
  expect(held.body.left).toBeCloseTo((ARTBOARD.x - 200) * 0.5, 0);
  expect(held.body.top).toBeCloseTo((ARTBOARD.y - 120) * 0.5, 0);
  expect(held.body.width).toBeCloseTo(ARTBOARD.width * 0.5, 0);
  expect(held.labelHeight).toBeCloseTo(before.labelHeight, 0);
  expect(held.selection?.left).toBeCloseTo(held.body.left, -1);
  expect(held.selection?.width).toBeCloseTo(held.body.width, -1);

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.setViewportInteracting(false);
  });
  await nextFrame(page);

  const settled = await readCamera(page);

  expect(settled.interacting).toBe(false);
  expectCamera(settled.viewer, expected);
  expect(settled.store).toEqual(settled.viewer);
});

test("a programmatic move outside an interaction publishes at once", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await setViewport(page, { x: -40, y: 30, zoom: 2 });
  await nextFrame(page);

  const camera = await readCamera(page);

  expect(camera.interacting).toBe(false);
  expectCamera(camera.viewer, { x: -40, y: 30, zoom: 2 });
  expect(camera.store).toEqual(camera.viewer);
  expect(camera.body.left).toBeCloseTo((ARTBOARD.x + 40) * 2, 0);
});
