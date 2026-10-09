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

// Resolves CSS colors (any syntax) to opaque sRGB channels by painting each
// over a base, so translucent text and fills compare as they are seen.
const toRgb = (page: Page, colors: [string, string?][]) => {
  return page.evaluate((pairs) => {
    const canvas = window.document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    return pairs.map(([value, base]) => {
      if (!context) {
        return [0, 0, 0];
      }

      context.clearRect(0, 0, 1, 1);
      context.fillStyle = base ?? "#808080";
      context.fillRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    });
  }, colors);
};

const distance = (left: number[], right: number[]) => {
  return left.reduce((sum, channel, index) => {
    return sum + Math.abs(channel - right[index]);
  }, 0);
};

// Selected rows are a quiet accent tint under normal text, distinct from the
// pane, the accent, and hovered rows, and they shift on hover. A hidden
// selected row keeps the tint but dims its label. Checked in both themes.
for (const colorScheme of ["light", "dark"] as const) {
  test(`${colorScheme}: selected rows use a quiet tint that reads against hover and hidden rows`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
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
        const style = getComputedStyle(element);

        return {
          background: style.backgroundColor,
          color: style.color,
          labelColor: label ? getComputedStyle(label).color : "",
        };
      });
    };
    const theme = await page.evaluate(() => {
      const pane = window.document.querySelector("[data-layers-panel]");
      const probe = window.document.createElement("div");

      probe.style.color = "var(--canvas-selected)";
      window.document.body.append(probe);
      const accent = getComputedStyle(probe).color;

      probe.remove();
      return {
        accent,
        dark: window.document.documentElement.classList.contains("dark"),
        foreground: getComputedStyle(window.document.body).color,
        surface: pane ? getComputedStyle(pane).backgroundColor : "",
      };
    });

    expect(theme.dark).toBe(colorScheme === "dark");
    await expect(row("outer")).toHaveAttribute("data-selected", "");
    await page.mouse.move(640, 700);
    const selected = await read("outer");

    await row("long-text").hover();
    const hovered = await read("long-text");

    await row("outer").hover();
    const selectedHover = await read("outer");

    await page.mouse.move(640, 700);
    await page.evaluate(() => {
      window.__PUNCHPRESS_EDITOR__?.toggleVisibility("outer");
    });
    await expect(row("outer")).toHaveAttribute("data-muted", "");
    await expect(row("outer")).toHaveAttribute("data-selected", "");
    const hidden = await read("outer");

    const [
      accent,
      surface,
      foreground,
      selectedBg,
      selectedText,
      hoveredBg,
      selectedHoverBg,
      hiddenBg,
      selectedLabel,
      hiddenLabel,
    ] = await toRgb(page, [
      [theme.accent],
      [theme.surface],
      [theme.foreground, theme.surface],
      [selected.background, theme.surface],
      [selected.color, selected.background],
      [hovered.background, theme.surface],
      [selectedHover.background, theme.surface],
      [hidden.background, theme.surface],
      [selected.labelColor, selected.background],
      [hidden.labelColor, hidden.background],
    ]);

    // A visible tint, far from the saturated accent, under normal text.
    expect(distance(selectedBg, surface)).toBeGreaterThan(20);
    expect(distance(selectedBg, accent)).toBeGreaterThan(150);
    expect(selectedText).toEqual(foreground);
    expect(distance(selectedLabel, foreground)).toBeLessThan(8);
    // Selected, hovered, and selected-hover rows read as different states.
    expect(distance(selectedBg, hoveredBg)).toBeGreaterThan(15);
    expect(distance(selectedHoverBg, selectedBg)).toBeGreaterThan(8);
    // Hidden selected rows keep the tint and dim the label.
    expect(hiddenBg).toEqual(selectedBg);
    expect(distance(hiddenLabel, hiddenBg)).toBeLessThan(
      distance(selectedLabel, selectedBg) - 30
    );
  });
}
