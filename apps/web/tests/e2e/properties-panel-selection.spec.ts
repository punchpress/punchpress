import { expect, test } from "@playwright/test";
import {
  getStateSnapshot,
  gotoEditor,
  loadDocumentFixture,
} from "./helpers/editor";

const selectNodes = (page, nodeIds) => {
  return page.evaluate((nextNodeIds) => {
    window.__PUNCHPRESS_EDITOR__?.setSelectedNodes(nextNodeIds);
  }, nodeIds);
};

const getSection = (page, title) => {
  return page.locator("section").filter({ hasText: title });
};

test("shows shape controls for a single selected shape node", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "properties-panel-selection.punch");
  await selectNodes(page, ["shape-node"]);

  await expect(getSection(page, "Shape")).toBeVisible();
  await expect(getSection(page, "Fill & Stroke")).toBeVisible();
  await expect(getSection(page, "Text")).toHaveCount(0);
});

test("shows only shared appearance controls for a mixed text and shape selection", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "properties-panel-selection.punch");
  await selectNodes(page, ["text-node", "shape-node"]);

  const fillSection = getSection(page, "Fill & Stroke");
  const fillInput = fillSection.getByRole("textbox").nth(0);

  await expect(getSection(page, "Shape")).toHaveCount(0);
  await expect(getSection(page, "Text")).toHaveCount(0);
  await expect(fillSection).toBeVisible();
  await expect(fillInput).toHaveAttribute("placeholder", "Mixed");

  await fillInput.fill("#123456");
  await fillInput.blur();

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);

      return state.nodes
        .filter((node) => {
          return node.id === "text-node" || node.id === "shape-node";
        })
        .map((node) => node.fill)
        .sort();
    })
    .toEqual(["#123456", "#123456"]);
});
