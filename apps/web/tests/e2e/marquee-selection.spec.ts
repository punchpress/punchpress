import { expect, test } from "@playwright/test";
import { getBoundingUnion } from "./helpers/canvas";
import {
  expectHandleAlignedToNodeCorner,
  getSelectionSnapshot,
  gotoEditor,
  loadDocument,
  loadDocumentFixture,
  marqueeSelect,
  pauseForUi,
  setViewport,
  waitForNodeReady,
  waitForSelectionHandles,
} from "./helpers/editor";

const COMPOUND_VECTOR_DOCUMENT = JSON.stringify({
  nodes: [
    {
      id: "compound-vector",
      name: "Compound Vector",
      pathComposition: "compound-fill",
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
      id: "compound-vector:outer",
      parentId: "compound-vector",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 0, y: 0 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 180, y: 0 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 180, y: 140 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 0, y: 140 },
          pointType: "corner",
        },
      ],
      stroke: "#111111",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 4,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 220,
        y: 180,
      },
      type: "path",
      visible: true,
    },
    {
      closed: true,
      fill: "#ffffff",
      fillRule: "nonzero",
      id: "compound-vector:inner",
      parentId: "compound-vector",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 0, y: 0 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 70, y: 0 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 70, y: 70 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 0, y: 70 },
          pointType: "corner",
        },
      ],
      stroke: "#111111",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 4,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 275,
        y: 215,
      },
      type: "path",
      visible: true,
    },
  ],
  version: "1.8",
});

const EMPTY_DOCUMENT = JSON.stringify({
  nodes: [],
  version: "1.8",
});

const SIMPLE_MULTISELECT_DOCUMENT = JSON.stringify({
  nodes: [
    {
      cornerRadius: 0,
      fill: "#3366ff",
      height: 120,
      id: "shape-a",
      parentId: "root",
      shape: "polygon",
      stroke: null,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 180,
        y: 180,
      },
      type: "shape",
      visible: true,
      width: 140,
    },
    {
      cornerRadius: 0,
      fill: "#ff6633",
      height: 110,
      id: "shape-b",
      parentId: "root",
      shape: "ellipse",
      stroke: null,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 390,
        y: 230,
      },
      type: "shape",
      visible: true,
      width: 130,
    },
  ],
  version: "1.8",
});

const NESTED_CURVE_DOCUMENT = JSON.stringify({
  nodes: [
    {
      id: "nested-group",
      name: "Nested Group",
      parentId: "root",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      },
      type: "group",
      visible: true,
    },
    {
      closed: true,
      fill: "#3366ff",
      fillRule: "nonzero",
      id: "nested-path-a",
      parentId: "nested-group",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 0, y: 0 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 100, y: 0 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 100, y: 100 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 0, y: 100 },
          pointType: "corner",
        },
      ],
      stroke: null,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 220,
        y: 190,
      },
      type: "path",
      visible: true,
    },
    {
      closed: true,
      fill: "#ff6633",
      fillRule: "nonzero",
      id: "nested-path-b",
      parentId: "nested-group",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 0, y: 0 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 100, y: 0 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 100, y: 100 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 0, y: 100 },
          pointType: "corner",
        },
      ],
      stroke: null,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 380,
        y: 240,
      },
      type: "path",
      visible: true,
    },
  ],
  version: "1.8",
});

const TRANSFORMED_NESTED_CURVE_DOCUMENT = JSON.stringify({
  nodes: [
    {
      id: "transformed-parent",
      name: "Transformed Parent",
      parentId: "root",
      transform: {
        rotation: 0,
        scaleX: 1.4,
        scaleY: 1.4,
        x: 120,
        y: 80,
      },
      type: "group",
      visible: true,
    },
    {
      id: "transformed-child",
      name: "Transformed Child",
      parentId: "transformed-parent",
      transform: {
        rotation: 0,
        scaleX: 0.8,
        scaleY: 0.8,
        x: 160,
        y: 120,
      },
      type: "group",
      visible: true,
    },
    {
      closed: true,
      fill: "#3366ff",
      fillRule: "nonzero",
      id: "transformed-nested-path",
      parentId: "transformed-child",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 0, y: 0 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 140, y: 0 },
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
          point: { x: 0, y: 90 },
          pointType: "corner",
        },
      ],
      stroke: null,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 40,
        y: 40,
      },
      type: "path",
      visible: true,
    },
  ],
  version: "1.8",
});

