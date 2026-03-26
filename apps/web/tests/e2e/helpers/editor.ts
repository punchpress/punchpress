import { existsSync, readFileSync } from "node:fs";
import { expect } from "@playwright/test";

const stepDelayMs = Number(process.env.PUNCHPRESS_E2E_STEP_DELAY_MS || 0);
const TEST_FONT_PATHS = [
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "C:\\Windows\\Fonts\\arial.ttf",
];
const TEST_FONT_PATH = TEST_FONT_PATHS.find((candidate) =>
  existsSync(candidate)
);
const TEST_FONT_BYTES = TEST_FONT_PATH ? [...readFileSync(TEST_FONT_PATH)] : [];
const TEST_FONT_DESCRIPTOR = TEST_FONT_PATH?.toLowerCase().includes("dejavu")
  ? {
      family: "DejaVu Sans",
      fullName: "DejaVu Sans",
      id: "dejavusans",
      postscriptName: "DejaVuSans",
      style: "Book",
    }
  : {
      family: "Arial",
      fullName: "Arial",
      id: "arialmt",
      postscriptName: "ArialMT",
      style: "Regular",
    };
const TEST_FONT_DESCRIPTORS = [
  TEST_FONT_DESCRIPTOR,
  {
    family: "PunchPress Sans",
    fullName: "PunchPress Sans",
    id: "punchpresssans-regular",
    postscriptName: "PunchPressSans-Regular",
    style: "Regular",
  },
];
const HANDLE_ROTATION_DEG_REGEX = /rotate\((-?\d+(?:\.\d+)?)deg\)/;
const getDocumentFixtureContents = (fileName) => {
  return readFileSync(
    new URL(`../fixtures/documents/${fileName}`, import.meta.url),
    "utf8"
  );
};

const installLocalFontMocks = (page) => {
  return page.addInitScript(
    ({ fontBytes, fontDescriptors }) => {
      const queryLocalFonts = () => {
        return Promise.resolve(
          fontDescriptors.map((fontDescriptor) => ({
            blob: () =>
              Promise.resolve(
                new Blob([new Uint8Array(fontBytes)], {
                  type: "font/ttf",
                })
              ),
            family: fontDescriptor.family,
            fullName: fontDescriptor.fullName,
            postscriptName: fontDescriptor.postscriptName,
            style: fontDescriptor.style,
          }))
        );
      };

      Object.defineProperty(window, "queryLocalFonts", {
        configurable: true,
        value: queryLocalFonts,
      });
    },
    {
      fontBytes: TEST_FONT_BYTES,
      fontDescriptors: TEST_FONT_DESCRIPTORS,
    }
  );
};

export const gotoEditor = async (page) => {
  await installLocalFontMocks(page);
  await page.goto("/");
  await page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.requestLocalFonts();
  });
  await expect(page.getByRole("button", { name: "Text (T)" })).toBeVisible();
};

export const pauseForUi = async (page, duration = stepDelayMs) => {
  if (duration <= 0) {
    return;
  }

  await page.waitForTimeout(duration);
};

export const getNodeSnapshot = (page, nodeId) => {
  return getDebugDump(page).then((dump) => {
    const node = dump?.nodes?.find((item) => item.id === nodeId);

    if (!node) {
      return null;
    }

    return {
      bbox: node.geometry?.bbox || null,
      elementRect: node.elementRect || null,
      fontSize: node.fontSize,
      height: node.height ?? null,
      id: node.id,
      ready: Boolean(node.geometry?.ready),
      rotation: node.rotation || 0,
      shape: node.shape ?? null,
      strokeWidth: node.strokeWidth,
      text: node.text,
      tracking: node.tracking,
      width: node.width ?? null,
      x: node.transform?.x || 0,
      y: node.transform?.y || 0,
    };
  });
};

export const getDebugDump = (page) => {
  return page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.getDebugDump();
  });
};

export const getSelectionSnapshot = (page) => {
  return getDebugDump(page).then((dump) => ({
    handles: dump?.selection?.handleRects || {},
    selectedNodeIds: dump?.selection?.ids || [],
    selectedNodeId: dump?.selection?.primaryId || null,
    zoom: dump?.viewport?.zoom || 1,
  }));
};

export const panViewportBy = (page, delta) => {
  return page.evaluate((nextDelta) => {
    const viewer = window.__PUNCHPRESS_EDITOR__?.viewerRef;

    if (!viewer) {
      return false;
    }

    viewer.scrollBy(nextDelta?.x || 0, nextDelta?.y || 0);
    window.requestAnimationFrame(() => {
      window.__PUNCHPRESS_EDITOR__?.onViewportChange?.();
    });

    return true;
  }, delta);
};

