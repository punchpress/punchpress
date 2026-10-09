import { expect, type Page, test } from "@playwright/test";
import { gotoEditor } from "./helpers/editor";

const TEXT_ID = "panel-text";
const ADD_BUTTON_NAME = /^Add (fill|stroke|effect)$/;
const ARCH_WARP = { bend: 0.3, kind: "arch" };

// A text node with every stacked section open: fill, stroke, effect, warp.
const loadTallSelection = (page: Page, warp: object = ARCH_WARP) => {
  return page.evaluate(
    ([nodeId, nodeWarp]) => {
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
              warp: nodeWarp,
            },
          ],
          version: "1.8",
        })
      );
      editor?.setSelectedNodes([nodeId]);
      editor?.addStroke();
      editor?.addEffect("drop-shadow");
    },
    [TEXT_ID, warp] as const
  );
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

test("every control stays inside the panel's right edge", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await gotoEditor(page);
  await loadTallSelection(page);

  await expect(
    page.getByRole("button", { name: "Stroke settings" })
  ).toBeVisible();
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
  await page.setViewportSize({ height: 420, width: 1280 });
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

  expect(panelBottom).toBeLessThanOrEqual(420);
  expect(overflows).toBe(true);
  await expect(lastControl).not.toBeInViewport();

  await body.hover();
  await page.mouse.wheel(0, 4000);
  await expect(lastControl).toBeInViewport();
});

test("rows share one right edge and the panel fits the window", async ({
  page,
}) => {
  await page.setViewportSize({ height: 640, width: 1280 });
  await gotoEditor(page);
  await loadTallSelection(page);

  const body = page.getByTestId("properties-panel-body");

  await expect(body.getByRole("slider", { name: "Bend" })).toBeAttached();
  expect(await measureRowRightEdges(page)).toEqual([]);

  const bottom = await body.evaluate((element) => {
    return element.getBoundingClientRect().bottom;
  });

  expect(bottom).toBeLessThanOrEqual(640);

  // The last control in the panel is fully reachable.
  await body.hover();
  await page.mouse.wheel(0, 4000);
  await expect(body.getByRole("button", { name: "Clear warp" })).toBeInViewport(
    { ratio: 1 }
  );
});

test("warp type icons stay legible inside their segments", async ({ page }) => {
  await gotoEditor(page);
  await loadTallSelection(page);

  const sizes = await page
    .getByTestId("properties-panel-body")
    .locator("[data-slot='icon-segmented-control-item']")
    .evaluateAll((items) => {
      return items.map((item) => {
        const icon = item.querySelector("svg")?.getBoundingClientRect();

        return {
          icon: icon?.width ?? 0,
          item: item.getBoundingClientRect().height,
        };
      });
    });

  expect(sizes).toHaveLength(4);
  for (const { icon, item } of sizes) {
    expect(icon).toBeGreaterThanOrEqual(20);
    expect(icon).toBeLessThan(item);
  }
});

test("stroke settings open beside the panel and edit the stroke", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await gotoEditor(page);
  await loadTallSelection(page);

  // Settings live in the popover, not inline.
  await expect(page.getByRole("combobox", { name: "Stroke join" })).toHaveCount(
    0
  );
  await page.getByRole("button", { name: "Stroke settings" }).click();

  const align = page.getByRole("combobox", { name: "Stroke alignment" });

  await expect(align).toBeVisible();

  const [popupRight, panelLeft] = await Promise.all([
    align.evaluate((element) => {
      return (
        element.closest("[data-slot='popover-popup']")?.getBoundingClientRect()
          .right ?? Number.POSITIVE_INFINITY
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

test("section headers collapse their rows", async ({ page }) => {
  await gotoEditor(page);
  await loadTallSelection(page);

  const fills = page.getByTestId("appearance-fills");

  await expect(fills.getByTestId("appearance-fills-item")).toHaveCount(1);
  await fills.getByRole("button", { exact: true, name: "Fill" }).click();
  await expect(fills.getByTestId("appearance-fills-item")).toHaveCount(0);
  await expect(fills.getByRole("button", { name: "Add fill" })).toBeVisible();
});

test("paired values truncate before their inline labels", async ({ page }) => {
  // The narrowest panel: 240px below the lg breakpoint.
  await page.setViewportSize({ height: 800, width: 1000 });
  await gotoEditor(page);
  await loadTallSelection(page, {
    amplitude: 1_234_567,
    cycles: 2.5,
    kind: "wave",
  });

  const overlaps = await page
    .getByTestId("properties-panel-body")
    .locator("[data-slot='field-row']:has(> label)")
    .evaluateAll((rows) => {
      return rows.flatMap((row) => {
        const label = row.querySelector(":scope > label");
        const value = row.querySelector("[data-slot='scrub-slider'] .truncate");

        if (!(label && value)) {
          return [];
        }

        const gap =
          value.getBoundingClientRect().left -
          label.getBoundingClientRect().right;

        return gap < 0 ? [{ gap, label: label.textContent }] : [];
      });
    });

  await expect(page.getByRole("slider", { name: "Amplitude" })).toBeVisible();
  expect(overlaps).toEqual([]);
});
