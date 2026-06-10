import { expect, test } from "@playwright/test";
import { findEmptyCanvasPoint } from "./helpers/canvas";
import {
  getDebugDump,
  getHoverPreviewRect,
  gotoEditor,
  loadDocument,
  loadDocumentFixture,
  panViewportBy,
  resetViewport,
  waitForNodeReady,
} from "./helpers/editor";

const getClientPoint = async (page, point) => {
  const clientPoint = await page.evaluate((canvasPoint) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const host = editor?.hostRef;
    const viewer = editor?.viewerRef;

    if (!(editor && host && viewer)) {
      return null;
    }

    const rect = host.getBoundingClientRect();

    return {
      x: rect.left + (canvasPoint.x - viewer.getScrollLeft()) * editor.zoom,
      y: rect.top + (canvasPoint.y - viewer.getScrollTop()) * editor.zoom,
    };
  }, point);

  if (!clientPoint) {
    throw new Error("Missing client point");
  }

  return clientPoint;
};

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

test("hover preview clears when the pointer leaves a canvas node", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "hover-preview.punch");
  const nodeId = "hover-node";
  const node = await waitForNodeReady(page, nodeId);

  await page.keyboard.press("Escape");

  await page.mouse.move(
    node.elementRect.x + node.elementRect.width / 2,
    node.elementRect.y + node.elementRect.height / 2
  );

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return dump?.hoveredNodeId || null;
    })
    .toBe(nodeId);

  const emptyPoint = await findEmptyCanvasPoint(page);
  await page.mouse.move(emptyPoint.x, emptyPoint.y);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return dump?.hoveredNodeId || null;
    })
    .toBeNull();
  await expect(page.locator(".canvas-hover-preview")).toHaveCount(0);
});

test("hover preview uses the painted node under the pointer, not overlapping empty bounds", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          closed: true,
          fill: "#5b89ff",
          fillRule: "nonzero",
          id: "painted-rect",
          parentId: "root",
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -30, y: -30 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 30, y: -30 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 30, y: 30 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -30, y: 30 },
              pointType: "corner",
            },
          ],
          stroke: "none",
          strokeLineCap: "round",
          strokeLineJoin: "round",
          strokeMiterLimit: 4,
          strokeWidth: 0,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 460,
            y: 360,
          },
          type: "path",
          visible: true,
        },
        {
          closed: true,
          fill: "#ff6b6b",
          fillRule: "nonzero",
          id: "empty-bounds-triangle",
          parentId: "root",
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -80, y: -80 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 80, y: -80 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -80, y: 80 },
              pointType: "corner",
            },
          ],
          stroke: "none",
          strokeLineCap: "round",
          strokeLineJoin: "round",
          strokeMiterLimit: 4,
          strokeWidth: 0,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 400,
            y: 300,
          },
          type: "path",
          visible: true,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);
  await waitForNodeReady(page, "painted-rect");
  await waitForNodeReady(page, "empty-bounds-triangle");

  const point = await getClientPoint(page, { x: 460, y: 360 });
  await page.mouse.move(point.x, point.y);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return dump?.hoveredNodeId || null;
    })
    .toBe("painted-rect");

  await expect(page.locator(".canvas-hover-preview")).toHaveCSS(
    "z-index",
    "20"
  );
});
