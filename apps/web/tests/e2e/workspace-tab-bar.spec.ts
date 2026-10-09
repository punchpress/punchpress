import { expect, type Page, test } from "@playwright/test";
import { gotoEditor } from "./helpers/editor";

const BAR_HEIGHT = 40;
const DESKTOP_LEFT_INSET = 88;
// Content centers on the bar; the desktop traffic lights match it.
const BAR_CENTER_Y = BAR_HEIGHT / 2;

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

  test("every tab, Scratchpad and active included, has dividers on both sides", async ({
    page,
  }) => {
    await gotoEditor(page);
    await addFileTab(page);
    await addFileTab(page);

    const borders = await page
      .locator("[data-slot='tab']")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            widths: [style.borderLeftWidth, style.borderRightWidth],
          };
        })
      );

    expect(borders.map((tab) => tab.widths)).toEqual([
      ["1px", "1px"],
      ["1px", "1px"],
      ["1px", "1px"],
    ]);
    // Neighbors share one hairline instead of doubling it.
    for (let index = 1; index < borders.length; index += 1) {
      expect(borders[index].left).toBe(borders[index - 1].right - 1);
    }
  });

  test("the Scratchpad home icon renders at 16px", async ({ page }) => {
    await gotoEditor(page);

    const icon = await page
      .locator("button[aria-label='Scratchpad'] svg")
      .boundingBox();

    expect(icon?.width).toBe(16);
    expect(icon?.height).toBe(16);
  });

  test("the new-tab button is a borderless control after the last divider", async ({
    page,
  }) => {
    await gotoEditor(page);
    const readLayout = () =>
      page.evaluate(() => {
        const tabs = [...document.querySelectorAll("[data-slot='tab']")];
        const last = tabs.at(-1);
        const button = document.querySelector("button[aria-label='New file']");
        const style = button ? getComputedStyle(button) : null;

        return {
          borders: style
            ? [
                style.borderTopWidth,
                style.borderRightWidth,
                style.borderBottomWidth,
                style.borderLeftWidth,
              ]
            : null,
          buttonLeft: button?.getBoundingClientRect().left,
          buttonSize: button?.getBoundingClientRect().height,
          lastRight: last?.getBoundingClientRect().right,
          lastRightBorder: last
            ? getComputedStyle(last).borderRightWidth
            : null,
          radius: style?.borderTopLeftRadius,
        };
      });

    // Scratchpad only, then after a file tab.
    const scratchpadOnly = await readLayout();
    expect(scratchpadOnly.buttonLeft).toBe((scratchpadOnly.lastRight ?? 0) + 6);
    await addFileTab(page);
    const layout = await readLayout();

    expect(layout.borders).toEqual(["0px", "0px", "0px", "0px"]);
    expect(layout.lastRightBorder).toBe("1px");
    expect(layout.buttonLeft).toBe((layout.lastRight ?? 0) + 6);
    expect(layout.buttonSize).toBe(24);
    expect(layout.radius).toBe("4px");
  });

  test("tab title, new-tab button, and scratchpad share one vertical center", async ({
    page,
  }) => {
    await gotoEditor(page);
    await addFileTab(page);

    const centers = [
      ...(await centerY(page, "[data-slot='tab-title']")),
      ...(await centerY(page, "[data-slot='tab-dirty-dot']")),
      ...(await centerY(page, "button[aria-label='New file'] svg")),
      ...(await centerY(page, "button[aria-label='Scratchpad'] svg")),
    ];

    expect(centers).toHaveLength(4);
    for (const center of centers) {
      expect(Math.abs(center - BAR_CENTER_Y)).toBeLessThanOrEqual(1);
    }
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
    expect(dotBox.width).toBeLessThanOrEqual(6);
    const colors = await tab.evaluate((element) => ({
      dot: getComputedStyle(
        element.querySelector("[data-slot='tab-dirty-dot']") as Element
      ).backgroundColor,
      title: getComputedStyle(
        element.querySelector("[data-slot='tab-title']") as Element
      ).color,
    }));
    // Muted, not the foreground ink.
    expect(colors.dot).not.toBe(colors.title);
    expect(colors.dot).not.toBe("rgb(0, 0, 0)");
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

  test("tabs fit their content within the width clamps and overflow scrolls", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 720, width: 1280 });
    await gotoEditor(page);
    await addFileTab(page);

    const measure = () =>
      fileTabs(page).evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element);
          const trigger = element.querySelector("[data-slot='tab-trigger']");
          const title = element.querySelector("[data-slot='tab-title']");
          const triggerStyle = trigger ? getComputedStyle(trigger) : null;

          return {
            contentWidth:
              Number.parseFloat(triggerStyle?.paddingLeft ?? "0") +
              (title?.scrollWidth ?? 0) +
              Number.parseFloat(triggerStyle?.paddingRight ?? "0") +
              Number.parseFloat(style.borderLeftWidth) +
              Number.parseFloat(style.borderRightWidth),
            maxWidth: style.maxWidth,
            minWidth: style.minWidth,
            width: element.getBoundingClientRect().width,
          };
        })
      );

    const [tab] = await measure();
    expect(tab.minWidth).toBe("96px");
    expect(tab.maxWidth).toBe("200px");
    // Content-fit: padding, title, and the reserved slot; no empty void.
    expect(Math.abs(tab.width - tab.contentWidth)).toBeLessThanOrEqual(1);
    expect(tab.width).toBeLessThan(200);

    await page.setViewportSize({ height: 720, width: 480 });
    for (let index = 0; index < 4; index += 1) {
      await addFileTab(page);
    }

    for (const { width } of await measure()) {
      expect(width).toBeGreaterThanOrEqual(96);
      expect(width).toBeLessThan(tab.width);
    }
    const overflow = await page
      .locator("[data-slot='tab']:has([data-slot='tab-title'])")
      .first()
      .locator("..")
      .evaluate((element) => ({
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
      const first = document.querySelector("[data-slot='tab']");
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
      ...(await centerY(page, "[data-slot='tab-dirty-dot']")),
      ...(await centerY(page, "button[aria-label='New file'] svg")),
      ...(await centerY(page, "button[aria-label='Scratchpad'] svg")),
    ];
    expect(centers).toHaveLength(4);
    for (const center of centers) {
      expect(Math.abs(center - BAR_CENTER_Y)).toBeLessThanOrEqual(1);
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
    // Scratchpad and file tabs opt out; the new-tab wrapper stays draggable.
    expect(regions.tabGroups.slice(0, 2)).toEqual(["no-drag", "no-drag"]);
    expect(regions.tabGroups[2]).not.toBe("no-drag");
    expect(regions.newFile).toEqual(["no-drag"]);
  });
});
