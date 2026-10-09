import { expect, type Page, test } from "@playwright/test";
import { gotoEditor } from "./helpers/editor";

const BAR_HEIGHT = 40;
const DESKTOP_LEFT_INSET = 96;
// Electron trafficLightPosition y 16 plus half the 14px traffic light.
const TRAFFIC_LIGHT_CENTER_Y = 23;

const fileTabs = (page: Page) =>
  page.locator("[data-slot='tab']:has([data-slot='tab-title'])");

const addFileTab = async (page: Page) => {
  await page.getByRole("button", { name: "New file" }).click();
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
};

const centerY = (page: Page, selector: string) => {
  return page.locator(selector).evaluateAll((elements) => {
    return elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
  });
};

const readBarLayout = (page: Page) => {
  return page.evaluate(() => {
    const bar = document.querySelector("[data-titlebar]");
    const barRect = bar?.getBoundingClientRect();
    const active = document.querySelector("[data-slot='tab'][data-active]");
    const shell = document.querySelector("[data-editor-shell-root]");

    return {
      activeBg: active ? getComputedStyle(active).backgroundColor : null,
      bar: barRect
        ? { height: barRect.height, top: barRect.top, width: barRect.width }
        : null,
      barBg: bar ? getComputedStyle(bar).backgroundColor : null,
      canvasBg: shell ? getComputedStyle(shell).backgroundColor : null,
      tabs: [...document.querySelectorAll("[data-slot='tab']")].map(
        (element) => {
          const rect = element.getBoundingClientRect();
          return { height: rect.height, top: rect.top };
        }
      ),
    };
  });
};

