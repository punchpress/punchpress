import { expect, test } from "@playwright/test";
import { clickNodeCenter, doubleClickNodeCenter } from "./helpers/canvas";
import { gotoEditor, loadDocument, pauseForUi } from "./helpers/editor";

const STROKED_TEXT_DOCUMENT = {
  nodes: [
    {
      fill: "#ffffff",
      font: {
        family: "Arial",
        fullName: "Arial",
        postscriptName: "ArialMT",
        style: "Regular",
      },
      fontSize: 220,
      id: "stroked-text-node",
      parentId: "root",
      stroke: "#000000",
      strokeWidth: 12,
      text: "TEST",
      tracking: 10,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 420,
        y: 260,
      },
      type: "text",
      visible: true,
      warp: {
        bend: 0.4,
        kind: "arch",
      },
    },
  ],
  version: "1.7",
} as const;

test("uses a visible caret color in dark mode while editing text", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("punchpress-theme", "dark");
  });

  await gotoEditor(page);

  await page.getByRole("button", { name: "Text (T)" }).click();
  await pauseForUi(page);

  await page.getByTestId("canvas-stage").click({
    position: { x: 400, y: 300 },
  });
  await pauseForUi(page);

  const textInput = page.getByTestId("canvas-text-input");
  await expect(textInput).toBeVisible();

  const nativeCaretColor = await textInput.evaluate((element) => {
    return window.getComputedStyle(element).caretColor;
  });
  const customCaretStyles = await page
    .getByTestId("canvas-text-caret")
    .evaluate((element) => {
      const styles = window.getComputedStyle(element);

      return {
        backgroundColor: styles.backgroundColor,
        boxShadow: styles.boxShadow,
        mixBlendMode: styles.mixBlendMode,
        width: styles.width,
      };
    });
  const inputCursor = await textInput.evaluate((element) => {
    return window.getComputedStyle(element).cursor;
  });
  const editingSelectionStyles = await page
    .locator(".canvas-shape-indicator")
    .evaluate((element) => {
      const styles = window.getComputedStyle(element);

      return {
        borderTopWidth: styles.borderTopWidth,
        outlineStyle: styles.outlineStyle,
      };
    });
  const inputBlendMode = await textInput.evaluate((element) => {
    return window.getComputedStyle(element).mixBlendMode;
  });

  expect(nativeCaretColor).toBe("rgba(0, 0, 0, 0)");
  expect(customCaretStyles.backgroundColor).toBe("rgb(17, 17, 17)");
  expect(customCaretStyles.boxShadow).not.toBe("none");
  expect(customCaretStyles.mixBlendMode).toBe("normal");
  expect(customCaretStyles.width).toBe("1px");
  expect(inputCursor).toContain("data:image/svg+xml");
  expect(editingSelectionStyles).toEqual({
    borderTopWidth: "0px",
    outlineStyle: "solid",
  });
  expect(inputBlendMode).toBe("normal");
});

test("uses the same caret blend source in light mode", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("punchpress-theme", "light");
  });

  await gotoEditor(page);

  await page.getByRole("button", { name: "Text (T)" }).click();
  await pauseForUi(page);

  await page.getByTestId("canvas-stage").click({
    position: { x: 400, y: 300 },
  });
  await pauseForUi(page);

  const textInput = page.getByTestId("canvas-text-input");
  await expect(textInput).toBeVisible();

  const customCaretStyles = await page
    .getByTestId("canvas-text-caret")
    .evaluate((element) => {
      const styles = window.getComputedStyle(element);

      return {
        backgroundColor: styles.backgroundColor,
        boxShadow: styles.boxShadow,
        mixBlendMode: styles.mixBlendMode,
        width: styles.width,
      };
    });

  expect(customCaretStyles.backgroundColor).toBe("rgb(17, 17, 17)");
  expect(customCaretStyles.boxShadow).not.toBe("none");
  expect(customCaretStyles.mixBlendMode).toBe("normal");
  expect(customCaretStyles.width).toBe("1px");
});

test("keeps stroked text paint order consistent between normal render and edit preview", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, JSON.stringify(STROKED_TEXT_DOCUMENT));
  await pauseForUi(page);

  const canvasPath = page.locator(
    '.canvas-node[data-node-id="stroked-text-node"] path'
  );
  await expect(canvasPath.first()).toBeVisible();

  const normalPaintOrder = await canvasPath.first().evaluate((element) => {
    return element.getAttribute("paint-order");
  });

  await clickNodeCenter(page, "stroked-text-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "stroked-text-node");
  await pauseForUi(page);

  const editPreviewPath = page
    .getByTestId("canvas-text-preview")
    .locator("path");
  await expect(editPreviewPath.first()).toBeVisible();
  const editPaintOrder = await editPreviewPath.first().evaluate((element) => {
    return element.getAttribute("paint-order");
  });

  expect(normalPaintOrder).toBe("fill stroke");
  expect(editPaintOrder).toBe(normalPaintOrder);
});