const resizeMultiSelectionFromCorner = async (page, { corner, drag }) => {
  await page.evaluate(
    async ({ corner, drag }) => {
      const handle = document.querySelector(
        `.canvas-multi-selection .moveable-control.moveable-${corner}`
      );
      const rect = handle?.getBoundingClientRect?.();

      if (!(handle instanceof Element && rect)) {
        throw new Error(`Missing ${corner} multi-selection resize handle`);
      }

      const start = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      };
      const end = {
        x: start.x + (drag?.x || 0),
        y: start.y + (drag?.y || 0),
      };
      const dispatchPointer = (target, type, point, buttons) => {
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            button: 0,
            buttons,
            clientX: point.x,
            clientY: point.y,
            pointerId: 1,
            pointerType: "mouse",
          })
        );
      };

      dispatchPointer(handle, "pointerdown", start, 1);

      for (let step = 1; step <= 24; step += 1) {
        const progress = step / 24;
        dispatchPointer(
          window,
          "pointermove",
          {
            x: start.x + (end.x - start.x) * progress,
            y: start.y + (end.y - start.y) * progress,
          },
          1
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      dispatchPointer(window, "pointerup", end, 0);
    },
    { corner, drag }
  );
};

test("marquee selection moves multiple layers together", async ({ page }) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "marquee-selection-move.punch");
  const firstNodeId = "marquee-move-first-node";
  const secondNodeId = "marquee-move-second-node";

  const firstBefore = await waitForNodeReady(page, firstNodeId);
  const secondBefore = await waitForNodeReady(page, secondNodeId);
  const start = {
    x:
      Math.min(firstBefore.elementRect.left, secondBefore.elementRect.left) -
      96,
    y: Math.min(firstBefore.elementRect.top, secondBefore.elementRect.top) - 96,
  };
  const end = {
    x:
      Math.max(firstBefore.elementRect.right, secondBefore.elementRect.right) +
      96,
    y:
      Math.max(
        firstBefore.elementRect.bottom,
        secondBefore.elementRect.bottom
      ) + 96,
  };

  await marqueeSelect(page, start, end);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([firstNodeId, secondNodeId]);

  const dragStart = {
    x: firstBefore.elementRect.x + firstBefore.elementRect.width / 2,
    y: firstBefore.elementRect.y + firstBefore.elementRect.height / 2,
  };

  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragStart.x + 90, dragStart.y + 55, {
    steps: 12,
  });
  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const firstAfterRect = await page
        .locator(`[data-node-id="${firstNodeId}"]`)
        .boundingBox();
      const secondAfterRect = await page
        .locator(`[data-node-id="${secondNodeId}"]`)
        .boundingBox();

      if (!(firstAfterRect && secondAfterRect)) {
        return null;
      }

      return {
        first: {
          x: Math.round(firstAfterRect.x),
          y: Math.round(firstAfterRect.y),
        },
        second: {
          x: Math.round(secondAfterRect.x),
          y: Math.round(secondAfterRect.y),
        },
      };
    })
    .toEqual({
      first: {
        x: Math.round(firstBefore.elementRect.x + 90),
        y: Math.round(firstBefore.elementRect.y + 55),
      },
      second: {
        x: Math.round(secondBefore.elementRect.x + 90),
        y: Math.round(secondBefore.elementRect.y + 55),
      },
    });
});

test("marquee selection still selects ordinary top-level nodes", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, SIMPLE_MULTISELECT_DOCUMENT);

  const firstNode = page.locator('[data-node-id="shape-a"]');
  const secondNode = page.locator('[data-node-id="shape-b"]');

  await expect(firstNode).toBeVisible();
  await expect(secondNode).toBeVisible();

  const firstRect = await firstNode.boundingBox();
  const secondRect = await secondNode.boundingBox();

  expect(firstRect).not.toBeNull();
  expect(secondRect).not.toBeNull();

  if (!(firstRect && secondRect)) {
    return;
  }

  await marqueeSelect(
    page,
    {
      x: Math.min(firstRect.x, secondRect.x) - 24,
      y: Math.min(firstRect.y, secondRect.y) - 24,
    },
    {
      x:
        Math.max(
          firstRect.x + firstRect.width,
          secondRect.x + secondRect.width
        ) + 24,
      y:
        Math.max(
          firstRect.y + firstRect.height,
          secondRect.y + secondRect.height
        ) + 24,
    }
  );
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual(["shape-a", "shape-b"]);
});

