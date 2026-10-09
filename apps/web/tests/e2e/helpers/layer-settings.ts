import type { Locator, Page } from "@playwright/test";

// Opens a fill, stroke, or shadow row's settings popover and returns it.
// `row` narrows the trigger when the panel holds several rows of a kind.
export const openLayerSettings = async (
  page: Page,
  title: "Fill" | "Shadow" | "Stroke",
  row: Locator | Page = page
) => {
  await row
    .getByRole("button", { name: `${title} settings` })
    .first()
    .click();

  return page.getByRole("dialog", { name: title });
};
