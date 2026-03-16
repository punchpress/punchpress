import { expect, test } from "@playwright/test";
import {
  getHoverPreviewRect,
  gotoEditor,
  loadDocumentFixture,
  panViewportBy,
  waitForNodeReady,
} from "./editor-helpers";

test("hover preview stays aligned when the viewport scrolls", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "hover-preview.punch");
  const nodeId = "hover-node";
  const node = await waitForNodeReady(page, nodeId);

  await page.keyboard.press("Escape");

  const center = {
    x: node.elementRect.x + node.elementRect.width / 2,
    y: node.elementRect.y + node.elementRect.height / 2,
  };

  await page.mouse.move(center.x, center.y);

  await expect.poll(async () => getHoverPreviewRect(page)).not.toBeNull();
  const initialPreview = await getHoverPreviewRect(page);
  if (!initialPreview) {
    throw new Error("Expected hover preview to be visible before panning");
  }

  const didPan = await panViewportBy(page, { x: 120, y: 80 });
  expect(didPan).toBe(true);

  await expect
    .poll(async () => {
      const rect = await getHoverPreviewRect(page);
      if (!rect) {
        return null;
      }

      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
      };
    })
    .toEqual({
      left: Math.round(initialPreview.left - 120),
      top: Math.round(initialPreview.top - 80),
    });
});
