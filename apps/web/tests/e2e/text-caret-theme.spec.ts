import { expect, test } from "@playwright/test";
import { gotoEditor, pauseForUi } from "./helpers/editor";

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
        mixBlendMode: styles.mixBlendMode,
      };
    });
  const editingSelectionStyles = await page
    .locator(".canvas-edit-selection")
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
  expect(customCaretStyles).toEqual({
    backgroundColor: "rgb(255, 255, 255)",
    mixBlendMode: "difference",
  });
  expect(editingSelectionStyles).toEqual({
    borderTopWidth: "0px",
    outlineStyle: "solid",
  });
  expect(inputBlendMode).toBe("normal");
});

test("uses the same caret blend source in light mode", async ({
  page,
}) => {
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
        mixBlendMode: styles.mixBlendMode,
      };
    });

  expect(customCaretStyles).toEqual({
    backgroundColor: "rgb(255, 255, 255)",
    mixBlendMode: "difference",
  });
});
