import { expect, test } from "@playwright/test";
import { gotoEditor, loadDocument } from "./helpers/editor";

const VECTOR_DOCUMENT = JSON.stringify({
  nodes: [
    {
      id: "vector-container",
      name: "Vector",
      parentId: "root",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      },
      type: "vector",
      visible: true,
    },
    {
      closed: true,
      fill: "#ffffff",
      fillRule: "nonzero",
      id: "vector-path",
      parentId: "vector-container",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 0, y: 20 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 110, y: 0 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 140, y: 90 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 40, y: 120 },
          pointType: "corner",
        },
      ],
      stroke: "#000000",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 3,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 280,
        y: 220,
      },
      type: "path",
      visible: true,
    },
  ],
  version: "1.6",
});

const expectVectorTransformOverlay = async (page) => {
  const overlay = page.locator(".canvas-multi-node-transform-overlay");
  const handle = overlay.locator(".moveable-control.moveable-ne");

  await expect(overlay).toBeVisible();
  await expect(handle).toBeVisible();
};

test("selected vector container shows transform overlay", async ({ page }) => {
  await gotoEditor(page);
  await loadDocument(page, VECTOR_DOCUMENT);

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("vector-container");
  });

  await expectVectorTransformOverlay(page);
});

test("clicking the vector row in layers shows transform overlay", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, VECTOR_DOCUMENT);

  await page
    .locator('button[aria-pressed][type="button"]')
    .filter({ hasText: "Vector" })
    .click();

  await expectVectorTransformOverlay(page);
});
