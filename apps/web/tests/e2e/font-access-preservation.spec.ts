import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const FONT_PATH = [
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
].find((candidate) => existsSync(candidate));
const FONT_BYTES = FONT_PATH ? [...readFileSync(FONT_PATH)] : [];
const INTENDED_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
};
const REPLACEMENT_FONT = {
  family: "Fixture Sans",
  fullName: "Fixture Sans",
  postscriptName: "FixtureSans-Regular",
  style: "Regular",
};
const FIXTURE_PATH = new URL(
  "./fixtures/documents/font-access.punch",
  import.meta.url
).pathname;

test("preserves saved font through access changes and explicit replacement", async ({
  page,
}) => {
  test.skip(!FONT_PATH, "A local test font file is required.");

  await page.addInitScript(
    ({ bytes, fonts }) => {
      Reflect.set(window, "__b17FontsAllowed", false);
      Reflect.deleteProperty(window, "showOpenFilePicker");
      Object.defineProperty(window, "queryLocalFonts", {
        value: () =>
          Promise.resolve(
            Reflect.get(window, "__b17FontsAllowed")
              ? fonts.map((font) => ({
                  ...font,
                  blob: () =>
                    Promise.resolve(
                      new Blob([new Uint8Array(bytes)], { type: "font/ttf" })
                    ),
                }))
              : []
          ),
      });
    },
    { bytes: FONT_BYTES, fonts: [INTENDED_FONT, REPLACEMENT_FONT] }
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Open main menu" }).click();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "Open Command O" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(FIXTURE_PATH);

  const savedFont = () =>
    page.evaluate(() => {
      const contents = window.__PUNCHPRESS_EDITOR__?.serializeDocument();
      return contents
        ? (JSON.parse(contents).nodes.find(
            (node) => node.id === "font-access-node"
          )?.font ?? null)
        : null;
    });
  await expect.poll(savedFont).toEqual(INTENDED_FONT);
  await expect(
    page.locator('[data-node-id="font-access-node"] text')
  ).toBeVisible();
  const serializedBeforeAccess = await page.evaluate(() =>
    window.__PUNCHPRESS_EDITOR__?.serializeDocument()
  );

  await page.getByRole("button", { name: "FONT", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.selectedNodeId)
    )
    .toBe("font-access-node");
  await expect(
    page.getByText(
      "Enable local font access to render this saved font accurately."
    )
  ).toBeVisible();

  const demoDirectory = process.env.B17_DEMO_DIR;
  if (demoDirectory) {
    mkdirSync(demoDirectory, { recursive: true });
    await page.screenshot({
      path: join(demoDirectory, "font-access-before.png"),
    });
  }

  await page.getByRole("button", { name: "Open main menu" }).click();
  await page.getByRole("menuitem", { name: "Export Command E" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Can't export while fonts are unavailable",
    })
  ).toBeVisible();
  if (demoDirectory) {
    await page.waitForTimeout(300);
    await page.screenshot({
      path: join(demoDirectory, "font-access-export-blocked.png"),
    });
  }
  await page.getByRole("button", { name: "OK" }).click();

  await page.evaluate(() => {
    Reflect.set(window, "__b17FontsAllowed", true);
    return window.__PUNCHPRESS_EDITOR__?.requestLocalFonts();
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__PUNCHPRESS_EDITOR__?.getNodeRenderGeometry(
            "font-access-node"
          )?.ready
      )
    )
    .toBe(true);
  await expect(
    page.locator('[data-node-id="font-access-node"] text')
  ).toHaveCount(0);
  expect(await savedFont()).toEqual(INTENDED_FONT);
  expect(
    await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.serializeDocument())
  ).toBe(serializedBeforeAccess);

  if (demoDirectory) {
    await page.screenshot({
      path: join(demoDirectory, "font-access-restored.png"),
    });
  }

  await page.getByRole("button", { name: "Arial" }).click();
  await page.getByPlaceholder("Search fonts").fill("Fixture Sans");
  await page.getByRole("button", { name: "Fixture Sans" }).click();
  await expect.poll(savedFont).toEqual(REPLACEMENT_FONT);

  if (demoDirectory) {
    await page.screenshot({
      path: join(demoDirectory, "font-access-replaced.png"),
    });
  }
});
