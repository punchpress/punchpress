import { expect, test } from "@playwright/test";
import { clickNodeCenter, doubleClickNodeCenter } from "./helpers/canvas";
import { getDebugDump, gotoEditor, pauseForUi } from "./helpers/editor";

const loadVectorDocument = async (page) => {
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return false;
    }

    editor.loadDocument(
      JSON.stringify({
        nodes: [
          {
            contours: [
              {
                closed: true,
                segments: [
                  {
                    handleIn: { x: 0, y: 0 },
                    handleOut: { x: 0, y: 0 },
                    point: { x: 0, y: 0 },
                  },
                  {
                    handleIn: { x: 0, y: 0 },
                    handleOut: { x: 0, y: 0 },
                    point: { x: 200, y: 0 },
                  },
                  {
                    handleIn: { x: 0, y: 0 },
                    handleOut: { x: 0, y: 0 },
                    point: { x: 200, y: 120 },
                  },
                  {
                    handleIn: { x: 0, y: 0 },
                    handleOut: { x: 0, y: 0 },
                    point: { x: 0, y: 120 },
                  },
                ],
              },
            ],
            fill: "#000000",
            fillRule: "nonzero",
            id: "vector-node",
            parentId: "root",
            stroke: null,
            strokeWidth: 0,
            transform: {
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              x: 320,
              y: 220,
            },
            type: "vector",
            visible: true,
          },
        ],
        version: "1.4",
      })
    );

    return true;
  });
};

const getViewerScroll = async (page) => {
  return page.evaluate(() => {
    const viewer = window.__PUNCHPRESS_EDITOR__?.viewerRef;

    if (!viewer) {
      return null;
    }

    return {
      x: viewer.getScrollLeft?.() || 0,
      y: viewer.getScrollTop?.() || 0,
    };
  });
};

test("double-clicking a vector node enters path editing", async ({ page }) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        pathNodeId: dump?.editing?.pathNodeId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      pathNodeId: null,
      selectedNodeIds: ["vector-node"],
    });

  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathNodeId || null)
    .toBe("vector-node");

  await expect(page.locator(".canvas-vector-paper")).toHaveCount(1);
  await expect(page.locator(".canvas-single-node-transform-overlay")).toHaveCount(
    0
  );
});

test("dragging a vector anchor edits the node through the paper session", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const node = page.locator('.canvas-node[data-node-id="vector-node"]');
  const rect = await node.boundingBox();

  if (!rect) {
    throw new Error("Missing visible vector node bounds");
  }

  await page.mouse.move(rect.x, rect.y);
  await page.mouse.down();
  await page.mouse.move(rect.x - 36, rect.y - 24, { steps: 6 });
  await expect(page.locator(".canvas-selecto .selecto-selection")).toHaveCount(0);
  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const document = dump?.document?.serialized
        ? JSON.parse(dump.document.serialized)
        : null;
      const vectorNode = document?.nodes?.find(
        (entry) => entry.id === "vector-node"
      );

      return vectorNode?.contours?.[0]?.segments?.[0]?.point || null;
    })
    .toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });

  const firstPoint = await page.evaluate(() => {
    const dump = window.__PUNCHPRESS_EDITOR__?.getDebugDump();
    const document = dump?.document?.serialized
      ? JSON.parse(dump.document.serialized)
      : null;
    const vectorNode = document?.nodes?.find((entry) => entry.id === "vector-node");

    return vectorNode?.contours?.[0]?.segments?.[0]?.point || null;
  });

  expect(firstPoint?.x).toBeLessThan(-10);
  expect(firstPoint?.y).toBeLessThan(-10);
});

test("dragging the vector body in path edit mode moves the node", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const node = page.locator('.canvas-node[data-node-id="vector-node"]');
  const rect = await node.boundingBox();

  if (!rect) {
    throw new Error("Missing visible vector node bounds");
  }

  const startTransform = await page.evaluate(() => {
    const dump = window.__PUNCHPRESS_EDITOR__?.getDebugDump();
    const document = dump?.document?.serialized
      ? JSON.parse(dump.document.serialized)
      : null;
    const vectorNode = document?.nodes?.find((entry) => entry.id === "vector-node");

    return vectorNode?.transform || null;
  });

  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 64, rect.y + rect.height / 2 + 40, {
    steps: 8,
  });
  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const document = dump?.document?.serialized
        ? JSON.parse(dump.document.serialized)
        : null;
      const vectorNode = document?.nodes?.find(
        (entry) => entry.id === "vector-node"
      );

      return vectorNode?.transform || null;
    })
    .toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });

  const endTransform = await page.evaluate(() => {
    const dump = window.__PUNCHPRESS_EDITOR__?.getDebugDump();
    const document = dump?.document?.serialized
      ? JSON.parse(dump.document.serialized)
      : null;
    const vectorNode = document?.nodes?.find((entry) => entry.id === "vector-node");

    return vectorNode?.transform || null;
  });

  expect(endTransform?.x).toBeGreaterThan(startTransform?.x || 0);
  expect(endTransform?.y).toBeGreaterThan(startTransform?.y || 0);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathNodeId || null)
    .toBe("vector-node");
});

test("space-dragging pans the canvas during vector path editing", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const node = page.locator('.canvas-node[data-node-id="vector-node"]');
  const rect = await node.boundingBox();

  if (!rect) {
    throw new Error("Missing visible vector node bounds");
  }

  const initialScroll = await getViewerScroll(page);

  await page.keyboard.down("Space");
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 120, rect.y + rect.height / 2 + 72, {
    steps: 10,
  });
  await page.mouse.up();
  await page.keyboard.up("Space");
  await pauseForUi(page);

  await expect
    .poll(async () => await getViewerScroll(page))
    .not.toEqual(initialScroll);
});

test("wheel panning still works during vector path editing", async ({ page }) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const node = page.locator('.canvas-node[data-node-id="vector-node"]');
  const rect = await node.boundingBox();

  if (!rect) {
    throw new Error("Missing visible vector node bounds");
  }

  const initialScroll = await getViewerScroll(page);

  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.wheel(96, 64);
  await pauseForUi(page);

  await expect
    .poll(async () => await getViewerScroll(page))
    .not.toEqual(initialScroll);
});
