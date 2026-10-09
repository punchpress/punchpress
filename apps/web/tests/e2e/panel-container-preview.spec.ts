import { expect, type Page, test } from "@playwright/test";
import { gotoEditor } from "./helpers/editor";

// Layout guarantees for every dev pane container direction. Remove with
// components/panel-container-preview once a direction is picked.
const CONTAINERS = ["floating", "refined", "docked", "inset"] as const;
const DOCKED = new Set(["docked", "inset"]);
const ARTBOARD_ID = "container-artboard";

const openWithContainer = async (page: Page, container: string) => {
  await page.addInitScript((value) => {
    window.localStorage.setItem("punchpress.panel-container-preview", value);
  }, container);
  await gotoEditor(page);
  await expect(page.locator("html")).toHaveAttribute(
    "data-panel-container",
    container
  );
};

const loadArtboard = (page: Page) => {
  return page.evaluate((id) => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.loadDocument(
      JSON.stringify({
        nodes: [
          {
            background: "#ffffff",
            height: 600,
            id,
            locked: false,
            name: "Artboard",
            parentId: "root",
            transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
            type: "artboard",
            visible: true,
            width: 800,
          },
        ],
        version: "1.8",
      })
    );
    editor?.setSelectedNodes([id]);
  }, ARTBOARD_ID);
};

const readLayout = (page: Page) => {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();

      return rect
        ? {
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            top: rect.top,
          }
        : null;
    };

    return {
      canvas: box(".canvas-host"),
      left: box("aside[data-side='left']"),
      right: box("aside[data-side='right']"),
      viewport: { height: window.innerHeight, width: window.innerWidth },
    };
  });
};

for (const container of CONTAINERS) {
  test(`${container}: panes and canvas fit the window`, async ({ page }) => {
    await page.setViewportSize({ height: 720, width: 1280 });
    await openWithContainer(page, container);
    await loadArtboard(page);
    await expect(page.locator("[data-properties-panel]")).toBeVisible();

    const { canvas, left, right, viewport } = await readLayout(page);

    if (!(canvas && left && right)) {
      throw new Error("Missing shell regions");
    }

    for (const region of [canvas, left, right]) {
      expect(region.left).toBeGreaterThanOrEqual(0);
      expect(region.top).toBeGreaterThanOrEqual(0);
      expect(region.right).toBeLessThanOrEqual(viewport.width);
      expect(region.bottom).toBeLessThanOrEqual(viewport.height);
    }

    // Panes start below the 40px tab bar.
    expect(left.top).toBeGreaterThanOrEqual(40);
    expect(right.top).toBeGreaterThanOrEqual(40);

    // Both sidebars share one width.
    expect(Math.round(left.right - left.left)).toBe(
      Math.round(right.right - right.left)
    );

    if (DOCKED.has(container)) {
      // Sidebars run edge to edge and full height; the canvas fills the gap.
      expect(left.left).toBe(0);
      expect(right.right).toBe(viewport.width);
      expect(left.bottom).toBe(viewport.height);
      expect(right.bottom).toBe(viewport.height);
      expect(Math.abs(canvas.left - left.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(canvas.right - right.left)).toBeLessThanOrEqual(1);
    } else {
      // Floating cards overlay a full-window canvas.
      expect(canvas).toEqual({
        bottom: viewport.height,
        left: 0,
        right: viewport.width,
        top: 0,
      });
      expect(left.left).toBeGreaterThan(0);
    }

    // The pane card follows the direction's tokens.
    const pane = await page
      .locator("[data-properties-panel]")
      .evaluate((element) => {
        const style = getComputedStyle(element);

        return { radius: style.borderTopLeftRadius, shadow: style.boxShadow };
      });

    expect(pane.radius).toBe(
      { docked: "0px", floating: "16px", inset: "0px", refined: "8px" }[
        container
      ]
    );
    expect(pane.shadow === "none").toBe(DOCKED.has(container));
  });

  test(`${container}: focusing an artboard centers it in the visible canvas`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 720, width: 1280 });
    await openWithContainer(page, container);
    await loadArtboard(page);
    await page.evaluate((id) => {
      window.__PUNCHPRESS_EDITOR__?.scheduleViewportFocus([id]);
    }, ARTBOARD_ID);

    const artboard = page.locator(
      `.canvas-host [data-artboard-body='${ARTBOARD_ID}']`
    );

    await expect(artboard).toBeVisible();
    await expect
      .poll(async () => {
        const [canvas, board] = await Promise.all([
          page.locator(".canvas-host").boundingBox(),
          artboard.boundingBox(),
        ]);

        if (!(canvas && board)) {
          return null;
        }

        return {
          dx: Math.round(
            board.x + board.width / 2 - (canvas.x + canvas.width / 2)
          ),
          dy: Math.round(
            board.y + board.height / 2 - (canvas.y + canvas.height / 2)
          ),
          inside:
            board.x >= canvas.x &&
            board.y >= canvas.y &&
            board.x + board.width <= canvas.x + canvas.width &&
            board.y + board.height <= canvas.y + canvas.height,
        };
      })
      .toMatchObject({ inside: true });

    const [canvas, board] = await Promise.all([
      page.locator(".canvas-host").boundingBox(),
      artboard.boundingBox(),
    ]);

    if (!(canvas && board)) {
      throw new Error("Missing canvas or artboard bounds");
    }

    expect(
      Math.abs(board.x + board.width / 2 - (canvas.x + canvas.width / 2))
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs(board.y + board.height / 2 - (canvas.y + canvas.height / 2))
    ).toBeLessThanOrEqual(2);
  });
}

