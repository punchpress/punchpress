import { expect, test } from "@playwright/test";
import {
  getStateSnapshot,
  gotoEditor,
  pauseForUi,
  resizeSelectionFromCorner,
  rotateSelectionFromCorner,
  rotateSelectionFromCornerWithoutRelease,
  waitForNodeReady,
} from "./helpers/editor";

const TEST_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
};

const loadCircleDocument = async (page) => {
  await page.evaluate((font) => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return false;
    }

    editor.loadDocument(
      JSON.stringify({
        nodes: [
          {
            fill: "#000000",
            font,
            fontSize: 120,
            id: "circle-node",
            parentId: "root",
            stroke: null,
            strokeWidth: 0,
            text: "HEY",
            tracking: 0,
            transform: {
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              x: 380,
              y: 220,
            },
            type: "text",
            visible: true,
            warp: {
              kind: "circle",
              pathPosition: 0,
              radius: 320,
              sweepDeg: 140,
            },
          },
        ],
        version: "1.3",
      })
    );

    return true;
  }, TEST_FONT);
};

const loadPlainTextDocument = async (page) => {
  await page.evaluate((font) => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return false;
    }

    editor.loadDocument(
      JSON.stringify({
        nodes: [
          {
            fill: "#000000",
            font,
            fontSize: 120,
            id: "plain-text-node",
            parentId: "root",
            stroke: null,
            strokeWidth: 0,
            text: "HEY",
            tracking: 0,
            transform: {
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              x: 380,
              y: 220,
            },
            type: "text",
            visible: true,
            warp: {
              kind: "none",
            },
          },
        ],
        version: "1.3",
      })
    );

    return true;
  }, TEST_FONT);
};

const setViewportZoom = async (page, zoom) => {
  await page.evaluate((nextZoom) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const viewer = editor?.viewerRef;

    if (!(editor && viewer)) {
      return false;
    }

    viewer.setTo?.({
      x: viewer.getScrollLeft?.() || 0,
      y: viewer.getScrollTop?.() || 0,
      zoom: nextZoom,
    });
    editor.setViewportZoom(nextZoom);
    editor.onViewportChange?.();

    return true;
  }, zoom);
};

const getRectCenter = (rect) => {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
};

const getExpectedTextPathGuideScreenPoint = (page, nodeId) => {
  return page.evaluate((targetNodeId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode(targetNodeId);
    const geometry = editor?.getNodeGeometry(targetNodeId);
    const host = editor?.hostRef;
    const viewer = editor?.viewerRef;

    if (
      !(editor && node && geometry?.bbox && geometry?.guide && host && viewer)
    ) {
      return null;
    }

    const point = geometry.guide.handles.find(
      (handle) => handle.role === "position"
    )?.point;

    if (!point) {
      return null;
    }

    const bbox = geometry.bbox;
    const center = {
      x: (bbox.minX + bbox.maxX) / 2,
      y: (bbox.minY + bbox.maxY) / 2,
    };
    const rotation = ((node.transform.rotation || 0) * Math.PI) / 180;
    const scaleX = node.transform.scaleX ?? 1;
    const scaleY = node.transform.scaleY ?? 1;
    const offset = {
      x: (point.x - center.x) * scaleX,
      y: (point.y - center.y) * scaleY,
    };
    const worldPoint = {
      x:
        node.transform.x +
        center.x +
        (offset.x * Math.cos(rotation) - offset.y * Math.sin(rotation)),
      y:
        node.transform.y +
        center.y +
        (offset.x * Math.sin(rotation) + offset.y * Math.cos(rotation)),
    };
    const hostRect = host.getBoundingClientRect();
    const scrollLeft = viewer.getScrollLeft?.() || 0;
    const scrollTop = viewer.getScrollTop?.() || 0;

    return {
      x: hostRect.left + (worldPoint.x - scrollLeft) * editor.zoom,
      y: hostRect.top + (worldPoint.y - scrollTop) * editor.zoom,
    };
  }, nodeId);
};

const getActualTextPathGuideScreenPoint = (page) => {
  return page.evaluate(() => {
    const guideGroup = document.querySelector(
      '[data-testid="text-path-guide"] g'
    );
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("circle-node");
    const geometry = editor?.getNodeGeometry("circle-node");

    if (!(guideGroup instanceof SVGGElement && geometry?.guide && node)) {
      return null;
    }

    const point = geometry.guide.handles.find(
      (handle) => handle.role === "position"
    )?.point;
    const svg = guideGroup.ownerSVGElement;
    const matrix = guideGroup.getScreenCTM();

    if (!(point && svg && matrix)) {
      return null;
    }

    const svgPoint = svg.createSVGPoint();
    svgPoint.x = point.x;
    svgPoint.y = point.y;
    const screenPoint = svgPoint.matrixTransform(matrix);

    return {
      x: screenPoint.x,
      y: screenPoint.y,
    };
  });
};