test("marquee selection ignores partially intersected objects by default", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, SIMPLE_MULTISELECT_DOCUMENT);

  const firstNode = page.locator('[data-node-id="shape-a"]');

  await expect(firstNode).toBeVisible();

  const firstRect = await firstNode.boundingBox();

  expect(firstRect).not.toBeNull();

  if (!firstRect) {
    return;
  }

  await marqueeSelect(
    page,
    {
      x: firstRect.x - 24,
      y: firstRect.y - 24,
    },
    {
      x: firstRect.x + firstRect.width / 2,
      y: firstRect.y + firstRect.height + 24,
    }
  );
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([]);
});

test("marquee selection shows one wrapper box around the whole group", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "marquee-selection-wrapper.punch");
  const firstNodeId = "marquee-wrapper-first-node";
  const secondNodeId = "marquee-wrapper-second-node";
  const thirdNodeId = "marquee-wrapper-third-node";

  const firstNode = await waitForNodeReady(page, firstNodeId);
  const secondNode = await waitForNodeReady(page, secondNodeId);
  const thirdNode = await waitForNodeReady(page, thirdNodeId);
  const groupBounds = getBoundingUnion([
    firstNode.elementRect,
    secondNode.elementRect,
    thirdNode.elementRect,
  ]);

  await marqueeSelect(
    page,
    {
      x: groupBounds.left - 96,
      y: groupBounds.top - 96,
    },
    {
      x: groupBounds.right + 96,
      y: groupBounds.bottom + 96,
    }
  );
  await pauseForUi(page);

  await expect
    .poll(async () => {
      return [...(await getSelectionSnapshot(page)).selectedNodeIds].sort();
    })
    .toEqual([firstNodeId, secondNodeId, thirdNodeId].sort());

  const selection = await waitForSelectionHandles(page);

  expectHandleAlignedToNodeCorner(selection.handles.nw, groupBounds, "nw");
  expectHandleAlignedToNodeCorner(selection.handles.se, groupBounds, "se");
});

test("marquee selection resizes from the lower-right corner with the upper-left corner anchored", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "marquee-selection-wrapper.punch");
  const firstNodeId = "marquee-wrapper-first-node";
  const secondNodeId = "marquee-wrapper-second-node";
  const thirdNodeId = "marquee-wrapper-third-node";

  const firstNode = await waitForNodeReady(page, firstNodeId);
  const secondNode = await waitForNodeReady(page, secondNodeId);
  const thirdNode = await waitForNodeReady(page, thirdNodeId);
  const groupBounds = getBoundingUnion([
    firstNode.elementRect,
    secondNode.elementRect,
    thirdNode.elementRect,
  ]);

  await marqueeSelect(
    page,
    {
      x: groupBounds.left - 96,
      y: groupBounds.top - 96,
    },
    {
      x: groupBounds.right + 96,
      y: groupBounds.bottom + 96,
    }
  );
  await pauseForUi(page);

  await expect
    .poll(async () => {
      return [...(await getSelectionSnapshot(page)).selectedNodeIds].sort();
    })
    .toEqual([firstNodeId, secondNodeId, thirdNodeId].sort());

  await resizeMultiSelectionFromCorner(page, {
    corner: "se",
    drag: { x: 72, y: 72 },
  });
  await pauseForUi(page);

  const selection = await waitForSelectionHandles(page);

  expectHandleAlignedToNodeCorner(selection.handles.nw, groupBounds, "nw");
  expect(
    selection.handles.se.x + selection.handles.se.width / 2
  ).toBeGreaterThan(groupBounds.right + 16);
  expect(
    selection.handles.se.y + selection.handles.se.height / 2
  ).toBeGreaterThan(groupBounds.bottom + 16);
});

