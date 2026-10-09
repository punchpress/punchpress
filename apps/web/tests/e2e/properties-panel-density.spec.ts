import { expect, type Page, test } from "@playwright/test";
import { gotoEditor } from "./helpers/editor";

// Layout guarantees for every dev density direction. Remove with
// components/density-preview once a direction is picked.
const DENSITIES = ["current", "compact", "inspector", "pro"] as const;
const POPOVER_DENSITIES = new Set(["inspector", "pro"]);
const TEXT_ID = "density-text";

const openWithDensity = async (page: Page, density: string) => {
  await page.addInitScript((value) => {
    window.localStorage.setItem("punchpress.density-preview", value);
  }, density);
  await gotoEditor(page);
  await expect(page.locator("html")).toHaveAttribute("data-density", density);
};

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
            text: "DENSE",
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

// Groups the panel's value controls into visual rows and reports each row's
// right edge against the content box. Every row of value controls must end
// exactly at the content edge: nothing short, nothing past it.
const measureRowRightEdges = (page: Page) => {
  return page.getByTestId("properties-panel-body").evaluate((body) => {
    const style = getComputedStyle(body);
    const contentRight =
      body.getBoundingClientRect().right -
      Number.parseFloat(style.paddingRight) -
      (body.offsetWidth - body.clientWidth);
    const controls = body.querySelectorAll(
      "[data-slot='select-trigger'], [data-slot='scrub-slider'], [data-slot='input-control'], [data-slot='color-picker-trigger'], [data-slot='icon-segmented-control'], button:not(h3 button, [data-slot='icon-segmented-control-item'])"
    );
    const rows = new Map<number, number>();

    for (const control of controls) {
      const box = control.getBoundingClientRect();
      const top = Math.round(box.top + box.height / 2);

      rows.set(top, Math.max(rows.get(top) ?? 0, box.right));
    }

    return [...rows.entries()]
      .map(([top, right]) => ({
        offset: Math.round(right - contentRight),
        top,
      }))
      .filter((row) => Math.abs(row.offset) > 0.5);
  });
};

for (const density of DENSITIES) {
  test(`${density}: rows share one right edge and the panel fits the window`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 640, width: 1280 });
    await openWithDensity(page, density);
    await loadTallSelection(page);

    const body = page.getByTestId("properties-panel-body");

    await expect(body.getByRole("slider", { name: "Bend" })).toBeAttached();
    expect(await measureRowRightEdges(page)).toEqual([]);

    const bottom = await body.evaluate((element) => {
      return element.getBoundingClientRect().bottom;
    });

    expect(bottom).toBeLessThanOrEqual(640);

    if (density === "current") {
      const overflows = await body.evaluate((element) => {
        return element.scrollHeight > element.clientHeight;
      });

      expect(overflows).toBe(true);
    }

    // The last control in the panel is fully reachable.
    await body.hover();
    await page.mouse.wheel(0, 4000);
    await expect(
      body.getByRole("button", { name: "Clear warp" })
    ).toBeInViewport({ ratio: 1 });
  });
}

for (const density of DENSITIES.filter((id) => POPOVER_DENSITIES.has(id))) {
  test(`${density}: stroke settings open beside the panel and edit the stroke`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await openWithDensity(page, density);
    await loadTallSelection(page);

    // Settings live in the popover, not inline.
    await expect(
      page.getByRole("combobox", { name: "Stroke join" })
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Stroke settings" }).click();

    const align = page.getByRole("combobox", { name: "Stroke alignment" });

    await expect(align).toBeVisible();

    const [popupRight, panelLeft] = await Promise.all([
      align.evaluate((element) => {
        return (
          element
            .closest("[data-slot='popover-popup']")
            ?.getBoundingClientRect().right ?? Number.POSITIVE_INFINITY
        );
      }),
      page
        .locator("[data-properties-panel]")
        .evaluate((element) => element.getBoundingClientRect().left),
    ]);

    expect(popupRight).toBeLessThanOrEqual(panelLeft);

    await align.click();
    await page.getByRole("option", { name: "Inside" }).click();
    // Picking an option must not reach the canvas: a deselect there remounts
    // the row and closes its settings.
    await expect(page.getByRole("dialog", { name: "Stroke" })).toBeVisible();
    await expect
      .poll(() => {
        return page.evaluate((nodeId) => {
          const editor = window.__PUNCHPRESS_EDITOR__;

          return [
            editor?.getNode(nodeId)?.appearance?.strokes[0]?.align,
            editor?.selectedNodeIds,
          ];
        }, TEXT_ID);
      })
      .toEqual(["inside", [TEXT_ID]]);

    // Pressing the popup's own chrome keeps the selection and the popup.
    const dialog = page.getByRole("dialog", { name: "Stroke" });

    await dialog.getByText("Stroke", { exact: true }).click();
    await expect(dialog).toBeVisible();
    expect(
      await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.selectedNodeIds)
    ).toEqual([TEXT_ID]);
  });
}

test("inspector: section headers collapse their rows", async ({ page }) => {
  await openWithDensity(page, "inspector");
  await loadTallSelection(page);

  const fills = page.getByTestId("appearance-fills");

  await expect(fills.getByTestId("appearance-fills-item")).toHaveCount(1);
  await fills.getByRole("button", { exact: true, name: "Fill" }).click();
  await expect(fills.getByTestId("appearance-fills-item")).toHaveCount(0);
  await expect(fills.getByRole("button", { name: "Add fill" })).toBeVisible();
});

test("the density switcher cycles directions with Alt+Shift+D", async ({
  page,
}) => {
  await openWithDensity(page, "current");
  await page.keyboard.press("Alt+Shift+KeyD");
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await page
    .getByTestId("density-switcher")
    .getByRole("button", { name: "Pro" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "pro");
});