test("resizes the circle path and repositions text along it", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);
  await page.locator('.canvas-node[data-node-id="circle-node"]').click();
  await pauseForUi(page);
  await page.getByRole("button", { name: "Edit path (E)" }).click();
  await pauseForUi(page);

  const positionHandle = page.getByTestId("text-path-handle-position");

  await expect(positionHandle).toBeVisible();

  const before = await getStateSnapshot(page);
  await resizeSelectionFromCorner(page, {
    corner: "se",
    drag: { x: 56, y: 24 },
  });
  await pauseForUi(page);

  const afterResize = await getStateSnapshot(page);
  const resizedNode = afterResize.nodes.find(
    (node) => node.id === "circle-node"
  );
  expect(resizedNode?.warp?.radius).toBeGreaterThan(
    before.nodes.find((node) => node.id === "circle-node")?.warp?.radius ?? 0
  );

  const positionBox = await positionHandle.boundingBox();

  if (!positionBox) {
    throw new Error("Missing circle position handle bounds");
  }

  await page.mouse.move(
    positionBox.x + positionBox.width / 2,
    positionBox.y + positionBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    positionBox.x + positionBox.width / 2 + 340,
    positionBox.y + positionBox.height / 2 + 340,
    { steps: 20 }
  );
  await page.mouse.up();
  await pauseForUi(page);

  const afterPosition = await getStateSnapshot(page);
  const positionedNode = afterPosition.nodes.find(
    (node) => node.id === "circle-node"
  );

  expect(positionedNode?.warp?.pathPosition).toBeGreaterThan(0.12);
  expect(positionedNode?.warp?.pathPosition).toBeLessThan(0.38);
});

test("rotates a circle text node around its selected bounds center", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);
  await page.locator('.canvas-node[data-node-id="circle-node"]').click();
  await pauseForUi(page);

  const before = await waitForNodeReady(page, "circle-node");
  const beforeCenter = getRectCenter(before.elementRect);

  await rotateSelectionFromCorner(page, {
    drag: { x: 160, y: 100 },
  });
  await pauseForUi(page);

  const after = await waitForNodeReady(page, "circle-node");
  const afterCenter = getRectCenter(after.elementRect);

  expect(Math.abs(after.rotation)).toBeGreaterThan(5);
  expect(afterCenter.x).toBeCloseTo(beforeCenter.x, 1);
  expect(afterCenter.y).toBeCloseTo(beforeCenter.y, 1);
});

test("keeps the circle path overlay aligned after rotating a selected node", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);
  await page.locator('.canvas-node[data-node-id="circle-node"]').click();
  await pauseForUi(page);

  const beforeExpected = await getExpectedTextPathGuideScreenPoint(
    page,
    "circle-node"
  );
  const beforeActual = await getActualTextPathGuideScreenPoint(page);

  expect(beforeExpected).not.toBeNull();
  expect(beforeActual.x).toBeCloseTo(beforeExpected?.x ?? 0, 1);
  expect(beforeActual.y).toBeCloseTo(beforeExpected?.y ?? 0, 1);

  await rotateSelectionFromCorner(page, {
    drag: { x: 160, y: 100 },
  });
  await pauseForUi(page);

  const afterExpected = await getExpectedTextPathGuideScreenPoint(
    page,
    "circle-node"
  );
  const afterActual = await getActualTextPathGuideScreenPoint(page);

  expect(afterExpected).not.toBeNull();
  expect(afterActual.x).toBeCloseTo(afterExpected?.x ?? 0, 1);
  expect(afterActual.y).toBeCloseTo(afterExpected?.y ?? 0, 1);
});

test("hides the circle guide while rotating and restores it after", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);
  await page.locator('.canvas-node[data-node-id="circle-node"]').click();
  await pauseForUi(page);

  const guide = page.getByTestId("text-path-guide");

  await expect(guide).toBeVisible();

  await rotateSelectionFromCornerWithoutRelease(page, {
    drag: { x: 140, y: 90 },
  });

  await expect(guide).toHaveCount(0);

  await page.mouse.up();
  await pauseForUi(page);

  await expect(guide).toBeVisible();
});

test("hides selection bounds while repositioning text on the path", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);
  await page.locator('.canvas-node[data-node-id="circle-node"]').click();
  await pauseForUi(page);
  await page.getByRole("button", { name: "Edit path (E)" }).click();
  await pauseForUi(page);

  const positionHandle = page.getByTestId("text-path-handle-position");
  const moveable = page.locator(".canvas-moveable");

  await expect(positionHandle).toBeVisible();
  await expect(moveable).toHaveCount(1);

  const positionBox = await positionHandle.boundingBox();

  if (!positionBox) {
    throw new Error("Missing circle position handle bounds");
  }

  await page.mouse.move(
    positionBox.x + positionBox.width / 2,
    positionBox.y + positionBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    positionBox.x + positionBox.width / 2 + 220,
    positionBox.y + positionBox.height / 2 + 140,
    { steps: 16 }
  );

  await expect(moveable).toHaveCount(0);

  await page.mouse.up();
  await pauseForUi(page);

  await expect(moveable).toHaveCount(1);
});