test("marquee selection selects a compound vector container", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, COMPOUND_VECTOR_DOCUMENT);
  const vectorNode = page.locator('[data-node-id="compound-vector"]');

  await expect(vectorNode).toBeVisible();

  const vectorRect = await vectorNode.boundingBox();

  expect(vectorRect).not.toBeNull();

  if (!vectorRect) {
    return;
  }
  const start = await page.evaluate((rect) => {
    const minX = Math.max(48, Math.floor(rect.x - 128));
    const maxX = Math.min(
      window.innerWidth - 48,
      Math.floor(rect.x + rect.width + 128)
    );
    const minY = Math.max(48, Math.floor(rect.y - 128));
    const maxY = Math.min(
      window.innerHeight - 48,
      Math.floor(rect.y + rect.height + 128)
    );

    for (let x = minX; x <= maxX; x += 8) {
      for (let y = minY; y <= maxY; y += 8) {
        const insideNode =
          x >= rect.x - 2 &&
          x <= rect.x + rect.width + 2 &&
          y >= rect.y - 2 &&
          y <= rect.y + rect.height + 2;

        if (insideNode) {
          continue;
        }

        const target = document.elementFromPoint(x, y);

        if (
          target instanceof Element &&
          target.closest(".canvas-surface, .canvas-vector-paper") &&
          !target.closest(
            [
              "[data-node-id]",
              ".canvas-moveable",
              ".canvas-selection-toolbar",
              "aside",
            ].join(",")
          )
        ) {
          return { x, y };
        }
      }
    }

    return null;
  }, vectorRect);

  expect(start).not.toBeNull();

  if (!start) {
    return;
  }

  const end = {
    x:
      start.x < vectorRect.x
        ? vectorRect.x + vectorRect.width + 24
        : vectorRect.x - 24,
    y:
      start.y < vectorRect.y
        ? vectorRect.y + vectorRect.height + 24
        : vectorRect.y - 24,
  };

  await marqueeSelect(page, start, end);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual(["compound-vector"]);
});

test("node tool marquee selection selects compound vector curves", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, COMPOUND_VECTOR_DOCUMENT);
  await page.getByRole("button", { name: "Node (A)" }).click();

  const vectorNode = page.locator('[data-node-id="compound-vector"]');

  await expect(vectorNode).toBeVisible();

  const vectorRect = await vectorNode.boundingBox();

  expect(vectorRect).not.toBeNull();

  if (!vectorRect) {
    return;
  }

  await marqueeSelect(
    page,
    {
      x: vectorRect.x - 24,
      y: vectorRect.y - 24,
    },
    {
      x: vectorRect.x + vectorRect.width + 24,
      y: vectorRect.y + vectorRect.height + 24,
    }
  );
  await pauseForUi(page);

  await expect
    .poll(async () =>
      [...(await getSelectionSnapshot(page)).selectedNodeIds].sort()
    )
    .toEqual(["compound-vector:inner", "compound-vector:outer"]);
});

test("node tool marquee selection selects editable vector nodes", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, EMPTY_DOCUMENT);
  const vectorId = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor.addVectorNode({ x: 320, y: 260 });
    const nodeId = editor.selectedNodeIds[0];
    editor.clearSelection();

    return nodeId;
  });
  await page.getByRole("button", { name: "Node (A)" }).click();

  const vectorNode = page.locator(`[data-node-id="${vectorId}"]`);

  await expect(vectorNode).toBeVisible();

  const vectorRect = await vectorNode.boundingBox();

  expect(vectorRect).not.toBeNull();

  if (!vectorRect) {
    return;
  }

  await marqueeSelect(
    page,
    {
      x: vectorRect.x - 24,
      y: vectorRect.y - 24,
    },
    {
      x: vectorRect.x + vectorRect.width + 24,
      y: vectorRect.y + vectorRect.height + 24,
    }
  );
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([vectorId]);
  await expect(
    page.locator(`.canvas-multi-vector-paper[data-node-id="${vectorId}"]`)
  ).toBeVisible();
});

