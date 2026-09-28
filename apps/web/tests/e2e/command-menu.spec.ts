import { expect, test } from "@playwright/test";
import { gotoEditor } from "./helpers/editor";

const COMMAND_INPUT_PLACEHOLDER = "Type a command or search...";

const openCommandMenu = async (page) => {
  await page.keyboard.press("ControlOrMeta+K");

  const input = page.getByPlaceholder(COMMAND_INPUT_PLACEHOLDER);
  await expect(input).toBeVisible();
  return input;
};

test("command-menu dismissal paths reopen with an empty query", async ({
  page,
}) => {
  await gotoEditor(page);

  let input = await openCommandMenu(page);
  await input.fill("assets");
  await page.keyboard.press("ControlOrMeta+K");
  input = await openCommandMenu(page);
  await expect(input).toHaveValue("");

  await input.fill("assets");
  await page.keyboard.press("Escape");
  input = await openCommandMenu(page);
  await expect(input).toHaveValue("");

  await input.fill("assets");
  await expect(page.getByRole("dialog")).not.toHaveAttribute(
    "data-starting-style"
  );
  await page
    .locator('[data-slot="command-dialog-backdrop"]')
    .click({ position: { x: 4, y: 4 } });
  await expect(page.getByRole("dialog")).toBeHidden();
  input = await openCommandMenu(page);
  await expect(input).toHaveValue("");
});

test("selecting a command returns to a fresh command view", async ({
  page,
}) => {
  await gotoEditor(page);

  const input = await openCommandMenu(page);
  await input.fill("assets");
  await page.getByRole("option", { name: "Assets Open" }).click();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByPlaceholder(COMMAND_INPUT_PLACEHOLDER)).toHaveValue(
    ""
  );
});