test("keeps the circle guide stable while repositioning text on the path", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);
  await page.locator('.canvas-node[data-node-id="circle-node"]').click();
  await pauseForUi(page);
  await page.getByRole("button", { name: "Edit path (E)" }).click();
  await pauseForUi(page);

  const positionHandle = page.getByTestId("text-path-handle-position");
  const guidePath = page.getByTestId("text-path-guide").locator("path").first();

  await expect(positionHandle).toBeVisible();
  await expect(guidePath).toBeVisible();

  const beforeGuideBox = await guidePath.boundingBox();
  const positionBox = await positionHandle.boundingBox();

  if (!(beforeGuideBox && positionBox)) {
    throw new Error("Missing guide or position handle bounds");
  }

  await page.mouse.move(
    positionBox.x + positionBox.width / 2,
    positionBox.y + positionBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    positionBox.x + positionBox.width / 2 + 220,
    positionBox.y + positionBox.height / 2 + 140,
    { steps: 16 }
  );

  const duringGuideBox = await guidePath.boundingBox();

  if (!duringGuideBox) {
    throw new Error("Missing guide bounds during path positioning");
  }

  expect(duringGuideBox.x).toBeCloseTo(beforeGuideBox.x, 1);
  expect(duringGuideBox.y).toBeCloseTo(beforeGuideBox.y, 1);
  expect(duringGuideBox.width).toBeCloseTo(beforeGuideBox.width, 1);
  expect(duringGuideBox.height).toBeCloseTo(beforeGuideBox.height, 1);

  await page.mouse.up();
});

test("keeps the rotated circle guide stable while repositioning text on the path", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);
  await page.locator('.canvas-node[data-node-id="circle-node"]').click();
  await pauseForUi(page);

  await rotateSelectionFromCorner(page, {
    drag: { x: 160, y: 100 },
  });
  await pauseForUi(page);

  await page.getByRole("button", { name: "Edit path (E)" }).click();
  await pauseForUi(page);

  const positionHandle = page.getByTestId("text-path-handle-position");
  const guidePath = page.getByTestId("text-path-guide").locator("path").first();

  await expect(positionHandle).toBeVisible();
  await expect(guidePath).toBeVisible();

  const beforeGuideBox = await guidePath.boundingBox();
  const positionBox = await positionHandle.boundingBox();

  if (!(beforeGuideBox && positionBox)) {
    throw new Error("Missing rotated guide or position handle bounds");
  }

  await page.mouse.move(
    positionBox.x + positionBox.width / 2,
    positionBox.y + positionBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    positionBox.x + positionBox.width / 2 + 220,
    positionBox.y + positionBox.height / 2 + 140,
    { steps: 16 }
  );

  const duringGuideBox = await guidePath.boundingBox();

  if (!duringGuideBox) {
    throw new Error("Missing rotated guide bounds during path positioning");
  }

  expect(duringGuideBox.x).toBeCloseTo(beforeGuideBox.x, 1);
  expect(duringGuideBox.y).toBeCloseTo(beforeGuideBox.y, 1);
  expect(duringGuideBox.width).toBeCloseTo(beforeGuideBox.width, 1);
  expect(duringGuideBox.height).toBeCloseTo(beforeGuideBox.height, 1);

  await page.mouse.up();
});

test("clears hover preview when entering path edit from node hover", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);
  const node = page.locator('.canvas-node[data-node-id="circle-node"]');

  await node.click();
  await pauseForUi(page);

  const nodeBox = await node.boundingBox();

  if (!nodeBox) {
    throw new Error("Missing circle node bounds");
  }

  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + 8);
  await pauseForUi(page);
  await page.keyboard.press("e");
  await pauseForUi(page);

  await expect(page.locator(".canvas-hover-preview")).toHaveCount(0);
});