test("node tool marquee selection selects nested curves", async ({ page }) => {
  await gotoEditor(page);
  await loadDocument(page, NESTED_CURVE_DOCUMENT);
  await page.getByRole("button", { name: "Node (A)" }).click();

  const firstPath = page.locator('[data-node-id="nested-path-a"]');
  const secondPath = page.locator('[data-node-id="nested-path-b"]');

  await expect(firstPath).toBeVisible();
  await expect(secondPath).toBeVisible();

  const firstRect = await firstPath.boundingBox();
  const secondRect = await secondPath.boundingBox();

  expect(firstRect).not.toBeNull();
  expect(secondRect).not.toBeNull();

  if (!(firstRect && secondRect)) {
    return;
  }

  await marqueeSelect(
    page,
    {
      x: Math.min(firstRect.x, secondRect.x) - 24,
      y: Math.min(firstRect.y, secondRect.y) - 24,
    },
    {
      x:
        Math.max(
          firstRect.x + firstRect.width,
          secondRect.x + secondRect.width
        ) + 24,
      y:
        Math.max(
          firstRect.y + firstRect.height,
          secondRect.y + secondRect.height
        ) + 24,
    }
  );
  await pauseForUi(page);

  await expect
    .poll(async () =>
      [...(await getSelectionSnapshot(page)).selectedNodeIds].sort()
    )
    .toEqual(["nested-path-a", "nested-path-b"]);
  await expect(
    page.locator('.canvas-multi-vector-paper[data-node-id="nested-path-a"]')
  ).toBeVisible();
  await expect(
    page.locator('.canvas-multi-vector-paper[data-node-id="nested-path-b"]')
  ).toBeVisible();
});

test("node tool marquee selected curves expose editable anchors", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, NESTED_CURVE_DOCUMENT);
  await page.getByRole("button", { name: "Node (A)" }).click();

  const firstPath = page.locator('[data-node-id="nested-path-a"]');
  const secondPath = page.locator('[data-node-id="nested-path-b"]');

  await expect(firstPath).toBeVisible();
  await expect(secondPath).toBeVisible();

  const firstRect = await firstPath.boundingBox();
  const secondRect = await secondPath.boundingBox();

  expect(firstRect).not.toBeNull();
  expect(secondRect).not.toBeNull();

  if (!(firstRect && secondRect)) {
    return;
  }

  await marqueeSelect(
    page,
    {
      x: Math.min(firstRect.x, secondRect.x) - 24,
      y: Math.min(firstRect.y, secondRect.y) - 24,
    },
    {
      x:
        Math.max(
          firstRect.x + firstRect.width,
          secondRect.x + secondRect.width
        ) + 24,
      y:
        Math.max(
          firstRect.y + firstRect.height,
          secondRect.y + secondRect.height
        ) + 24,
    }
  );
  await pauseForUi(page);

  const editCanvas = page.locator(
    '.canvas-multi-vector-paper[data-node-id="nested-path-a"]'
  );

  await expect(editCanvas).toBeVisible();

  await page.mouse.move(firstRect.x + 2, firstRect.y + 2);
  await expect(editCanvas).toHaveAttribute("data-active", "true");

  await page.mouse.down();
  await page.mouse.move(firstRect.x + 26, firstRect.y + 18, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(() => {
      return page.evaluate(() => {
        const node = window.__PUNCHPRESS_EDITOR__?.getNode("nested-path-a");
        const contour = node?.contours?.[0];

        return contour?.segments?.[0]?.point || null;
      });
    })
    .not.toEqual({ x: 0, y: 0 });
});

test("node tool marquee drag does not select the curve under the pointer before release", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, NESTED_CURVE_DOCUMENT);
  await page.getByRole("button", { name: "Node (A)" }).click();

  const firstPath = page.locator('[data-node-id="nested-path-a"]');

  await expect(firstPath).toBeVisible();

  const firstRect = await firstPath.boundingBox();

  expect(firstRect).not.toBeNull();

  if (!firstRect) {
    return;
  }

  await page.mouse.move(
    firstRect.x + firstRect.width / 2,
    firstRect.y + firstRect.height / 2
  );
  await page.mouse.down();
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([]);

  await page.mouse.up();
});