test.describe("workspace tab bar", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`tabs are full-height segments and the active tab takes the canvas background (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ height: 720, width: 1280 });
      await gotoEditor(page);
      await addFileTab(page);
      const layout = await readBarLayout(page);

      expect(layout.bar).toEqual({ height: BAR_HEIGHT, top: 0, width: 1280 });
      expect(layout.tabs).toHaveLength(2);
      for (const tab of layout.tabs) {
        expect(tab).toEqual({ height: BAR_HEIGHT, top: 0 });
      }
      expect(layout.activeBg).toBe(layout.canvasBg);
      expect(layout.barBg).not.toBe(layout.canvasBg);
    });
  }

  test("tab title, new-tab button, and scratchpad share one vertical center", async ({
    page,
  }) => {
    await gotoEditor(page);
    await addFileTab(page);

    const [title] = await centerY(page, "[data-slot='tab-title']");
    const [plus] = await centerY(page, "button[aria-label='New file'] svg");
    const [scratchpad] = await centerY(
      page,
      "button[aria-label='Scratchpad'] svg"
    );

    expect(Math.abs(title - BAR_HEIGHT / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(plus - title)).toBeLessThanOrEqual(1);
    expect(Math.abs(scratchpad - title)).toBeLessThanOrEqual(1);
  });

  test("the dirty dot and close share the right slot without moving the title", async ({
    page,
  }) => {
    await gotoEditor(page);
    await addFileTab(page);

    const tab = fileTabs(page).first();
    const title = tab.locator("[data-slot='tab-title']");
    const dot = tab.locator("[data-slot='tab-dirty-dot']");
    const close = tab.locator("[data-slot='tab-close']");
    const opacity = (locator) =>
      locator.evaluate((element) => getComputedStyle(element).opacity);

    // Untitled tabs stay dirty until saved: the dot shows, close waits.
    await page.mouse.move(640, 400);
    await expect.poll(() => opacity(dot)).toBe("1");
    expect(await opacity(close)).toBe("0");
    const titleBefore = await title.boundingBox();
    const dotBox = await dot.boundingBox();
    const closeBox = await close.boundingBox();
    const tabBox = await tab.boundingBox();

    expect(
      Math.abs(dotBox.x + dotBox.width / 2 - (closeBox.x + closeBox.width / 2))
    ).toBeLessThanOrEqual(0.5);
    expect(dotBox.x).toBeGreaterThan(titleBefore.x + titleBefore.width);
    expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(
      tabBox.x + tabBox.width
    );

    await tab.hover();
    await expect.poll(() => opacity(close)).toBe("1");
    expect(await opacity(dot)).toBe("0");
    expect(await title.boundingBox()).toEqual(titleBefore);

    await close.click();
    const prompt = page.getByRole("dialog");
    await expect(prompt).toBeVisible();
    await prompt.getByRole("button", { name: "Cancel" }).click();
    await expect(prompt).toHaveCount(0);
    await expect(fileTabs(page)).toHaveCount(1);
  });

  test("tab widths clamp between the min and max and overflow scrolls", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 720, width: 1280 });
    await gotoEditor(page);
    await addFileTab(page);
    await addFileTab(page);

    const widths = () =>
      fileTabs(page).evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().width)
      );

    expect(await widths()).toEqual([200, 200]);

    await page.setViewportSize({ height: 720, width: 560 });
    for (let index = 0; index < 3; index += 1) {
      await addFileTab(page);
    }

    for (const width of await widths()) {
      expect(width).toBe(120);
    }
    const strip = page
      .locator("[data-slot='tab']:has([data-slot='tab-title'])")
      .first()
      .locator("..");
    const overflow = await strip.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
    await expect(
      page.getByRole("button", { name: "New file" })
    ).toBeInViewport();
  });

  test("focusing a tab makes it the active document", async ({ page }) => {
    await gotoEditor(page);
    await addFileTab(page);

    const scratchpad = page.getByRole("button", { name: "Scratchpad" });
    await scratchpad.click();
    await expect(scratchpad).toHaveAttribute("aria-current", "page");
    await expect(
      fileTabs(page).first().locator("[data-slot='tab-trigger']")
    ).not.toHaveAttribute("aria-current", "page");

    await fileTabs(page).first().locator("[data-slot='tab-trigger']").click();
    await expect(scratchpad).not.toHaveAttribute("aria-current", "page");
  });
});

test.describe("desktop title bar", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "electron", {
        configurable: true,
        value: { versions: { electron: "test" } },
      });
    });
  });

  test("tabs start after the traffic lights and center on them", async ({
    page,
  }) => {
    await gotoEditor(page);
    await addFileTab(page);

    const layout = await page.evaluate(() => {
      const strip = document.querySelector("[data-workspace-tabs]");
      const first = strip?.firstElementChild;
      const bar = document.querySelector("[data-titlebar]");

      return {
        barLeft: bar?.getBoundingClientRect().left,
        firstDivider: first ? getComputedStyle(first).borderLeftWidth : null,
        stripLeft: first?.getBoundingClientRect().left,
      };
    });

    expect(layout.barLeft).toBe(0);
    expect(layout.stripLeft).toBe(DESKTOP_LEFT_INSET);
    expect(layout.firstDivider).toBe("1px");

    const centers = [
      ...(await centerY(page, "[data-slot='tab-title']")),
      ...(await centerY(page, "button[aria-label='New file'] svg")),
      ...(await centerY(page, "button[aria-label='Scratchpad'] svg")),
    ];
    for (const center of centers) {
      expect(Math.abs(center - TRAFFIC_LIGHT_CENTER_Y)).toBeLessThanOrEqual(1);
    }
    for (const tab of (await readBarLayout(page)).tabs) {
      expect(tab).toEqual({ height: BAR_HEIGHT, top: 0 });
    }
  });

  test("empty bar space drags the window and tab controls opt out", async ({
    page,
  }) => {
    await gotoEditor(page);
    await addFileTab(page);

    const regions = await page.evaluate(() => {
      const region = (selector: string) =>
        [...document.querySelectorAll(selector)].map((element) =>
          getComputedStyle(element).getPropertyValue("app-region")
        );

      return {
        bar: region("[data-titlebar]"),
        newFile: region("button[aria-label='New file']"),
        strip: region("[data-workspace-tabs]"),
        tabGroups: region("[data-workspace-tabs] > div"),
      };
    });

    expect(regions.bar).toEqual(["drag"]);
    // app-region does not inherit; the strip just must not opt out of the bar.
    expect(regions.strip).not.toContain("no-drag");
    expect(regions.tabGroups).toEqual(["no-drag", "no-drag"]);
    expect(regions.newFile).toEqual(["no-drag"]);
  });
});