test("enters path edit mode when circle warp is first applied", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadPlainTextDocument(page);
  await page.locator('.canvas-node[data-node-id="plain-text-node"]').click();
  await pauseForUi(page);

  await expect(
    page.getByRole("button", { name: "Delete (Delete)" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit path (E)" })).toHaveCount(
    0
  );

  await page.getByRole("button", { name: "Circle" }).click();
  await pauseForUi(page);

  await expect(
    page.getByRole("button", { name: "Done path editing (E)" })
  ).toBeVisible();
  await expect(page.getByTestId("text-path-handle-position")).toBeVisible();
});

test("exits path edit mode when circle warp is cleared", async ({ page }) => {
  await gotoEditor(page);
  await loadCircleDocument(page);
  await page.locator('.canvas-node[data-node-id="circle-node"]').click();
  await pauseForUi(page);
  await page.getByRole("button", { name: "Edit path (E)" }).click();
  await pauseForUi(page);

  await expect(
    page.getByRole("button", { name: "Done path editing (E)" })
  ).toBeVisible();
  await expect(page.getByTestId("text-path-handle-position")).toBeVisible();

  await page.getByRole("button", { name: "Clear" }).click();
  await pauseForUi(page);

  await expect(
    page.getByRole("button", { name: "Done path editing (E)" })
  ).toHaveCount(0);
  await expect(page.getByTestId("text-path-handle-position")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Delete (Delete)" })
  ).toBeVisible();
});

test("keeps the circle path transform target scaled with viewport zoom", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);
  await page.locator('.canvas-node[data-node-id="circle-node"]').click();
  await pauseForUi(page);
  await expect(
    page.locator('.canvas-text-path-target[data-node-id="circle-node"]')
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit path (E)" })
  ).toBeVisible();
  await page.keyboard.press("e");
  await pauseForUi(page);
  await setViewportZoom(page, 0.12);
  await pauseForUi(page);

  const targetBox = await page
    .locator('.canvas-text-path-target[data-node-id="circle-node"]')
    .boundingBox();

  if (!targetBox) {
    throw new Error("Missing circle transform target bounds");
  }

  expect(targetBox.width).toBeLessThan(160);
  expect(targetBox.height).toBeLessThan(160);
});

test("moves a selected circle path node by dragging the visible text", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);

  const node = page.locator('.canvas-node[data-node-id="circle-node"]');

  await node.click();
  await pauseForUi(page);

  const before = await getStateSnapshot(page);
  const nodeBox = await node.boundingBox();

  if (!nodeBox) {
    throw new Error("Missing circle node bounds");
  }

  const startX = nodeBox.x + nodeBox.width / 2;
  const startY = nodeBox.y + nodeBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 40, { steps: 12 });
  await page.mouse.up();
  await pauseForUi(page);

  const after = await getStateSnapshot(page);
  const movedNode = after.nodes.find((entry) => entry.id === "circle-node");
  const beforeNode = before.nodes.find((entry) => entry.id === "circle-node");

  expect(movedNode?.x).toBeGreaterThan((beforeNode?.x || 0) + 50);
  expect(movedNode?.y).toBeGreaterThan((beforeNode?.y || 0) + 20);
});

test("moves a circle path node by dragging the visible text while path editing", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);

  const node = page.locator('.canvas-node[data-node-id="circle-node"]');

  await node.click();
  await pauseForUi(page);
  await page.getByRole("button", { name: "Edit path (E)" }).click();
  await pauseForUi(page);

  const before = await getStateSnapshot(page);
  const nodeBox = await node.boundingBox();

  if (!nodeBox) {
    throw new Error("Missing circle node bounds");
  }

  const startX = nodeBox.x + nodeBox.width / 2;
  const startY = nodeBox.y + nodeBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 40, { steps: 12 });
  await page.mouse.up();
  await pauseForUi(page);

  const after = await getStateSnapshot(page);
  const movedNode = after.nodes.find((entry) => entry.id === "circle-node");
  const beforeNode = before.nodes.find((entry) => entry.id === "circle-node");

  expect(movedNode?.x).toBeGreaterThan((beforeNode?.x || 0) + 50);
  expect(movedNode?.y).toBeGreaterThan((beforeNode?.y || 0) + 20);
});

test("keeps the path action bar visible during drag", async ({ page }) => {
  await gotoEditor(page);
  await loadCircleDocument(page);

  const node = page.locator('.canvas-node[data-node-id="circle-node"]');
  const editButton = page.getByRole("button", { name: "Edit path (E)" });

  await node.click();
  await pauseForUi(page);
  await expect(editButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(1);

  const nodeBox = await node.boundingBox();

  if (!nodeBox) {
    throw new Error("Missing circle node bounds");
  }

  const startX = nodeBox.x + nodeBox.width / 2;
  const startY = nodeBox.y + nodeBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 40, { steps: 12 });

  await expect(editButton).toBeVisible();

  await page.mouse.up();
  await pauseForUi(page);

  await expect(editButton).toBeVisible();
});

test("uses text-sized hover preview for circle path nodes", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadCircleDocument(page);

  await page.locator('.canvas-node[data-node-id="circle-node"]').hover();
  await pauseForUi(page);

  const hoverBox = await page.locator(".canvas-hover-preview").boundingBox();

  if (!hoverBox) {
    throw new Error("Missing hover preview bounds");
  }

  expect(hoverBox.height).toBeLessThan(280);
});