export const getStateSnapshot = (page) => {
  return getDebugDump(page).then((dump) => ({
    activeTool: dump?.tool || "pointer",
    editingNodeId: dump?.editing?.nodeId || null,
    nodes:
      dump?.nodes?.map((node) => ({
        fill: node.fill,
        fontSize: node.fontSize,
        font: node.font,
        height: node.height ?? null,
        id: node.id,
        rotation: node.rotation || 0,
        shape: node.shape ?? null,
        stroke: node.stroke,
        strokeWidth: node.strokeWidth,
        text: node.text,
        tracking: node.tracking,
        type: node.type,
        visible: node.visible,
        warp: node.warp,
        width: node.width ?? null,
        x: node.transform?.x || 0,
        y: node.transform?.y || 0,
      })) || [],
    selectedNodeIds: dump?.selection?.ids || [],
    selectedNodeId: dump?.selection?.primaryId || null,
    zoom: dump?.viewport?.zoom || 1,
  }));
};

export const getCanvasNodeIds = (page) => {
  return page.locator("[data-node-id]").evaluateAll((elements) => {
    return elements
      .map((element) => element.getAttribute("data-node-id"))
      .filter(Boolean);
  });
};

export const loadDocument = (page, contents) => {
  return page.evaluate((nextContents) => {
    return window.__PUNCHPRESS_EDITOR__?.loadDocument(nextContents);
  }, contents);
};

export const resetViewport = (page) => {
  return page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const viewer = editor?.viewerRef;

    if (!(editor && viewer)) {
      return false;
    }

    editor.cancelPendingViewportFocus();
    viewer.setTo?.({
      x: 0,
      y: 0,
      zoom: 1,
    });
    editor.setViewportZoom(1);
    editor.onViewportChange?.();

    return true;
  });
};

export const loadDocumentFixture = async (page, fileName) => {
  await loadDocument(page, getDocumentFixtureContents(fileName));
  await resetViewport(page);
};

export const serializeDocument = (page) => {
  return page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.serializeDocument();
  });
};

export const exportDocument = (page) => {
  return page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.exportDocument();
  });
};

export const getHandleIconRotationDeg = (handle) => {
  return handle
    .locator('span[style*="rotate("]')
    .first()
    .evaluate((element, regexSource) => {
      const transform =
        element instanceof HTMLElement ? element.style.transform : "";
      const match = transform.match(new RegExp(regexSource));

      return match ? Number.parseFloat(match[1] || "0") : 0;
    }, HANDLE_ROTATION_DEG_REGEX.source);
};

const getHandleCenter = (handle) => {
  return {
    x: handle.x + handle.width / 2,
    y: handle.y + handle.height / 2,
  };
};

const dragFromSelectionCorner = async (
  page,
  { corner = "nw", drag = { x: 120, y: 80 }, offset = 0, release = true } = {}
) => {
  const selection = await waitForSelectionHandles(page);
  const handle = selection.handles[corner];

  if (!handle) {
    throw new Error(`Missing ${corner} selection handle for corner rotation`);
  }

  const handleCenter = getHandleCenter(handle);
  const start = {
    x: handleCenter.x + (corner.endsWith("e") ? offset : -offset),
    y: handleCenter.y + (corner.startsWith("s") ? offset : -offset),
  };
  const end = {
    x: start.x + drag.x,
    y: start.y + drag.y,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 20 });

  if (release) {
    await page.mouse.up();
  }

  return { end, start };
};

export const resizeSelectionFromCorner = async (page, options) => {
  const corner = options?.corner || "se";
  const drag = options?.drag || { x: 120, y: 80 };
  const handle = page.locator(
    `.canvas-moveable .moveable-control.moveable-${corner}`
  );

  await expect(handle).toBeVisible();

  const box = await handle.boundingBox();

  if (!box) {
    throw new Error(`Missing ${corner} resize handle`);
  }

  const start = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
  const end = {
    x: start.x + drag.x,
    y: start.y + drag.y,
  };

  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 24 });
  await page.mouse.up();
};

export const resizeSelectionFromEdge = async (page, options) => {
  const edge = options?.edge || "e";
  const drag = options?.drag || { x: 80, y: 0 };
  const handle = page.locator(`.canvas-moveable [data-edge="${edge}"]`);

  await expect(handle).toBeVisible();

  const box = await handle.boundingBox();

  if (!box) {
    throw new Error(`Missing ${edge} resize edge`);
  }

  const start = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
  const end = {
    x: start.x + drag.x,
    y: start.y + drag.y,
  };

  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 24 });
  await page.mouse.up();
};

export const rotateSelectionFromCorner = async (page, options) => {
  await dragFromSelectionCorner(page, {
    ...options,
    offset: options?.offset ?? 20,
  });
};

export const rotateSelectionFromCornerWithoutRelease = (page, options) => {
  // Rotation starts just outside the visible corner handle.
  // The corner itself remains the resize affordance.
  return dragFromSelectionCorner(page, {
    ...options,
    offset: options?.offset ?? 20,
    release: false,
  });
};

