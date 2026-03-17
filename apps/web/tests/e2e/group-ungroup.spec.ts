import { expect, test } from "@playwright/test";
import { clickNodeCenter } from "./helpers/canvas";
import {
  getDebugDump,
  getSelectionSnapshot,
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
  waitForNodeReady,
} from "./helpers/editor";

test("ungroup shortcut removes the group and reselects its children", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "group-basic.punch");

  const firstNodeId = "basic-group-first-node";
  const groupNodeId = "basic-group-node";
  const secondNodeId = "basic-group-second-node";

  await waitForNodeReady(page, firstNodeId);
  await waitForNodeReady(page, secondNodeId);
  await clickNodeCenter(page, firstNodeId);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([groupNodeId]);

  await page.keyboard.press("Meta+Shift+G");
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([firstNodeId, secondNodeId]);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        childParentIds: dump?.nodes
          ?.filter((node) => {
            return node.id === firstNodeId || node.id === secondNodeId;
          })
          .map((node) => node.parentId),
        groupExists: dump?.nodes?.some((node) => node.id === groupNodeId),
      };
    })
    .toEqual({
      childParentIds: ["root", "root"],
      groupExists: false,
    });

  await expect(page.locator("[data-node-id]")).toHaveCount(2);
});
