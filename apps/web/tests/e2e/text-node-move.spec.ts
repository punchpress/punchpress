import { test } from "@playwright/test";
import {
  createTextNode,
  expectCoordinateShift,
  expectRectShift,
  gotoEditor,
  moveSelectedNodeBy,
  pauseForUi,
  waitForNodeReady,
} from "./editor-helpers";

test("moves a text node around the canvas", async ({ page }) => {
  await gotoEditor(page);

  const nodeId = await createTextNode(page, {
    text: "Move me",
    x: 600,
    y: 450,
  });

  const before = await waitForNodeReady(page, nodeId);
  await pauseForUi(page);

  await moveSelectedNodeBy(page, { x: 140, y: 80 });
  await pauseForUi(page);

  const after = await waitForNodeReady(page, nodeId);

  expectCoordinateShift(before, after, { x: 140, y: 80 });
  expectRectShift(before.elementRect, after.elementRect, { x: 140, y: 80 });
});