export const getGroupRotationPreviewRect = async (page) => {
  const locator = page.locator(".canvas-multi-node-transform-overlay");

  if ((await locator.count()) === 0) {
    return null;
  }

  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
      x: rect.x,
      y: rect.y,
    };
  });
};

export const getHoverPreviewRect = async (page) => {
  const locator = page.locator(".canvas-hover-preview");

  if ((await locator.count()) === 0) {
    return null;
  }

  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
      x: rect.x,
      y: rect.y,
    };
  });
};

export const getSelectionBoxRect = async (page) => {
  const selection = await waitForSelectionHandles(page);
  const { nw, se } = selection.handles;

  return {
    bottom: se.y + se.height / 2,
    height: se.y + se.height / 2 - (nw.y + nw.height / 2),
    left: nw.x + nw.width / 2,
    right: se.x + se.width / 2,
    top: nw.y + nw.height / 2,
    width: se.x + se.width / 2 - (nw.x + nw.width / 2),
    x: nw.x + nw.width / 2,
    y: nw.y + nw.height / 2,
  };
};

export const dragLayerBelow = async (page, sourceLabel, targetLabel) => {
  const source = page.getByRole("button", { name: sourceLabel }).first();
  const target = page.getByRole("button", { name: targetLabel }).first();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!(sourceBox && targetBox)) {
    throw new Error("Missing layer row bounds for drag reorder");
  }

  const sourceX = sourceBox.x + Math.min(36, sourceBox.width / 2);
  const sourceY = sourceBox.y + sourceBox.height / 2;
  const targetX = targetBox.x + Math.min(36, targetBox.width / 2);
  const targetY = targetBox.y + targetBox.height * 0.8;

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.mouse.move(sourceX, sourceY + 12, { steps: 4 });
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await page.mouse.up();
};

export const marqueeSelect = async (page, from, to) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
};

export const shiftClickLayer = async (page, label) => {
  await page.keyboard.down("Shift");
  await page.getByRole("button", { name: label }).first().click();
  await page.keyboard.up("Shift");
};

export const dragNodeBy = async (page, nodeId, delta, options) => {
  const snapshot = await waitForNodeReady(page, nodeId);
  const rect = snapshot.elementRect;

  if (!rect) {
    throw new Error(`Missing node rect for ${nodeId}`);
  }

  const start = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
  const end = {
    x: start.x + (delta.x || 0),
    y: start.y + (delta.y || 0),
  };

  if (options?.altKey) {
    await page.keyboard.down("Alt");
  }

  try {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
  } finally {
    if (options?.altKey) {
      await page.keyboard.up("Alt");
    }
  }
};

export const waitForNodeReady = async (page, nodeId) => {
  await expect
    .poll(async () => {
      const snapshot = await getNodeSnapshot(page, nodeId);
      if (!(snapshot?.ready && snapshot.elementRect)) {
        return null;
      }

      return snapshot;
    })
    .not.toBeNull();

  return getNodeSnapshot(page, nodeId);
};

export const waitForSelectionHandles = async (page) => {
  await expect
    .poll(async () => {
      const selection = await getSelectionSnapshot(page);
      return Boolean(selection.handles.nw && selection.handles.se);
    })
    .toBe(true);

  return getSelectionSnapshot(page);
};

export const zoomIn = async (page, times = 1) => {
  for (let index = 0; index < times; index += 1) {
    await page.getByRole("button", { name: "Zoom in" }).click();
  }
};

export const zoomOut = async (page, times = 1) => {
  for (let index = 0; index < times; index += 1) {
    await page.getByRole("button", { name: "Zoom out" }).click();
  }
};

export const expectRectShift = (
  beforeRect,
  afterRect,
  delta,
  tolerance = 6
) => {
  expect(Math.abs(afterRect.x - beforeRect.x - delta.x)).toBeLessThanOrEqual(
    tolerance
  );
  expect(Math.abs(afterRect.y - beforeRect.y - delta.y)).toBeLessThanOrEqual(
    tolerance
  );
};

export const expectCoordinateShift = (before, after, delta, tolerance = 6) => {
  expect(Math.abs(after.x - before.x - delta.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(after.y - before.y - delta.y)).toBeLessThanOrEqual(tolerance);
};

export const expectHandleAlignedToNodeCorner = (
  handleRect,
  nodeRect,
  corner,
  tolerance = 14
) => {
  const handleCenterX = handleRect.x + handleRect.width / 2;
  const handleCenterY = handleRect.y + handleRect.height / 2;

  const expectedX = corner.endsWith("e") ? nodeRect.right : nodeRect.left;
  const expectedY = corner.startsWith("s") ? nodeRect.bottom : nodeRect.top;

  expect(Math.abs(handleCenterX - expectedX)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(handleCenterY - expectedY)).toBeLessThanOrEqual(tolerance);
};
