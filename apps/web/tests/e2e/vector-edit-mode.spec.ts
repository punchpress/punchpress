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
      version: "1.7",
    })
  );

  await expect(
    page.locator(".canvas-node[data-node-id='vector-a']")
  ).toBeVisible();
  await expect(
    page.locator(".canvas-node[data-node-id='vector-b']")
  ).toBeVisible();
};

const getCanvasPointClientPoint = async (page, point) => {
  const clientPoint = await page.evaluate((nextPoint) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const host = editor?.hostRef;
    const viewer = editor?.viewerRef;

    if (!(host && viewer && nextPoint)) {
      return null;
    }

    const rect = host.getBoundingClientRect();

    return {
      x: rect.left + (nextPoint.x - viewer.getScrollLeft()) * editor.zoom,
      y: rect.top + (nextPoint.y - viewer.getScrollTop()) * editor.zoom,
    };
  }, point);

  if (!clientPoint) {
    throw new Error("Missing client point for canvas coordinate");
  }

  return clientPoint;
};

test("clicking another contour in the same vector keeps the vector edit session active", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorEditModeDocument(page);
  await clickNodeCenter(page, "vector-a");
  await expect
    .poll(() => {
      return getStateSnapshot(page);
    })
    .toMatchObject({
      pathEditingNodeId: null,
      selectedNodeId: "vector-a",
      selectedNodeIds: ["vector-a"],
    });
  await doubleClickNodeCenter(page, "vector-a");

  await expect
    .poll(() => {
      return getStateSnapshot(page);
    })
    .toMatchObject({
      pathEditingNodeId: "vector-a-path-2",
      selectedNodeId: "vector-a-path-2",
      selectedNodeIds: ["vector-a-path-2"],
    });

  const targetPoint = await getCanvasPointClientPoint(page, {
    x: 760,
    y: 280,
  });
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

test("clicking a different contour in the same vector switches the active path edit target", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorEditModeDocument(page);
  await clickNodeCenter(page, "vector-a");
  await doubleClickNodeCenter(page, "vector-a");

  await expect
    .poll(() => {
      return getStateSnapshot(page);
    })
    .toMatchObject({
      pathEditingNodeId: "vector-a-path-2",
      selectedNodeId: "vector-a-path-2",
      selectedNodeIds: ["vector-a-path-2"],
    });

  const targetPoint = await getCanvasPointClientPoint(page, {
    x: 420,
    y: 280,
  });
  await page.mouse.click(targetPoint.x, targetPoint.y);

  await expect
    .poll(() => {
      return getStateSnapshot(page);
    })
    .toMatchObject({
      pathEditingNodeId: "vector-a-path-1",
      selectedNodeId: "vector-a-path-1",
      selectedNodeIds: ["vector-a-path-1"],
    });
});

test("double-clicking a specific contour enters path editing on that contour", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorEditModeDocument(page);
  await clickNodeCenter(page, "vector-a");

  await expect
    .poll(() => {
      return getStateSnapshot(page);
    })
    .toMatchObject({
      pathEditingNodeId: null,
      selectedNodeId: "vector-a",
      selectedNodeIds: ["vector-a"],
    });

  const targetPoint = await getCanvasPointClientPoint(page, {
    x: 420,
    y: 280,
  });
  await page.mouse.dblclick(targetPoint.x, targetPoint.y);

  await expect
    .poll(() => {
      return getStateSnapshot(page);
    })
    .toMatchObject({
      pathEditingNodeId: "vector-a-path-1",
      selectedNodeId: "vector-a-path-1",
      selectedNodeIds: ["vector-a-path-1"],
    });
});

test("clicking another vector while path editing jumps directly into editing that vector", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorEditModeDocument(page);
  await clickNodeCenter(page, "vector-a");
  await doubleClickNodeCenter(page, "vector-a");

  await clickNodeCenter(page, "vector-b");

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
  await clickNodeCenter(page, "vector-a");
  await doubleClickNodeCenter(page, "vector-a");
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

test("path editing hover preview switches to a blue path-outline preview for another vector", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorEditModeDocument(page);
  await clickNodeCenter(page, "vector-a");
  await doubleClickNodeCenter(page, "vector-a");

  const targetPoint = await getCanvasPointClientPoint(page, {
    x: 920,
    y: 280,
  });
  await page.mouse.move(targetPoint.x, targetPoint.y);

  await expect
    .poll(() => {
      return getStateSnapshot(page);
    })
    .toMatchObject({
      pathEditingNodeId: "vector-a-path-2",
    });

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

test("path editing hover preview appears for a sibling contour in the same vector", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorEditModeDocument(page);
  await clickNodeCenter(page, "vector-a");
  await doubleClickNodeCenter(page, "vector-a");

  const targetPoint = await getCanvasPointClientPoint(page, {
    x: 420,
    y: 280,
  });
  await page.mouse.move(targetPoint.x, targetPoint.y);

  await expect
    .poll(() => {
      return getStateSnapshot(page);
    })
    .toMatchObject({
      pathEditingNodeId: "vector-a-path-2",
    });

  await expect(
    page.locator(".canvas-hover-preview[data-preview-kind='path'] svg path")
  ).toHaveCount(1);
  await expect(
    page.locator(".canvas-hover-preview[data-preview-kind='bounds']")
  ).toHaveCount(0);
});

test("layers panel shows contour rows for a multi-contour vector", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorEditModeDocument(page);

  await expect(page.getByRole("button", { name: "Vector A" })).toBeVisible();
  await expect(
    page.locator('[data-layer-node-id="vector-a-path-1"]')
  ).toBeVisible();
  await expect(
    page.locator('[data-layer-node-id="vector-a-path-2"]')
  ).toBeVisible();
});
