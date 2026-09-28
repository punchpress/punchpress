import { expect, test } from "@playwright/test";
import { gotoEditor, resetViewport } from "./helpers/editor";

const getViewportZoom = (page) => {
  return page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.viewport.zoom || null;
  });
};

test("rapid Zoom In clicks apply every requested zoom step", async ({
  page,
}) => {
  await gotoEditor(page);
  await resetViewport(page);

  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  const box = await zoomIn.boundingBox();

  if (!box) {
    throw new Error("Missing Zoom In control");
  }

  for (let index = 0; index < 5; index += 1) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }

  await expect.poll(() => getViewportZoom(page)).toBeCloseTo(1.18 ** 5, 2);
});

test("trackpad pinch cannot zoom the browser page inside the editor shell", async ({
  page,
}) => {
  await gotoEditor(page);

  const prevented = await page.getByText("Layers", { exact: true }).evaluate(
    (element) =>
      !element.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: -12,
        })
      )
  );

  expect(prevented).toBe(true);
});

test("dragging the zoom percentage horizontally scrubs zoom", async ({
  page,
}) => {
  await gotoEditor(page);
  await resetViewport(page);

  const zoom = page.getByRole("slider", { name: "Canvas zoom" });
  const box = await zoom.boundingBox();

  if (!box) {
    throw new Error("Missing canvas zoom scrub control");
  }

  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 120, start.y, { steps: 8 });
  await page.mouse.up();

  await expect.poll(() => getViewportZoom(page)).toBeCloseTo(2, 2);
  await expect(zoom).toHaveAttribute("aria-valuenow", "200");
});
