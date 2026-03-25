import { expect, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocumentFixture,
  waitForNodeReady,
} from "./helpers/editor";

const getNodeCursor = (page, nodeId) => {
  return page.locator(`[data-node-id="${nodeId}"]`).evaluate((element) => {
    return window.getComputedStyle(element).cursor;
  });
};

const getCursorAtPoint = (page, point) => {
  return page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return element ? window.getComputedStyle(element).cursor : null;
  }, point);
};

const getLocatorCursor = (locator) => {
  return locator.evaluate((element) => {
    return window.getComputedStyle(element).cursor;
  });
};

test("uses pointer for unselected hover and grab for selected hover", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "hover-preview.punch");
  const nodeId = "hover-node";
  await waitForNodeReady(page, nodeId);

  const node = page.locator(`[data-node-id="${nodeId}"]`);
  const box = await node.boundingBox();

  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  await node.hover();
  await expect.poll(() => getNodeCursor(page, nodeId)).toBe("pointer");

  await node.click();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect
    .poll(() =>
      getCursorAtPoint(page, {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      })
    )
    .toBe("grab");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect
    .poll(() =>
      getCursorAtPoint(page, {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      })
    )
    .toBe("grab");
  await page.mouse.move(box.x + box.width / 2 + 8, box.y + box.height / 2 + 8);
  await expect
    .poll(() =>
      getCursorAtPoint(page, {
        x: box.x + box.width / 2 + 8,
        y: box.y + box.height / 2 + 8,
      })
    )
    .toBe("grabbing");
  await page.mouse.up();
});

test("uses resize and rotate cursors on the single-node transform overlay", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-move.punch");
  const nodeId = "move-node";

  await waitForNodeReady(page, nodeId);
  await page.locator(`[data-node-id="${nodeId}"]`).click();

  const resizeHandle = page.locator(
    ".canvas-single-node-transform-overlay .moveable-control.moveable-nw"
  );
  const rotationZone = page.locator(
    '.canvas-single-node-transform-overlay .canvas-single-node-rotation-zone[data-corner="nw"]'
  );

  await expect(resizeHandle).toBeVisible();
  await expect(rotationZone).toBeVisible();

  await expect.poll(() => getLocatorCursor(resizeHandle)).toBe("nwse-resize");
  await expect.poll(() => getLocatorCursor(rotationZone)).toBe("crosshair");
});
