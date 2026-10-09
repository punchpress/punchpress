import { expect, type Page, test } from "@playwright/test";
import { gotoEditor, loadDocument } from "./helpers/editor";

const LONG_TEXT =
  "A very long layer name that keeps going well past the width of the layers panel";

const IDENTITY = { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 };

// Root > Outer group > Inner group > long-named text: three indent levels.
const createNestedDocument = () =>
  JSON.stringify({
    nodes: [
      {
        id: "outer",
        name: "Outer",
        parentId: "root",
        transform: IDENTITY,
        type: "group",
        visible: true,
      },
      {
        id: "inner",
        name: "Inner",
        parentId: "outer",
        transform: IDENTITY,
        type: "group",
        visible: true,
      },
      {
        fill: "#000000",
        font: {
          family: "Arial",
          fullName: "Arial",
          postscriptName: "ArialMT",
          style: "Regular",
        },
        fontSize: 24,
        id: "long-text",
        parentId: "inner",
        stroke: null,
        strokeWidth: 0,
        text: LONG_TEXT,
        tracking: 0,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 300, y: 300 },
        type: "text",
        visible: true,
        warp: { kind: "none" },
      },
    ],
    version: "1.8",
  });

const measureLayerRows = (page: Page) => {
  return page.getByTestId("layers-list").evaluate((list) => {
    const rootStyle = getComputedStyle(document.documentElement);
    const listRight = list.getBoundingClientRect().right;
    const rows = [...list.querySelectorAll("[data-layer-row-id]")];

    return {
      indent: Number.parseFloat(rootStyle.getPropertyValue("--layer-indent")),
      rowHeight: Number.parseFloat(
        rootStyle.getPropertyValue("--layer-row-height")
      ),
      rows: rows.map((row) => {
        const rect = row.getBoundingClientRect();
        const icon = row
          .querySelector("[data-layer-node-id] svg")
          ?.getBoundingClientRect();
        const label = row.querySelector("[data-layer-node-id] span:last-child");

        return {
          height: rect.height,
          iconLeft: icon?.left ?? Number.NaN,
          id: row.getAttribute("data-layer-row-id"),
          labelTruncated: label ? label.scrollWidth > label.clientWidth : null,
          overflow: Math.max(
            rect.right - listRight,
            ...[...row.querySelectorAll("*")].map(
              (child) => child.getBoundingClientRect().right - rect.right
            )
          ),
          scrollOverflow: row.scrollWidth - row.clientWidth,
        };
      }),
    };
  });
};

test("layer rows use the row token, indent per level, and truncate long names", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, createNestedDocument());
  await expect(page.getByRole("button", { name: LONG_TEXT })).toBeVisible();

  const { indent, rowHeight, rows } = await measureLayerRows(page);
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));

  expect(rowHeight).toBeGreaterThan(0);
  expect(rows.map((row) => row.id)).toEqual(["outer", "inner", "long-text"]);

  for (const row of rows) {
    expect(row.height, `${row.id} height`).toBeCloseTo(rowHeight, 1);
    expect(row.overflow, `${row.id} overflow`).toBeLessThanOrEqual(0.5);
    expect(row.scrollOverflow, `${row.id} scroll overflow`).toBe(0);
  }

  expect(byId.inner.iconLeft - byId.outer.iconLeft).toBeCloseTo(indent, 1);
  expect(byId["long-text"].iconLeft - byId.inner.iconLeft).toBeCloseTo(
    indent,
    1
  );
  expect(byId["long-text"].labelTruncated).toBe(true);
});

// Selected rows are a quiet accent tint under normal text, distinct from
// hovered rows, and they still shift on hover. A hidden selected row keeps the
// tint but dims its label. The canvas selection keeps the saturated accent.
test("selected rows use a quiet tint that reads against hover and hidden rows", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, createNestedDocument());
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.setSelectedNodes(["outer"]);
  });

  const row = (id: string) => page.locator(`[data-layer-row-id='${id}']`);
  const read = (id: string) => {
    return row(id).evaluate((element) => {
      const label = element.querySelector(
        "[data-layer-node-id] span:last-child"
      );

      return {
        background: getComputedStyle(element).backgroundColor,
        color: getComputedStyle(element).color,
        labelColor: label ? getComputedStyle(label).color : null,
      };
    });
  };
  const { accent, foreground } = await page.evaluate(() => {
    const probe = window.document.createElement("div");

    probe.style.backgroundColor = "var(--canvas-selected)";
    window.document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;

    probe.remove();
    return {
      accent: color,
      foreground: getComputedStyle(window.document.body).color,
    };
  });

  await expect(row("outer")).toHaveAttribute("data-selected", "");
  await page.mouse.move(640, 700);
  const selected = await read("outer");

  expect(selected.background).not.toBe(accent);
  expect(selected.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(selected.color).toBe(foreground);

  await row("long-text").hover();
  const hovered = await read("long-text");

  expect(hovered.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(hovered.background).not.toBe(selected.background);

  await row("outer").hover();
  expect((await read("outer")).background).not.toBe(selected.background);

  await page.mouse.move(640, 700);
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.toggleVisibility("outer");
  });
  await expect(row("outer")).toHaveAttribute("data-muted", "");
  await expect(row("outer")).toHaveAttribute("data-selected", "");
  const hiddenSelected = await read("outer");

  expect(hiddenSelected.background).toBe(selected.background);
  expect(hiddenSelected.labelColor).not.toBe(selected.labelColor);
});
