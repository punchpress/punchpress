import { expect, type Page, test } from "@playwright/test";
import { gotoEditor, loadDocument } from "./helpers/editor";

const SHAPE_ID = "panel-shape";

const solidAppearance = (color: string) => ({
  fills: [
    {
      enabled: true,
      id: "fill-1",
      opacity: 1,
      paint: { color, kind: "solid" },
    },
  ],
  strokes: [],
});

const transform = (x: number, y: number) => ({
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  x,
  y,
});

const corner = (x: number, y: number) => ({
  handleIn: { x: 0, y: 0 },
  handleOut: { x: 0, y: 0 },
  point: { x, y },
  pointType: "corner",
});

const shape = (id: string, parentId: string, x: number) => ({
  appearance: solidAppearance("#ff0000"),
  cornerRadius: 0,
  height: 200,
  id,
  opacity: 1,
  parentId,
  shape: "polygon",
  transform: transform(x, 300),
  type: "shape",
  visible: true,
  width: 300,
});

const PANEL_DOCUMENT = JSON.stringify({
  assets: {},
  nodes: [
    shape(SHAPE_ID, "root", 400),
    {
      id: "panel-group",
      name: "Group",
      opacity: 1,
      parentId: "root",
      transform: transform(0, 0),
      type: "group",
      visible: true,
    },
    shape("group-shape", "panel-group", 900),
    {
      id: "panel-vector",
      name: "Vector",
      opacity: 1,
      parentId: "root",
      transform: transform(0, 0),
      type: "vector",
      visible: true,
    },
    {
      appearance: solidAppearance("#0000ff"),
      contours: [
        {
          closed: true,
          segments: [corner(0, 0), corner(120, 0), corner(120, 80)],
        },
      ],
      fillRule: "nonzero",
      id: "vector-path",
      opacity: 1,
      parentId: "panel-vector",
      transform: transform(400, 700),
      type: "path",
      visible: true,
    },
  ],
  version: "1.12",
});

const getEffects = (page: Page, nodeId = SHAPE_ID) => {
  return page.evaluate((id) => {
    return window.__PUNCHPRESS_EDITOR__?.getNode(id)?.effects ?? [];
  }, nodeId);
};

const select = (page: Page, nodeId: string) => {
  return page.evaluate((id) => {
    window.__PUNCHPRESS_EDITOR__?.setSelectedNodes([id]);
  }, nodeId);
};

const dragBetween = async (page: Page, from, to) => {
  const source = await from.boundingBox();
  const target = await to.boundingBox();

  if (!(source && target)) {
    throw new Error("Expected drag endpoints");
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
};

test("adds, scrubs, toggles, reorders, and removes shadows through the panel", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, PANEL_DOCUMENT);
  await select(page, SHAPE_ID);

  const section = page.getByTestId("effects");
  const addEffect = section.getByRole("button", { name: "Add effect" });

  await addEffect.click();
  await expect
    .poll(async () => {
      const [effect] = await getEffects(page);

      return effect && [effect.x, effect.y, effect.blur, effect.color];
    })
    .toEqual([8, 8, 0, "#000000"]);

  // A full X scrub is one undo step.
  const slider = page.getByRole("slider", { name: "Shadow X" });
  const box = await slider.boundingBox();

  if (!box) {
    throw new Error("Expected shadow X slider");
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
  expect((await getEffects(page))[0].x).toBeGreaterThan(8);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await getEffects(page))[0]?.x).toBe(8);

  const items = page.getByTestId("effects-item");

  await items.first().getByRole("button", { name: "Hide effect" }).click();
  await expect
    .poll(async () => (await getEffects(page))[0].enabled)
    .toBe(false);
  await items.first().getByRole("button", { name: "Show effect" }).click();
  await expect.poll(async () => (await getEffects(page))[0].enabled).toBe(true);

  await addEffect.click();
  await expect(items).toHaveCount(2);
  // Rows follow paint order: the first row is the first stored shadow.
  await expect(items.first()).toHaveAttribute("data-effect-id", "shadow-1");

  const handles = items.getByRole("button", { name: "Reorder effect" });

  await dragBetween(page, handles.first(), handles.last());
  await expect
    .poll(async () => (await getEffects(page)).map((effect) => effect.id))
    .toEqual(["shadow-2", "shadow-1"]);

  // dnd-kit swallows clicks for a moment after a drop; wait like a person.
  await page.waitForTimeout(150);
  await items.first().getByRole("button", { name: "Remove effect" }).click();
  await expect
    .poll(async () => (await getEffects(page)).map((effect) => effect.id))
    .toEqual(["shadow-1"]);

  await page.keyboard.press("ControlOrMeta+z");
  await expect(items).toHaveCount(2);
});

test("disables Add effect at four shadows", async ({ page }) => {
  await gotoEditor(page);
  await loadDocument(page, PANEL_DOCUMENT);
  await select(page, SHAPE_ID);

  const addEffect = page
    .getByTestId("effects")
    .getByRole("button", { name: "Add effect" });

  for (let count = 0; count < 4; count += 1) {
    await addEffect.click();
  }

  await expect(page.getByTestId("effects-item")).toHaveCount(4);
  await expect(addEffect).toBeDisabled();
});

test("a group selection shows Effects and writes to the group", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, PANEL_DOCUMENT);
  await select(page, "panel-group");

  await page
    .getByTestId("effects")
    .getByRole("button", { name: "Add effect" })
    .click();
  await expect
    .poll(async () => (await getEffects(page, "panel-group")).length)
    .toBe(1);
  expect(await getEffects(page, "group-shape")).toEqual([]);
});

test("a path inside a vector adds the shadow to the vector", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, PANEL_DOCUMENT);
  await select(page, "vector-path");

  await page
    .getByTestId("effects")
    .getByRole("button", { name: "Add effect" })
    .click();
  await expect
    .poll(async () => (await getEffects(page, "panel-vector")).length)
    .toBe(1);
  expect(await getEffects(page, "vector-path")).toEqual([]);
});

test("differing stacks show Mixed until Use first copies the first stack", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, PANEL_DOCUMENT);
  await select(page, SHAPE_ID);
  await page
    .getByTestId("effects")
    .getByRole("button", { name: "Add effect" })
    .click();
  await page.evaluate((nodeId) => {
    window.__PUNCHPRESS_EDITOR__?.setSelectedNodes([nodeId, "panel-group"]);
  }, SHAPE_ID);

  await page
    .getByTestId("effects")
    .getByRole("button", { name: "Use first" })
    .click();
  await expect
    .poll(async () => (await getEffects(page, "panel-group")).length)
    .toBe(1);
  await expect(page.getByTestId("effects-item")).toHaveCount(1);
});
