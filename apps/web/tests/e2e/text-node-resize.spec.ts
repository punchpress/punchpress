import { expect, test } from "@playwright/test";
import {
  createTextNode,
  expectHandleAlignedToNodeCorner,
  getSelectionSnapshot,
  gotoEditor,
  pauseForUi,
  scaleSelectedNodeBy,
  waitForNodeReady,
  waitForSelectionHandles,
  zoomIn,
} from "./editor-helpers";

test("resizes a text node and keeps the selection aligned through zoom", async ({
  page,
}) => {
  await gotoEditor(page);

  const nodeId = await createTextNode(page, {
    text: "Resize me",
    x: 600,
    y: 450,
  });

  const before = await waitForNodeReady(page, nodeId);
  await pauseForUi(page);

  await scaleSelectedNodeBy(page, { scale: 1.25 });
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const snapshot = await waitForNodeReady(page, nodeId);
      return {
        fontSize: snapshot.fontSize,
        height: snapshot.elementRect?.height ?? 0,
        width: snapshot.elementRect?.width ?? 0,
      };
    })
    .toMatchObject({
      fontSize: expect.any(Number),
      height: expect.any(Number),
      width: expect.any(Number),
    });

  const afterResize = await waitForNodeReady(page, nodeId);
  expect(afterResize.fontSize).toBeGreaterThan(before.fontSize);
  expect(afterResize.bbox.width).toBeGreaterThan(before.bbox.width);
  expect(afterResize.elementRect.width).toBeGreaterThan(
    before.elementRect.width
  );
  expect(afterResize.elementRect.height).toBeGreaterThan(
    before.elementRect.height
  );

  const selectionAtDefaultZoom = await waitForSelectionHandles(page);
  expectHandleAlignedToNodeCorner(
    selectionAtDefaultZoom.handles.nw,
    afterResize.elementRect,
    "nw"
  );
  expectHandleAlignedToNodeCorner(
    selectionAtDefaultZoom.handles.se,
    afterResize.elementRect,
    "se"
  );

  await zoomIn(page, 2);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).zoom)
    .toBeGreaterThan(1);

  const afterZoom = await waitForNodeReady(page, nodeId);
  const selectionAtZoom = await waitForSelectionHandles(page);

  expectHandleAlignedToNodeCorner(
    selectionAtZoom.handles.nw,
    afterZoom.elementRect,
    "nw"
  );
  expectHandleAlignedToNodeCorner(
    selectionAtZoom.handles.se,
    afterZoom.elementRect,
    "se"
  );
});
