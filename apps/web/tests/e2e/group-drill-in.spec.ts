import { expect, test } from "@playwright/test";
import {
  clickEmptyCanvas,
  clickNodeCenter,
  doubleClickNodeCenter,
} from "./helpers/canvas";
import {
  getDebugDump,
  getSelectionSnapshot,
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
} from "./helpers/editor";

test("double-clicking grouped content drills into the group and allows child selection", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "group-basic.punch");

  const firstNodeId = "basic-group-first-node";
  const groupNodeId = "basic-group-node";
  const secondNodeId = "basic-group-second-node";

  await clickNodeCenter(page, firstNodeId);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([groupNodeId]);

  await doubleClickNodeCenter(page, firstNodeId);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        focusedGroupId: dump?.editing?.focusedGroupId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      focusedGroupId: groupNodeId,
      selectedNodeIds: [firstNodeId],
    });

  await clickNodeCenter(page, secondNodeId);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        focusedGroupId: dump?.editing?.focusedGroupId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      focusedGroupId: groupNodeId,
      selectedNodeIds: [secondNodeId],
    });

  await page.keyboard.press("Escape");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        focusedGroupId: dump?.editing?.focusedGroupId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      focusedGroupId: null,
      selectedNodeIds: [groupNodeId],
    });

  await clickNodeCenter(page, firstNodeId);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([groupNodeId]);

  await clickEmptyCanvas(page);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        focusedGroupId: dump?.editing?.focusedGroupId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      focusedGroupId: null,
      selectedNodeIds: [],
    });

  await clickNodeCenter(page, firstNodeId);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([groupNodeId]);

  await page.keyboard.press("Escape");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return dump?.editing?.focusedGroupId || null;
    })
    .toBeNull();

  await clickNodeCenter(page, firstNodeId);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([groupNodeId]);
});