test("docked sidebars collapse away below the md breakpoint", async ({
  page,
}) => {
  await page.setViewportSize({ height: 700, width: 700 });
  await openWithContainer(page, "docked");

  const { canvas, viewport } = await readLayout(page);

  await expect(page.locator("aside[data-side='left']")).toBeHidden();
  expect(canvas?.left).toBe(0);
  expect(canvas?.right).toBe(viewport.width);
});

test("the container switcher cycles with Alt+Shift+P", async ({ page }) => {
  await openWithContainer(page, "floating");
  await page.keyboard.press("Alt+Shift+KeyP");
  await expect(page.locator("html")).toHaveAttribute(
    "data-panel-container",
    "refined"
  );
  await page
    .getByTestId("panel-container-switcher")
    .getByRole("button", { name: "Inset" })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-panel-container",
    "inset"
  );
});

// Switching directions resizes the canvas without a window resize; discrete
// zoom must still keep the visible center fixed.
test("zoom keeps its center after switching to a docked direction", async ({
  page,
}) => {
  await page.setViewportSize({ height: 720, width: 1280 });
  await openWithContainer(page, "floating");
  await loadArtboard(page);
  await page
    .getByTestId("panel-container-switcher")
    .getByRole("button", { name: "Docked" })
    .click();

  const readCenter = () => {
    return page.evaluate(() => {
      return window.__PUNCHPRESS_EDITOR__?.getViewportCenter() ?? null;
    });
  };
  const before = await readCenter();

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.zoom))
    .not.toBe(1);

  const after = await readCenter();

  expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(1);
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(1);
});

for (const container of CONTAINERS) {
  test(`${container}: a tall properties pane scrolls to its last control`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 420, width: 1280 });
    await openWithContainer(page, container);
    await page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;

      editor?.loadDocument(
        JSON.stringify({
          nodes: [
            {
              fill: "#000000",
              font: {
                family: "Arial",
                fullName: "Arial",
                postscriptName: "ArialMT",
                style: "Regular",
              },
              fontSize: 120,
              id: "tall-text",
              parentId: "root",
              stroke: null,
              strokeWidth: 0,
              text: "TALL",
              tracking: 0,
              transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 380, y: 260 },
              type: "text",
              visible: true,
              warp: { bend: 0.3, kind: "arch" },
            },
          ],
          version: "1.8",
        })
      );
      editor?.setSelectedNodes(["tall-text"]);
      editor?.addStroke();
      editor?.addEffect("drop-shadow");
    });

    const body = page.getByTestId("properties-panel-body");
    const last = body.getByRole("button", { name: "Clear warp" });

    await expect(last).toBeAttached();
    expect(
      await body.evaluate((element) => {
        return element.scrollHeight > element.clientHeight;
      })
    ).toBe(true);
    await expect(last).not.toBeInViewport();
    await body.hover();
    await page.mouse.wheel(0, 4000);
    await expect(last).toBeInViewport({ ratio: 1 });
  });
}
