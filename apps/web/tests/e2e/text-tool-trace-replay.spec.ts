import { expect, test } from "@playwright/test";
import {
  getStateSnapshot,
  gotoEditor,
  loadDocument,
  pauseForUi,
} from "./helpers/editor";

const TRACE_REPLAY_DOCUMENT = {
  nodes: [
    {
      id: "e47a3c2f-401a-4730-a333-00525e2a5508",
      parentId: "root",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      },
      type: "group",
      visible: true,
    },
    {
      fill: "#ffffff",
      font: {
        family: "Arial",
        fullName: "Arial",
        postscriptName: "ArialMT",
        style: "Regular",
      },
      fontSize: 400,
      id: "7d66512e-2d6a-49ec-b4bf-0c20de59dac7",
      parentId: "e47a3c2f-401a-4730-a333-00525e2a5508",
      stroke: "#000000",
      strokeWidth: 12,
      text: "YOUR TEXT",
      tracking: 10,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 467.71,
        y: 633.26,
      },
      type: "text",
      visible: true,
      warp: {
        bend: 0.4,
        kind: "arch",
      },
    },
    {
      fill: "#ffffff",
      font: {
        family: "Arial",
        fullName: "Arial",
        postscriptName: "ArialMT",
        style: "Regular",
      },
      fontSize: 400,
      id: "3f6ca148-c07e-48ae-8429-047c36c8e371",
      parentId: "e47a3c2f-401a-4730-a333-00525e2a5508",
      stroke: "#000000",
      strokeWidth: 12,
      text: "YOUR TEXT",
      tracking: 10,
      transform: {
        rotation: -22.73,
        scaleX: 1,
        scaleY: 1,
        x: 532.29,
        y: 501.52,
      },
      type: "text",
      visible: true,
      warp: {
        bend: 0.4,
        kind: "arch",
      },
    },
  ],
  version: "1.6",
} as const;

const TRACE_ZOOM = 0.445_612_442_210_268_24;
const TRACE_ANCHOR = {
  canvas: { x: 749.81, y: 1010.67 },
  client: { x: 852.92, y: 688.31 },
};
const TRACE_TEXT_ATTEMPTS = [
  {
    down: { x: 852.92, y: 688.31 },
    up: { x: 852.92, y: 688.31 },
  },
  {
    down: { x: 811.67, y: 699.32 },
    move: { x: 811.67, y: 699.09 },
    up: { x: 811.67, y: 699.09 },
  },
  {
    down: { x: 772.63, y: 718.35 },
    move: { x: 772.63, y: 718.11 },
    up: { x: 772.63, y: 718.11 },
  },
] as const;

const alignViewportToTraceAnchor = async (page) => {
  await page.evaluate(
    ({ anchor, zoom }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const host = editor?.hostRef;
      const viewer = editor?.viewerRef;

      if (!(editor && host && viewer)) {
        return false;
      }

      const rect = host.getBoundingClientRect();
      const scrollLeft = anchor.canvas.x - (anchor.client.x - rect.left) / zoom;
      const scrollTop = anchor.canvas.y - (anchor.client.y - rect.top) / zoom;

      viewer.setTo?.({
        x: scrollLeft,
        y: scrollTop,
        zoom,
      });
      editor.setViewportZoom(zoom);
      editor.onViewportChange?.();

      return true;
    },
    {
      anchor: TRACE_ANCHOR,
      zoom: TRACE_ZOOM,
    }
  );
};

const replayTextAttempts = async (page) => {
  await page.keyboard.press("t");
  await pauseForUi(page);

  for (const attempt of TRACE_TEXT_ATTEMPTS) {
    await page.mouse.move(attempt.down.x, attempt.down.y);
    await page.mouse.down();

    if (attempt.move) {
      await page.mouse.move(attempt.move.x, attempt.move.y);
    }

    await page.mouse.up();
    await pauseForUi(page);
  }
};

test("trace replay creates a text node when clicking with the text tool", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, JSON.stringify(TRACE_REPLAY_DOCUMENT, null, 2));
  await alignViewportToTraceAnchor(page);
  await pauseForUi(page);
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    window.__TRACE_DISPATCH_CANVAS_POINTER_DOWN_COUNT__ = 0;

    if (editor.__TRACE_ORIGINAL_DISPATCH_CANVAS_POINTER_DOWN__) {
      editor.dispatchCanvasPointerDown =
        editor.__TRACE_ORIGINAL_DISPATCH_CANVAS_POINTER_DOWN__;
    }

    editor.__TRACE_ORIGINAL_DISPATCH_CANVAS_POINTER_DOWN__ =
      editor.dispatchCanvasPointerDown.bind(editor);
    editor.dispatchCanvasPointerDown = (info) => {
      window.__TRACE_DISPATCH_CANVAS_POINTER_DOWN_COUNT__ += 1;
      return editor.__TRACE_ORIGINAL_DISPATCH_CANVAS_POINTER_DOWN__(info);
    };
  });

  await expect
    .poll(async () => (await getStateSnapshot(page)).activeTool)
    .toBe("pointer");
  await expect(page.locator("[data-node-id]")).toHaveCount(2);

  await replayTextAttempts(page);
  await expect
    .poll(async () => (await getStateSnapshot(page)).nodes.length)
    .toBe(4);
  await expect(page.locator("[data-node-id]")).toHaveCount(3);
});
