import { expect, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocumentFixture,
  serializeDocument,
} from "./editor-helpers";

test("selecting a different local font updates the selected node", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "font-picker.punch");
  await page.getByRole("button", { name: "FONT TEST" }).first().click();
  const currentFont =
    JSON.parse(await serializeDocument(page)).nodes?.[0]?.font?.fullName ||
    "Arial";

  await page.getByRole("button", { name: currentFont }).click();
  await page.getByPlaceholder("Search fonts").fill("PunchPress Sans");
  await page.getByRole("button", { name: "PunchPress Sans" }).click();

  await expect
    .poll(async () => {
      const document = JSON.parse(await serializeDocument(page));
      return document.nodes[0]?.font?.fullName;
    })
    .toBe("PunchPress Sans");

  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.getByTestId("canvas-stage").click({
    position: { x: 260, y: 240 },
  });
  const textInput = page.getByTestId("canvas-text-input");
  await textInput.fill("SECOND FONT");
  await textInput.press("Enter");

  await expect
    .poll(async () => {
      const document = JSON.parse(await serializeDocument(page));
      return document.nodes.at(-1)?.font?.fullName;
    })
    .toBe("PunchPress Sans");
});