test("node tool marquee can start over unselected artwork", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, NESTED_CURVE_DOCUMENT);
  await page.getByRole("button", { name: "Node (A)" }).click();

  const firstPath = page.locator('[data-node-id="nested-path-a"]');
  const secondPath = page.locator('[data-node-id="nested-path-b"]');

  await expect(firstPath).toBeVisible();
  await expect(secondPath).toBeVisible();

  const firstRect = await firstPath.boundingBox();
  const secondRect = await secondPath.boundingBox();

  expect(firstRect).not.toBeNull();
  expect(secondRect).not.toBeNull();

  if (!(firstRect && secondRect)) {
    return;
  }

  await page.mouse.move(
    firstRect.x + firstRect.width / 2,
    firstRect.y + firstRect.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    secondRect.x + secondRect.width + 24,
    secondRect.y + secondRect.height + 24,
    { steps: 12 }
  );

  await expect(
    page.locator(
      '.canvas-marquee-candidate-preview[data-node-id="nested-path-a"]'
    )
  ).toBeVisible();
  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([]);

  await page.mouse.up();

  await expect
    .poll(async () =>
      [...(await getSelectionSnapshot(page)).selectedNodeIds].sort()
    )
    .toEqual(["nested-path-a", "nested-path-b"]);
});

test("node tool marquee can start over unselected artwork with an existing selection", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, NESTED_CURVE_DOCUMENT);
  await page.getByRole("button", { name: "Node (A)" }).click();

  const firstPath = page.locator('[data-node-id="nested-path-a"]');
  const secondPath = page.locator('[data-node-id="nested-path-b"]');

  await expect(firstPath).toBeVisible();
  await expect(secondPath).toBeVisible();

  const firstRect = await firstPath.boundingBox();
  const secondRect = await secondPath.boundingBox();

  expect(firstRect).not.toBeNull();
  expect(secondRect).not.toBeNull();

  if (!(firstRect && secondRect)) {
    return;
  }

  await marqueeSelect(
    page,
    {
      x: firstRect.x - 24,
      y: firstRect.y - 24,
    },
    {
      x: firstRect.x + firstRect.width + 24,
      y: firstRect.y + firstRect.height + 24,
    }
  );
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual(["nested-path-a"]);

  await page.keyboard.down("Shift");
  await page.mouse.move(
    secondRect.x + secondRect.width / 2,
    secondRect.y + secondRect.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    secondRect.x + secondRect.width + 24,
    secondRect.y + secondRect.height + 24,
    { steps: 12 }
  );
  await page.mouse.up();
  await page.keyboard.up("Shift");

  await expect
    .poll(async () =>
      [...(await getSelectionSnapshot(page)).selectedNodeIds].sort()
    )
    .toEqual(["nested-path-a", "nested-path-b"]);
});

test("node tool marquee previews intersecting curve candidates while dragging", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, NESTED_CURVE_DOCUMENT);
  await page.getByRole("button", { name: "Node (A)" }).click();

  const firstPath = page.locator('[data-node-id="nested-path-a"]');
  const secondPath = page.locator('[data-node-id="nested-path-b"]');

  await expect(firstPath).toBeVisible();
  await expect(secondPath).toBeVisible();

  const firstRect = await firstPath.boundingBox();
  const secondRect = await secondPath.boundingBox();

  expect(firstRect).not.toBeNull();
  expect(secondRect).not.toBeNull();

  if (!(firstRect && secondRect)) {
    return;
  }

  await page.mouse.move(
    Math.min(firstRect.x, secondRect.x) - 24,
    Math.max(firstRect.y, secondRect.y) + 16
  );
  await page.mouse.down();
  await page.mouse.move(
    Math.max(firstRect.x + firstRect.width, secondRect.x + secondRect.width) +
      24,
    Math.max(firstRect.y, secondRect.y) + 28,
    { steps: 12 }
  );

  await expect(
    page.locator(
      '.canvas-marquee-candidate-preview[data-node-id="nested-path-a"]'
    )
  ).toBeVisible();
  await expect(
    page.locator(
      '.canvas-marquee-candidate-preview[data-node-id="nested-path-b"]'
    )
  ).toBeVisible();
  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([]);

  await page.mouse.up();

  await expect(page.locator(".canvas-marquee-candidate-preview")).toHaveCount(
    0
  );
  await expect
    .poll(async () =>
      [...(await getSelectionSnapshot(page)).selectedNodeIds].sort()
    )
    .toEqual(["nested-path-a", "nested-path-b"]);
});

