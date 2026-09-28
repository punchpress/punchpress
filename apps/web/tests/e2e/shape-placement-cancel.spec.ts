import { expect, test } from "@playwright/test";
import { getStateSnapshot, gotoEditor } from "./helpers/editor";

const getCanvasStagePoint = async (page, offset) => {
  const box = await page.getByTestId("canvas-stage").boundingBox();

  if (!box) {
    throw new Error("Missing canvas stage");
  }

  return {
    x: box.x + offset.x,
    y: box.y + offset.y,
  };
};

test.describe("shape placement cancellation", () => {
  test("Escape cancels a held placement before release and leaves later placement usable", async ({
    page,
  }, testInfo) => {
    await gotoEditor(page);
    await page.screenshot({ path: testInfo.outputPath("before.png") });
    await page.keyboard.press("r");

    const start = await getCanvasStagePoint(page, { x: 300, y: 160 });
    const end = await getCanvasStagePoint(page, { x: 540, y: 340 });

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.screenshot({ path: testInfo.outputPath("mid-placement.png") });

    await page.keyboard.press("Escape");
    await expect
      .poll(() => getStateSnapshot(page))
      .toMatchObject({
        activeTool: "pointer",
        nodes: [],
      });
    const repeatedEscapePrevented = await page.evaluate(() => {
      const event = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Escape",
      });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(repeatedEscapePrevented).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath("after-escape-before-release.png"),
    });
    await page.mouse.up();
    await page.screenshot({ path: testInfo.outputPath("after-release.png") });

    await expect
      .poll(() => getStateSnapshot(page))
      .toMatchObject({
        activeTool: "pointer",
        nodes: [],
      });
    expect(
      await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.canUndo)
    ).toBe(false);

    await page.keyboard.press("r");
    const followUpPoint = await getCanvasStagePoint(page, { x: 700, y: 420 });
    await page.mouse.click(followUpPoint.x, followUpPoint.y);

    await expect
      .poll(async () => {
        const state = await getStateSnapshot(page);
        const shape = state.nodes.find((node) => node.type === "shape");

        return {
          activeTool: state.activeTool,
          count: state.nodes.length,
          type: shape?.type ?? null,
        };
      })
      .toEqual({
        activeTool: "pointer",
        count: 1,
        type: "shape",
      });
    await page.screenshot({ path: testInfo.outputPath("after-follow-up.png") });
  });
});
