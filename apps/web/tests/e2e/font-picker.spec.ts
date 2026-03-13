import { expect, test } from "@playwright/test";
import {
  createTextNode,
  gotoEditor,
  serializeDocument,
} from "./editor-helpers";

test("selecting a different local font updates the selected node", async ({
  page,
}) => {
  await gotoEditor(page);
  await createTextNode(page, { text: "FONT TEST", x: 420, y: 360 });
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

  await createTextNode(page, { text: "SECOND FONT", x: 620, y: 520 });

  await expect
    .poll(async () => {
      const document = JSON.parse(await serializeDocument(page));
      return document.nodes.at(-1)?.font?.fullName;
    })
    .toBe("PunchPress Sans");
});