test("node tool marquee uses current zoom for curve candidate geometry", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, NESTED_CURVE_DOCUMENT);
  await setViewport(page, { x: 0, y: 0, zoom: 0.25 });
  await page.getByRole("button", { name: "Node (A)" }).click();

  const firstPath = page.locator('[data-node-id="nested-path-a"]');
  const secondPath = page.locator('[data-node-id="nested-path-b"]');

  await expect(firstPath).toBeVisible();
  await expect(secondPath).toBeVisible();

  const firstRect = await firstPath.boundingBox();
  const secondRect = await secondPath.boundingBox();

  expect(firstRect).not.toBeNull();
  expect(secondRect).not.toBeNull();

  if (!(firstRect && secondRect)) {
    return;
  }

  await page.mouse.move(
    Math.min(firstRect.x, secondRect.x) - 12,
    Math.max(firstRect.y, secondRect.y) + 4
  );
  await page.mouse.down();
  await page.mouse.move(
    Math.max(firstRect.x + firstRect.width, secondRect.x + secondRect.width) +
      12,
    Math.max(firstRect.y, secondRect.y) + 12,
    { steps: 12 }
  );

  await expect(page.locator(".canvas-marquee-candidate-preview")).toHaveCount(
    2
  );

  const previewRects = await page
    .locator(".canvas-marquee-candidate-preview")
    .evaluateAll((elements) => {
      return elements.map((element) => {
        const rect = element.getBoundingClientRect();

        return {
          height: rect.height,
          nodeId: element.getAttribute("data-node-id"),
          width: rect.width,
          x: rect.x,
          y: rect.y,
        };
      });
    });
  const paintedRects = await page
    .locator('[data-node-id="nested-path-a"], [data-node-id="nested-path-b"]')
    .evaluateAll((elements) => {
      return elements.map((element) => {
        const rect = element.getBoundingClientRect();

        return {
          height: rect.height,
          nodeId: element.getAttribute("data-node-id"),
          width: rect.width,
          x: rect.x,
          y: rect.y,
        };
      });
    });

  for (const paintedRect of paintedRects) {
    const previewRect = previewRects.find(
      (candidate) => candidate.nodeId === paintedRect.nodeId
    );

    expect(previewRect).toBeDefined();
    expect(previewRect?.x).toBeCloseTo(paintedRect.x, 1);
    expect(previewRect?.y).toBeCloseTo(paintedRect.y, 1);
    expect(previewRect?.width).toBeCloseTo(paintedRect.width, 1);
    expect(previewRect?.height).toBeCloseTo(paintedRect.height, 1);
  }

  await page.mouse.up();

  await expect
    .poll(async () =>
      [...(await getSelectionSnapshot(page)).selectedNodeIds].sort()
    )
    .toEqual(["nested-path-a", "nested-path-b"]);
});

test("node tool marquee preview follows transformed ancestor groups", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, TRANSFORMED_NESTED_CURVE_DOCUMENT);
  await setViewport(page, { x: 0, y: 0, zoom: 0.2 });
  await page.getByRole("button", { name: "Node (A)" }).click();

  const targetPath = page.locator('[data-node-id="transformed-nested-path"]');

  await expect(targetPath).toBeVisible();

  const targetRect = await targetPath.boundingBox();

  expect(targetRect).not.toBeNull();

  if (!targetRect) {
    return;
  }

  await page.mouse.move(targetRect.x - 12, targetRect.y + 8);
  await page.mouse.down();
  await page.mouse.move(
    targetRect.x + targetRect.width + 12,
    targetRect.y + targetRect.height - 8,
    { steps: 12 }
  );

  const preview = page.locator(
    '.canvas-marquee-candidate-preview[data-node-id="transformed-nested-path"]'
  );

  await expect(preview).toBeVisible();

  const previewRect = await preview.boundingBox();

  expect(previewRect).not.toBeNull();

  if (!previewRect) {
    return;
  }

  expect(previewRect.x).toBeCloseTo(targetRect.x, 1);
  expect(previewRect.y).toBeCloseTo(targetRect.y, 1);
  expect(previewRect.width).toBeCloseTo(targetRect.width, 1);
  expect(previewRect.height).toBeCloseTo(targetRect.height, 1);

  await page.mouse.up();

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual(["transformed-nested-path"]);
});
