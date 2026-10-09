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

test("the tool dock uses square toolbar buttons and both toolbars fit a 1024px viewport", async ({
  page,
}) => {
  await page.setViewportSize({ height: 720, width: 1024 });
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
  await expect(page.locator(".canvas-selection-toolbar")).toBeVisible();

  const layout = await page.evaluate(() => {
    const dock = document.querySelector(".canvas-bottom-toolbar");
    const selection = document.querySelector(
      ".canvas-selection-toolbar [data-slot='toolbar']"
    );
    const buttonSize = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--toolbar-button"
      )
    );
    const toRect = (element: Element | null) => {
      const rect = element?.getBoundingClientRect();
      return rect ? { left: rect.left, right: rect.right } : null;
    };
    // The zoom readout is a text control; every other dock button is square.
    const iconButtons = [
      ...(dock?.querySelectorAll("button:not([role='slider'])") ?? []),
    ].map((button) => {
      const rect = button.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    });

    return {
      buttonSize,
      dock: toRect(dock),
      iconButtons,
      selection: toRect(selection),
      viewportWidth: window.innerWidth,
    };
  });

  expect(layout.buttonSize).toBeGreaterThan(0);
  expect(layout.iconButtons.length).toBeGreaterThan(0);
  for (const button of layout.iconButtons) {
    expect(button).toEqual({
      height: layout.buttonSize,
      width: layout.buttonSize,
    });
  }

  for (const rect of [layout.dock, layout.selection]) {
    expect(rect).not.toBeNull();
    expect(rect?.left).toBeGreaterThanOrEqual(0);
    expect(rect?.right).toBeLessThanOrEqual(layout.viewportWidth);
  }
});
