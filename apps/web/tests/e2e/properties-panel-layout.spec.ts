import { expect, type Page, test } from "@playwright/test";
import { gotoEditor } from "./helpers/editor";

const TEXT_ID = "panel-text";
const ADD_BUTTON_NAME = /^Add (fill|stroke|effect)$/;

// A text node with every stacked section open: fill, stroke, effect, warp.
const loadTallSelection = (page: Page) => {
  return page.evaluate((nodeId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.loadDocument(
      JSON.stringify({
        nodes: [
          {
            fill: "#000000",
            font: {
              family: "Arial",
              fullName: "Arial",
              postscriptName: "ArialMT",
              style: "Regular",
            },
            fontSize: 120,
            id: nodeId,
            parentId: "root",
            stroke: null,
            strokeWidth: 0,
            text: "PANEL",
            tracking: 0,
            transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 380, y: 260 },
            type: "text",
            visible: true,
            warp: { bend: 0.3, kind: "arch" },
          },
        ],
        version: "1.8",
      })
    );
    editor?.setSelectedNodes([nodeId]);
    editor?.addStroke();
    editor?.addEffect("drop-shadow");
  }, TEXT_ID);
};

// Right edges of every control in the panel against the content box's right
// edge (the scroll body minus its padding).
const measureControlOverflow = (page: Page) => {
  return page.getByTestId("properties-panel-body").evaluate((body) => {
    const style = getComputedStyle(body);
    const contentRight =
      body.getBoundingClientRect().right -
      Number.parseFloat(style.paddingRight) -
      (body.offsetWidth - body.clientWidth);
    const controls = body.querySelectorAll(
      "button, input, [role='slider'], [data-slot='select-trigger']"
    );

    return [...controls]
      .map((control) => ({
        label:
          control.getAttribute("aria-label") ??
          control.textContent?.trim() ??
          control.tagName,
        overflow: control.getBoundingClientRect().right - contentRight,
      }))
      .filter((entry) => entry.overflow > 0.5);
  });
};

test("nested appearance controls stay inside the panel's right edge", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await gotoEditor(page);
  await loadTallSelection(page);

  await expect(
    page.getByRole("combobox", { name: "Stroke join" })
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Paint kind" })).toHaveCount(
    2
  );
  expect(await measureControlOverflow(page)).toEqual([]);
});

test("section add buttons center their icon", async ({ page }) => {
  await gotoEditor(page);
  await loadTallSelection(page);

  const offsets = await page
    .getByRole("button", { name: ADD_BUTTON_NAME })
    .evaluateAll((buttons) => {
      return buttons.map((button) => {
        const box = button.getBoundingClientRect();
        const icon = button.querySelector("svg")?.getBoundingClientRect();

        return icon
          ? [
              Math.abs(icon.x + icon.width / 2 - (box.x + box.width / 2)),
              Math.abs(icon.y + icon.height / 2 - (box.y + box.height / 2)),
            ]
          : null;
      });
    });

  expect(offsets).toHaveLength(3);
  for (const offset of offsets) {
    expect(offset?.[0]).toBeLessThanOrEqual(0.5);
    expect(offset?.[1]).toBeLessThanOrEqual(0.5);
  }
});

test("a tall panel scrolls inside the window", async ({ page }) => {
  await page.setViewportSize({ height: 640, width: 1280 });
  await gotoEditor(page);
  await loadTallSelection(page);

  const body = page.getByTestId("properties-panel-body");
  // Warp is the last section for a warped text node.
  const lastControl = body.getByRole("slider", { name: "Bend" });

  await expect(lastControl).toBeAttached();

  const panelBottom = await body.evaluate((element) => {
    return element.getBoundingClientRect().bottom;
  });
  const overflows = await body.evaluate((element) => {
    return element.scrollHeight > element.clientHeight;
  });

  expect(panelBottom).toBeLessThanOrEqual(640);
  expect(overflows).toBe(true);
  await expect(lastControl).not.toBeInViewport();

  await body.hover();
  await page.mouse.wheel(0, 4000);
  await expect(lastControl).toBeInViewport();
});
