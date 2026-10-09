import { expect, type Locator, type Page, test } from "@playwright/test";
import { gotoEditor, loadDocumentFixture } from "./helpers/editor";

// Pro-density dialogs and the color picker must fit a small laptop window
// without clipping or inner scrolling.
const VIEWPORT = { height: 640, width: 1280 };

test.use({ viewport: VIEWPORT });

const expectFitsViewport = async (surface: Locator) => {
  await expect(surface).toBeVisible();
  const metrics = await surface.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    // Any box that scrolls or clips its content, on either axis. Deliberate
    // one-line truncation (text-overflow: ellipsis), screen-reader-only
    // text, and slider range inputs are allowed.
    const overflowing = [element, ...element.querySelectorAll("*")]
      .filter((node) => {
        const style = getComputedStyle(node);

        const visuallyHidden =
          node.clientWidth <= 1 ||
          (node instanceof HTMLInputElement && node.type === "range");

        return (
          !visuallyHidden &&
          style.textOverflow !== "ellipsis" &&
          (style.overflowX !== "visible" || style.overflowY !== "visible")
        );
      })
      .filter((node) => {
        return (
          node.scrollHeight > node.clientHeight + 1 ||
          node.scrollWidth > node.clientWidth + 1
        );
      })
      .map((node) => node.getAttribute("data-slot") ?? node.tagName);

    return {
      bottom: rect.bottom,
      left: rect.left,
      overflowing,
      right: rect.right,
      top: rect.top,
    };
  });

  expect(metrics.top).toBeGreaterThanOrEqual(0);
  expect(metrics.left).toBeGreaterThanOrEqual(0);
  expect(metrics.bottom).toBeLessThanOrEqual(VIEWPORT.height);
  expect(metrics.right).toBeLessThanOrEqual(VIEWPORT.width);
  expect(metrics.overflowing).toEqual([]);
};

const openMainMenuItem = async (page: Page, name: string) => {
  await page.getByRole("button", { name: "Open main menu" }).click();
  await page.getByRole("menuitem", { name }).click();
};

test("new file dialog fits a 1280x640 window", async ({ page }) => {
  await gotoEditor(page);
  await openMainMenuItem(page, "New");

  await expectFitsViewport(page.locator("[data-slot='dialog-popup']"));
});

test("settings dialog fits a 1280x640 window", async ({ page }) => {
  await gotoEditor(page);
  await openMainMenuItem(page, "Settings");

  await expectFitsViewport(page.locator("[data-slot='dialog-popup']"));
});

test("fill color picker fits a 1280x640 window", async ({ page }) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "color-picker-field.punch");
  await page.getByRole("button", { name: "Color" }).first().click();

  const swatch = page
    .getByTestId("appearance-fills-item")
    .first()
    .getByLabel("Hex color")
    .locator("xpath=..");
  const box = await swatch.boundingBox();

  if (!box) {
    throw new Error("Missing color swatch bounds");
  }

  await page.mouse.click(box.x + 14, box.y + box.height / 2);

  const popup = page
    .locator("[data-slot='popover-popup']")
    .filter({ has: page.locator("[data-slot='color-picker']") });

  await expectFitsViewport(popup);
});
