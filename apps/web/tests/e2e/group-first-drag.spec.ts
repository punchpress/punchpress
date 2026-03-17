import { expect, test } from "@playwright/test";
import {
  dragNodeBy,
  expectCoordinateShift,
  getSelectionSnapshot,
  gotoEditor,
  loadDocumentFixture,
  waitForNodeReady,
} from "./helpers/editor";

test("first drag on grouped content moves the group immediately", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "group-basic.punch");

  const firstNodeId = "basic-group-first-node";
  const groupNodeId = "basic-group-node";
  const secondNodeId = "basic-group-second-node";

  const beforeFirst = await waitForNodeReady(page, firstNodeId);
  const beforeSecond = await waitForNodeReady(page, secondNodeId);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([]);

  await dragNodeBy(page, firstNodeId, { x: 120, y: 80 });

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([groupNodeId]);

  const afterFirst = await waitForNodeReady(page, firstNodeId);
  const afterSecond = await waitForNodeReady(page, secondNodeId);

  expectCoordinateShift(beforeFirst, afterFirst, { x: 120, y: 80 });
  expectCoordinateShift(beforeSecond, afterSecond, { x: 120, y: 80 });
});
