import { expect, type Page, test } from "@playwright/test";
import { gotoEditor } from "./helpers/editor";

// Dev-only UI font comparison. Remove with components/ui-font-preview once a
// font is picked.
const openWithFont = async (page: Page, font: string) => {
  await page.addInitScript((value) => {
    window.localStorage.setItem("punchpress.ui-font-preview", value);
  }, font);
  await gotoEditor(page);
  await expect(page.locator("html")).toHaveAttribute("data-ui-font", font);
};

const readTypography = (page: Page) => {
  return page.evaluate(() => {
    const read = (element: Element | null) => {
      if (!element) {
        return null;
      }

      const style = getComputedStyle(element);

      return {
        family: style.fontFamily.split(",")[0].replaceAll('"', ""),
        features: style.fontFeatureSettings,
        numeric: style.fontVariantNumeric,
      };
    };

    return {
      body: read(document.body),
      canvas: read(document.querySelector(".canvas-surface")),
    };
  });
};

test("each UI font applies to chrome and leaves the canvas alone", async ({
  page,
}) => {
  await openWithFont(page, "inter");

  expect(await readTypography(page)).toMatchObject({
    body: { family: "InterVariable", features: '"cv11", "ss01"' },
    canvas: { features: "normal" },
  });
  expect(
    await page.evaluate(async () => {
      await document.fonts.load("11px InterVariable");

      return document.fonts.check("11px InterVariable");
    })
  ).toBe(true);

  await page.keyboard.press("Alt+Shift+KeyF");
  await expect(page.locator("html")).toHaveAttribute("data-ui-font", "system");
  expect((await readTypography(page)).body?.family).toBe("-apple-system");

  await page
    .getByTestId("ui-font-switcher")
    .getByRole("button", { name: "Geist" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-ui-font", "geist");
  expect((await readTypography(page)).body).toMatchObject({
    family: "Geist Variable",
    features: "normal",
  });
  expect(
    await page.evaluate(() => {
      return window.localStorage.getItem("punchpress.ui-font-preview");
    })
  ).toBe("geist");
});

test("numeric fields use tabular figures", async ({ page }) => {
  await openWithFont(page, "inter");
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.loadDocument(
      JSON.stringify({
        nodes: [
          {
            appearance: { fills: [], strokes: [] },
            cornerRadius: 0,
            height: 200,
            id: "font-shape",
            opacity: 1,
            parentId: "root",
            shape: "polygon",
            transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 400, y: 300 },
            type: "shape",
            visible: true,
            width: 300,
          },
        ],
        version: "1.8",
      })
    );
    editor?.setSelectedNodes(["font-shape"]);
  });

  const width = page.getByRole("slider", { name: "Shape width" });

  await expect(width).toBeVisible();
  expect(
    await width
      .locator(".truncate")
      .evaluate((element) => getComputedStyle(element).fontVariantNumeric)
  ).toBe("tabular-nums");
});

// Google Fonts builds of Inter (Fontsource) strip cv11 and ss01; the full
// upstream build must render them differently from the defaults.
test("the Inter build carries its cv11 and ss01 alternates", async ({
  page,
}) => {
  await openWithFont(page, "inter");
  await page.evaluate(async () => {
    await document.fonts.load("60px InterVariable");

    for (const [index, features] of ["normal", '"cv11"', '"ss01"'].entries()) {
      const sample = document.createElement("div");

      sample.id = `font-sample-${index}`;
      sample.style.cssText = `position:fixed;top:${index * 90}px;left:0;z-index:9999;padding:4px;background:white;color:black;font:60px InterVariable;font-feature-settings:${features};letter-spacing:0`;
      sample.textContent = "a 1 4 6 9";
      document.body.append(sample);
    }
  });

  const [base, cv11, ss01] = await Promise.all(
    [0, 1, 2].map((index) => {
      return page.locator(`#font-sample-${index}`).screenshot();
    })
  );

  expect(base.equals(cv11)).toBe(false);
  expect(base.equals(ss01)).toBe(false);
});
