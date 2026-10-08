import { expect, test } from "@playwright/test";
import { gotoEditor } from "./helpers/editor";

// The selection toolbar positions itself from canvas DOM layout rather than
// editor state, so it must follow a canvas resize without a selection change.
test("the selection toolbar stays centered over the bottom toolbar after a resize", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    editor.addShapeNode({ x: 200, y: 200 }, "polygon");
    editor.setSelectedNodes(
      editor.nodes
        .filter((node) => node.type === "shape")
        .map((node) => node.id)
    );
  });

  const toolbar = page.locator(".canvas-selection-toolbar");
  const getOffset = () => {
    return page.evaluate(() => {
      const selection = document.querySelector(".canvas-selection-toolbar");
      const anchor = document.querySelector(".canvas-bottom-toolbar");

      if (!(selection && anchor)) {
        return null;
      }

      const selectionRect = selection.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();

      return Math.abs(
        selectionRect.left +
          selectionRect.width / 2 -
          (anchorRect.left + anchorRect.width / 2)
      );
    });
  };

  await expect(toolbar).toBeVisible();
  await expect.poll(getOffset).toBeLessThan(2);

  const viewport = page.viewportSize();
  await page.setViewportSize({
    height: viewport?.height ?? 720,
    width: (viewport?.width ?? 1280) - 240,
  });

  await expect.poll(getOffset).toBeLessThan(2);
});
