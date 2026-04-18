import { expect, test } from "@playwright/test";
import {
  clickNodeCenter,
  doubleClickNodeCenter,
  findEmptyCanvasPoint,
} from "./helpers/canvas";
import { getStateSnapshot, gotoEditor, loadDocument } from "./helpers/editor";

const loadVectorEditModeDocument = async (page) => {
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          id: "vector-a",
          name: "Vector A",
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
          id: "vector-a-path-1",
          parentId: "vector-a",
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -120, y: -90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 120, y: -90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 120, y: 90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -120, y: 90 },
              pointType: "corner",
            },
          ],
          stroke: "#000000",
          strokeLineCap: "round",
          strokeLineJoin: "round",
          strokeMiterLimit: 4,
          strokeWidth: 12,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 420,
            y: 280,
          },
          type: "path",
          visible: true,
        },
        {
          closed: true,
          fill: "#ffffff",
          fillRule: "nonzero",
          id: "vector-a-path-2",
          parentId: "vector-a",
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -100, y: -70 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 100, y: -70 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 100, y: 70 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -100, y: 70 },
              pointType: "corner",
            },
          ],
          stroke: "#000000",
          strokeLineCap: "round",
          strokeLineJoin: "round",
          strokeMiterLimit: 4,
          strokeWidth: 12,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 760,
            y: 280,
          },
          type: "path",
          visible: true,
        },
        {
          id: "vector-b",
          name: "Vector B",
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
          id: "vector-b-path-1",
          parentId: "vector-b",
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -90, y: -70 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 90, y: -70 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 90, y: 70 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -90, y: 70 },
              pointType: "corner",
            },
          ],
          stroke: "#000000",
          strokeLineCap: "round",
          strokeLineJoin: "round",
          strokeMiterLimit: 4,
          strokeWidth: 12,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 920,
            y: 280,
          },
          type: "path",
          visible: true,
        },
      ],
      version: "1.6",
    })
  );

  await expect(
    page.locator(".canvas-node[data-node-id='vector-a-path-1']")
  ).toBeVisible();
  await expect(
    page.locator(".canvas-node[data-node-id='vector-a-path-2']")
  ).toBeVisible();
  await expect(
    page.locator(".canvas-node[data-node-id='vector-b-path-1']")
  ).toBeVisible();
};

const getNodeCenter = async (page, nodeId) => {
  const node = page.locator(`.canvas-node[data-node-id="${nodeId}"]`);

  await node.waitFor({ state: "visible" });

  const rect = await node.boundingBox();

  if (!rect) {
    throw new Error(`Missing element rect for ${nodeId}`);
  }

  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
};

test("clicking another child path retargets vector edit mode while selecting the focused contour", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorEditModeDocument(page);
  await clickNodeCenter(page, "vector-a-path-1");
  await expect
    .poll(() => {
      return getStateSnapshot(page);
    })
    .toMatchObject({
      pathEditingNodeId: null,
      selectedNodeId: "vector-a",
      selectedNodeIds: ["vector-a"],
    });
  await doubleClickNodeCenter(page, "vector-a-path-1");

  await expect
    .poll(() => {
      return getStateSnapshot(page);
    })
    .toMatchObject({
      pathEditingNodeId: "vector-a-path-1",
      selectedNodeId: "vector-a-path-1",
      selectedNodeIds: ["vector-a-path-1"],
    });

  const targetPoint = await getNodeCenter(page, "vector-a-path-2");
  await page.mouse.click(targetPoint.x, targetPoint.y);

  await expect
    .poll(() => {
      return getStateSnapshot(page);
    })
    .toMatchObject({
      pathEditingNodeId: "vector-a-path-2",
      selectedNodeId: "vector-a-path-2",
      selectedNodeIds: ["vector-a-path-2"],
    });
});

test("clicking another vector while path editing jumps directly into editing that vector", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorEditModeDocument(page);
  await clickNodeCenter(page, "vector-a-path-1");
  await doubleClickNodeCenter(page, "vector-a-path-1");

  await clickNodeCenter(page, "vector-b-path-1");

  await expect
    .poll(() => {
      return getStateSnapshot(page);
    })
    .toMatchObject({
      pathEditingNodeId: "vector-b-path-1",
      selectedNodeId: "vector-b-path-1",
      selectedNodeIds: ["vector-b-path-1"],
    });
});

test("empty canvas click exits path editing before clearing the vector selection", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorEditModeDocument(page);
  await clickNodeCenter(page, "vector-a-path-1");
  await doubleClickNodeCenter(page, "vector-a-path-1");
  const blankPoint = await findEmptyCanvasPoint(page);

  await page.mouse.click(blankPoint.x, blankPoint.y);

  await expect
    .poll(() => {
      return getStateSnapshot(page);
    })
    .toMatchObject({
      pathEditingNodeId: null,
      selectedNodeId: "vector-a",
      selectedNodeIds: ["vector-a"],
    });

  await page.mouse.click(blankPoint.x, blankPoint.y);

  await expect
    .poll(() => {
      return getStateSnapshot(page);
    })
    .toMatchObject({
      pathEditingNodeId: null,
      selectedNodeId: null,
      selectedNodeIds: [],
    });
});

test("path editing hover preview switches to a blue path-outline preview", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorEditModeDocument(page);
  await clickNodeCenter(page, "vector-a-path-1");
  await doubleClickNodeCenter(page, "vector-a-path-1");

  const targetPoint = await getNodeCenter(page, "vector-a-path-2");
  await page.mouse.move(targetPoint.x, targetPoint.y);

  await expect(
    page.locator(".canvas-hover-preview[data-preview-kind='path'] svg path")
  ).toHaveCount(1);
  await expect(
    page.locator(".canvas-hover-preview[data-preview-kind='bounds']")
  ).toHaveCount(0);
  await expect
    .poll(() => {
      return page
        .locator(".canvas-hover-preview[data-preview-kind='path']")
        .evaluate((element) => {
          const styles = getComputedStyle(element);

          return {
            borderTopWidth: styles.borderTopWidth,
            boxShadow: styles.boxShadow,
          };
        });
    })
    .toEqual({
      borderTopWidth: "0px",
      boxShadow: "none",
    });
});
