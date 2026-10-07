import { expect, type Page, test } from "@playwright/test";
import { gotoEditor, loadDocument } from "./helpers/editor";

const SHAPE_ID = "panel-shape";

const PANEL_DOCUMENT = JSON.stringify({
  assets: {},
  nodes: [
    {
      appearance: {
        fills: [
          {
            enabled: true,
            id: "fill-1",
            opacity: 1,
            paint: { color: "#ff0000", kind: "solid" },
          },
        ],
        strokes: [],
      },
      cornerRadius: 0,
      height: 200,
      id: SHAPE_ID,
      opacity: 1,
      parentId: "root",
      shape: "polygon",
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 400, y: 300 },
      type: "shape",
      visible: true,
      width: 300,
    },
  ],
  version: "1.9",
});

const getAppearance = (page: Page) => {
  return page.evaluate((nodeId) => {
    return window.__PUNCHPRESS_EDITOR__?.getNode(nodeId)?.appearance;
  }, SHAPE_ID);
};

const selectShape = (page: Page) => {
  return page.evaluate((nodeId) => {
    window.__PUNCHPRESS_EDITOR__?.setSelectedNodes([nodeId]);
  }, SHAPE_ID);
};

test("adds, toggles, reorders, and removes layers through the panel", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, PANEL_DOCUMENT);
  await selectShape(page);

  const fills = page.getByTestId("appearance-fills");
  const strokes = page.getByTestId("appearance-strokes");

  await fills.getByRole("button", { name: "Add fill" }).click();
  await strokes.getByRole("button", { name: "Add stroke" }).click();

  await expect
    .poll(async () => {
      const appearance = await getAppearance(page);

      return [appearance?.fills.length, appearance?.strokes.length];
    })
    .toEqual([2, 1]);
  await expect(page.getByTestId("appearance-fills-item")).toHaveCount(2);

  // The top row is the topmost (last stored) fill.
  const topFill = page.getByTestId("appearance-fills-item").first();

  await expect(topFill).toHaveAttribute("data-layer-id", "fill-2");
  await topFill.getByRole("button", { name: "Hide fill" }).click();
  await expect
    .poll(async () => (await getAppearance(page))?.fills[1].enabled)
    .toBe(false);

  await page.keyboard.press("ControlOrMeta+z");
  await expect
    .poll(async () => (await getAppearance(page))?.fills[1].enabled)
    .toBe(true);

  const fillHandles = page
    .getByTestId("appearance-fills-item")
    .getByRole("button", { name: "Reorder fill" });
  const source = await fillHandles.first().boundingBox();
  const target = await fillHandles.last().boundingBox();

  if (!(source && target)) {
    throw new Error("Expected reorder handles");
  }

  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2 + 6,
    { steps: 8 }
  );
  await page.mouse.up();

  await expect
    .poll(async () => {
      return (await getAppearance(page))?.fills.map((layer) => layer.id);
    })
    .toEqual(["fill-2", "fill-1"]);

  // dnd-kit swallows clicks for a moment after a drop; a person cannot click
  // that fast, so let the guard expire before the next click.
  await page.waitForTimeout(150);

  await page
    .getByTestId("appearance-strokes-item")
    .getByRole("button", { name: "Remove stroke" })
    .click();
  await expect
    .poll(async () => (await getAppearance(page))?.strokes.length)
    .toBe(0);
});

test("removes a stroke without other panel interaction", async ({ page }) => {
  await gotoEditor(page);
  await loadDocument(page, PANEL_DOCUMENT);
  await selectShape(page);
  await page
    .getByTestId("appearance-strokes")
    .getByRole("button", { name: "Add stroke" })
    .click();
  await expect(page.getByTestId("appearance-strokes-item")).toHaveCount(1);
  await page
    .getByTestId("appearance-strokes-item")
    .getByRole("button", { name: "Remove stroke" })
    .click();
  await expect
    .poll(async () => (await getAppearance(page))?.strokes.length)
    .toBe(0);
});

test("a stroke width scrub is one undo step", async ({ page }) => {
  await gotoEditor(page);
  await loadDocument(page, PANEL_DOCUMENT);
  await selectShape(page);
  await page
    .getByTestId("appearance-strokes")
    .getByRole("button", { name: "Add stroke" })
    .click();

  const slider = page.getByRole("slider", { name: "Stroke width" });
  const box = await slider.boundingBox();

  if (!box) {
    throw new Error("Expected stroke width slider");
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();

  for (let step = 1; step <= 6; step += 1) {
    await page.mouse.move(
      box.x + box.width / 2 + step * 12,
      box.y + box.height / 2
    );
  }

  await page.mouse.up();

  const widened = (await getAppearance(page))?.strokes[0].width ?? 0;

  expect(widened).toBeGreaterThan(2);

  await page.keyboard.press("ControlOrMeta+z");
  await expect
    .poll(async () => (await getAppearance(page))?.strokes[0]?.width)
    .toBe(2);
});

test("differing stacks show Mixed until Use first copies the first stack", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, PANEL_DOCUMENT);
  await page.evaluate((nodeId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode(nodeId);

    editor?.insertNodes([
      {
        ...node,
        appearance: { fills: [], strokes: [] },
        id: "panel-shape-2",
        transform: { ...node.transform, x: 900 },
      },
    ]);
    editor?.setSelectedNodes([nodeId, "panel-shape-2"]);
  }, SHAPE_ID);

  await page.getByRole("button", { name: "Use first" }).click();
  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getNode("panel-shape-2")
          ?.appearance.fills[0]?.paint.color;
      });
    })
    .toBe("#ff0000");
  await expect(page.getByTestId("appearance-fills-item")).toHaveCount(1);
});
