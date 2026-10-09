import { expect, test } from "@playwright/test";
import { gotoEditor } from "./helpers/editor";

const TAB_BAR_HEIGHT = 40;
const PANE_INSET = 8;

// The Layers and Properties panes float as flat cards over a full-window
// canvas: 8px from the window edges, below the tab bar, 8px radius.
test("panes float 8px inside the window over a full-window canvas", async ({
  page,
}) => {
  await page.setViewportSize({ height: 720, width: 1280 });
  await gotoEditor(page);
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.loadDocument(
      JSON.stringify({
        nodes: [
          {
            background: "#ffffff",
            height: 600,
            id: "pane-artboard",
            locked: false,
            name: "Artboard",
            parentId: "root",
            transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
            type: "artboard",
            visible: true,
            width: 800,
          },
        ],
        version: "1.8",
      })
    );
    editor?.setSelectedNodes(["pane-artboard"]);
  });
  await expect(page.locator("[data-properties-panel]")).toBeVisible();

  const layout = await page.evaluate(() => {
    const box = (selector: string) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();

      return rect
        ? {
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            top: rect.top,
          }
        : null;
    };
    const pane = document.querySelector("[data-properties-panel]");
    const style = pane ? getComputedStyle(pane) : null;

    return {
      canvas: box(".canvas-host"),
      left: box("[data-layers-panel]"),
      paneBorder: style?.borderTopWidth,
      paneRadius: style?.borderTopLeftRadius,
      right: box("[data-properties-panel]"),
    };
  });

  expect(layout.canvas).toEqual({ bottom: 720, left: 0, right: 1280, top: 0 });
  expect(layout.left?.left).toBe(PANE_INSET);
  expect(layout.right?.right).toBe(1280 - PANE_INSET);
  expect(layout.left?.top).toBe(TAB_BAR_HEIGHT + PANE_INSET);
  expect(layout.right?.top).toBe(TAB_BAR_HEIGHT + PANE_INSET);
  expect(layout.right?.bottom).toBeLessThanOrEqual(720 - PANE_INSET);
  expect(layout.paneRadius).toBe("8px");
  expect(layout.paneBorder).toBe("1px");
});
