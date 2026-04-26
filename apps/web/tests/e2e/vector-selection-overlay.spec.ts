import { expect, test } from "@playwright/test";
import { gotoEditor, loadDocument, pauseForUi } from "./helpers/editor";

const VECTOR_DOCUMENT = JSON.stringify({
  nodes: [
    {
      id: "vector-container",
      name: "Vector",
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
    {
      closed: true,
      fill: "#ffffff",
      fillRule: "nonzero",
      id: "vector-path-2",
      parentId: "vector-container",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -40, y: -30 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 70, y: -30 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 70, y: 50 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -40, y: 50 },
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
        x: 120,
        y: 150,
      },
      type: "path",
      visible: true,
    },
  ],
  version: "1.7",
});

const MULTI_COMPOUND_VECTOR_DOCUMENT = JSON.stringify({
  nodes: [
    {
      id: "compound-vector-a",
      name: "Compound A",
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
      id: "compound-a-path-1",
      parentId: "compound-vector-a",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -100, y: -60 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 100, y: -60 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 100, y: 60 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -100, y: 60 },
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
        x: 240,
        y: 160,
      },
      type: "path",
      visible: true,
    },
    {
      closed: true,
      fill: "#ffffff",
      fillRule: "nonzero",
      id: "compound-a-path-2",
      parentId: "compound-vector-a",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -40, y: -30 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 70, y: -30 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 70, y: 50 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -40, y: 50 },
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
        x: 130,
        y: 120,
      },
      type: "path",
      visible: true,
    },
    {
      id: "compound-vector-b",
      name: "Compound B",
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
      id: "compound-b-path-1",
      parentId: "compound-vector-b",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -110, y: -70 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 110, y: -70 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 110, y: 70 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -110, y: 70 },
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
        x: 660,
        y: 380,
      },
      type: "path",
      visible: true,
    },
    {
      closed: true,
      fill: "#ffffff",
      fillRule: "nonzero",
      id: "compound-b-path-2",
      parentId: "compound-vector-b",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -45, y: -35 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 75, y: -35 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 75, y: 55 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -45, y: 55 },
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
        x: 560,
        y: 330,
      },
      type: "path",
      visible: true,
    },
  ],
  version: "1.7",
});

const IRREGULAR_MULTI_COMPOUND_VECTOR_DOCUMENT = JSON.stringify({
  nodes: [
    {
      id: "compound-a",
      name: "Compound A",
      pathComposition: "subtract",
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
      id: "compound-a-path-1",
      parentId: "compound-a",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -110, y: -90 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 110, y: -90 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 110, y: 110 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -110, y: 110 },
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
        y: 260,
      },
      type: "path",
      visible: true,
    },
    {
      closed: true,
      fill: "#ffffff",
      fillRule: "nonzero",
      id: "compound-a-path-2",
      parentId: "compound-a",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -35, y: -180 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 35, y: -180 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 55, y: 40 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -55, y: 40 },
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
        x: 330,
        y: 310,
      },
      type: "path",
      visible: true,
    },
    {
      id: "compound-b",
      name: "Compound B",
      pathComposition: "subtract",
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
      id: "compound-b-path-1",
      parentId: "compound-b",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -120, y: -80 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 120, y: -80 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 120, y: 120 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -120, y: 120 },
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
        x: 560,
        y: 320,
      },
      type: "path",
      visible: true,
    },
    {
      closed: true,
      fill: "#ffffff",
      fillRule: "nonzero",
      id: "compound-b-path-2",
      parentId: "compound-b",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -45, y: -170 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 45, y: -170 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 70, y: 30 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -70, y: 30 },
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
        x: 620,
        y: 350,
      },
      type: "path",
      visible: true,
    },
  ],
  version: "1.7",
});

const getElementRect = async (page, selector) => {
  const locator = page.locator(selector).first();
  const rect = await locator.boundingBox();

  if (!rect) {
    return null;
  }

  return {
    height: rect.height,
    width: rect.width,
    x: rect.x,
    y: rect.y,
  };
};

const getVectorArtRect = (page, nodeId) => {
  return page.evaluate((targetNodeId) => {
    const node = document.querySelector(
      `.canvas-node[data-node-id="${targetNodeId}"]`
    );

    if (!(node instanceof HTMLElement)) {
      return null;
    }

    const rects = [...node.querySelectorAll("svg path")]
      .map((path) => path.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);

    if (rects.length === 0) {
      return null;
    }

    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));

    return {
      height: bottom - top,
      width: right - left,
      x: left,
      y: top,
    };
  }, nodeId);
};

const rotatePointAround = (point, center, rotation) => {
  const angle = (rotation * Math.PI) / 180;
  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;

  return {
    x: center.x + offsetX * Math.cos(angle) - offsetY * Math.sin(angle),
    y: center.y + offsetX * Math.sin(angle) + offsetY * Math.cos(angle),
  };
};

const getTransformedElementCorners = (page, selectors) => {
  return page.evaluate((targetSelectors) => {
    const getElementCorners = (selector) => {
      const element = document.querySelector(selector);

      if (!(element instanceof HTMLElement)) {
        return null;
      }

      const offsetParent =
        element.offsetParent instanceof HTMLElement
          ? element.offsetParent
          : null;
      const parentRect = offsetParent?.getBoundingClientRect?.();
      const transform = window.getComputedStyle(element).transform;
      const transformOrigin = window.getComputedStyle(element).transformOrigin;

      if (!(parentRect && transformOrigin)) {
        return null;
      }

      const matrix =
        transform && transform !== "none"
          ? new DOMMatrixReadOnly(transform)
          : new DOMMatrixReadOnly();
      const [originXToken, originYToken] = transformOrigin.split(" ");
      const originX = Number.parseFloat(originXToken);
      const originY = Number.parseFloat(originYToken);
      const baseLeft = parentRect.left + element.offsetLeft;
      const baseTop = parentRect.top + element.offsetTop;
      const width = element.offsetWidth;
      const height = element.offsetHeight;

      const projectCorner = (x, y) => {
        const localX = x - originX;
        const localY = y - originY;

        return {
          x:
            baseLeft +
            originX +
            matrix.a * localX +
            matrix.c * localY +
            matrix.e,
          y:
            baseTop +
            originY +
            matrix.b * localX +
            matrix.d * localY +
            matrix.f,
        };
      };

      return {
        corners: {
          ne: projectCorner(width, 0),
          nw: projectCorner(0, 0),
          se: projectCorner(width, height),
          sw: projectCorner(0, height),
        },
      };
    };

    return targetSelectors.map((selector) => getElementCorners(selector));
  }, selectors);
};

const getRenderedPathSamplePoints = (page, nodeIds) => {
  return page.evaluate((targetNodeIds) => {
    const samplePath = (path) => {
      const svg = path.ownerSVGElement;
      const ctm = path.getScreenCTM();

      if (!(svg && ctm)) {
        return [];
      }

      const totalLength = path.getTotalLength();
      const steps = Math.max(16, Math.ceil(totalLength / 18));

      return Array.from({ length: steps + 1 }, (_, index) => {
        const distance = (totalLength * index) / steps;
        const pathPoint = path.getPointAtLength(distance);
        const svgPoint = svg.createSVGPoint();

        svgPoint.x = pathPoint.x;
        svgPoint.y = pathPoint.y;

        const screenPoint = svgPoint.matrixTransform(ctm);

        return {
          x: screenPoint.x,
          y: screenPoint.y,
        };
      });
    };

    return targetNodeIds.flatMap((nodeId) => {
      const node = document.querySelector(
        `.canvas-node[data-node-id="${nodeId}"]`
      );

      if (!(node instanceof HTMLElement)) {
        return [];
      }

      return [...node.querySelectorAll("svg path")].flatMap((path) => {
        return path instanceof SVGPathElement ? samplePath(path) : [];
      });
    });
  }, nodeIds);
};

const rotateMultiSelectionFromZone = async (
  page,
  {
    corner = "nw",
    drag = {
      x: 160,
      y: 120,
    },
  } = {}
) => {
  const zone = page.locator(
    `.canvas-multi-node-rotation-zone[data-corner="${corner}"]`
  );
  await expect(zone).toBeVisible();

  const box = await zone.boundingBox();

  if (!box) {
    throw new Error(`Missing ${corner} multi-selection rotation zone`);
  }

  const start = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + drag.x, start.y + drag.y, { steps: 24 });
  await page.mouse.up();
};

const getSelectionHandleAngle = (page) => {
  return page.evaluate(() => {
    const getHandleCenter = (corner) => {
      const rect = window.__PUNCHPRESS_EDITOR__?.hostRef
        ?.querySelector(`.canvas-moveable .moveable-control.moveable-${corner}`)
        ?.getBoundingClientRect?.();

      if (!rect) {
        return null;
      }

      return {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      };
    };

    const nw = getHandleCenter("nw");
    const ne = getHandleCenter("ne");

    return nw && ne
      ? (Math.atan2(ne.y - nw.y, ne.x - nw.x) * 180) / Math.PI
      : null;
  });
};

const expectVectorTransformOverlay = async (page) => {
  const overlay = page.locator(".canvas-multi-selection");
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

test("rotating a compound vector keeps a stable rotated selection box", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, VECTOR_DOCUMENT);

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("vector-container");
    window.__PUNCHPRESS_EDITOR__?.rotateSelectionBy({ deltaRotation: 30 });
  });
  await pauseForUi(page);

  const overlayAngle = await getSelectionHandleAngle(page);
  const childRotation = await page.evaluate(() => {
    const firstPath = window.__PUNCHPRESS_EDITOR__
      ?.getDebugDump()
      ?.nodes.find((node) => node.id === "vector-path");

    return firstPath?.rotation ?? null;
  });

  expect(Math.abs(overlayAngle || 0)).toBeGreaterThan(8);
  expect(Math.abs(childRotation || 0)).toBeGreaterThan(8);
  expect(overlayAngle).toBeCloseTo(childRotation || 0, 1);
});

test("scaling a compound vector keeps the rendered art aligned live", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, VECTOR_DOCUMENT);

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("vector-container");
  });

  const handle = page.locator(".canvas-moveable .moveable-control.moveable-se");
  const beforeNodeRect = await getElementRect(
    page,
    '.canvas-node[data-node-id="vector-container"]'
  );
  const handleBox = await handle.boundingBox();

  expect(beforeNodeRect).not.toBeNull();
  expect(handleBox).not.toBeNull();

  if (!(beforeNodeRect && handleBox)) {
    return;
  }

  const start = {
    x: handleBox.x + handleBox.width / 2,
    y: handleBox.y + handleBox.height / 2,
  };

  await handle.hover();
  await page.mouse.down();

  try {
    await page.mouse.move(start.x - 90, start.y - 70, { steps: 24 });

    await expect
      .poll(async () => {
        const rect = await getElementRect(
          page,
          '.canvas-node[data-node-id="vector-container"]'
        );

        return rect?.width ?? null;
      })
      .toBeLessThan(beforeNodeRect.width - 40);

    const duringNodeRect = await getElementRect(
      page,
      '.canvas-node[data-node-id="vector-container"]'
    );
    const duringArtRect = await getVectorArtRect(page, "vector-container");

    expect(duringNodeRect).not.toBeNull();
    expect(duringArtRect).not.toBeNull();

    if (!(duringNodeRect && duringArtRect)) {
      return;
    }

    expect(Math.abs(duringArtRect.width - duringNodeRect.width)).toBeLessThan(
      6
    );
    expect(Math.abs(duringArtRect.height - duringNodeRect.height)).toBeLessThan(
      6
    );
    expect(Math.abs(duringArtRect.x - duringNodeRect.x)).toBeLessThan(6);
    expect(Math.abs(duringArtRect.y - duringNodeRect.y)).toBeLessThan(6);
  } finally {
    await page.mouse.up();
  }

  await pauseForUi(page);
});

test("rotating two compound vectors keeps the multi-selection box aligned after release", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, MULTI_COMPOUND_VECTOR_DOCUMENT);

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.setSelectedNodes([
      "compound-vector-a",
      "compound-vector-b",
    ]);
  });

  await rotateMultiSelectionFromZone(page, {
    corner: "nw",
    drag: { x: 160, y: 120 },
  });
  await pauseForUi(page);

  const [overlay, firstNode, secondNode] = await getTransformedElementCorners(
    page,
    [
      ".canvas-multi-selection",
      '[data-node-id="compound-vector-a"]',
      '[data-node-id="compound-vector-b"]',
    ]
  );
  expect(overlay).not.toBeNull();
  expect(firstNode).not.toBeNull();
  expect(secondNode).not.toBeNull();

  if (!(overlay && firstNode && secondNode)) {
    return;
  }

  const overlayCorners = Object.values(overlay.corners);
  const overlayCenter = {
    x:
      overlayCorners.reduce((sum, point) => sum + point.x, 0) /
      overlayCorners.length,
    y:
      overlayCorners.reduce((sum, point) => sum + point.y, 0) /
      overlayCorners.length,
  };
  const overlayAngle =
    (Math.atan2(
      overlay.corners.ne.y - overlay.corners.nw.y,
      overlay.corners.ne.x - overlay.corners.nw.x
    ) *
      180) /
    Math.PI;
  const unrotatedOverlayCorners = overlayCorners.map((point) => {
    return rotatePointAround(point, overlayCenter, -overlayAngle);
  });
  const overlayBounds = {
    maxX: Math.max(...unrotatedOverlayCorners.map((point) => point.x)),
    maxY: Math.max(...unrotatedOverlayCorners.map((point) => point.y)),
    minX: Math.min(...unrotatedOverlayCorners.map((point) => point.x)),
    minY: Math.min(...unrotatedOverlayCorners.map((point) => point.y)),
  };

  for (const point of [
    ...Object.values(firstNode.corners),
    ...Object.values(secondNode.corners),
  ]) {
    const unrotatedPoint = rotatePointAround(
      point,
      overlayCenter,
      -overlayAngle
    );

    expect(unrotatedPoint.x).toBeGreaterThanOrEqual(overlayBounds.minX - 6);
    expect(unrotatedPoint.x).toBeLessThanOrEqual(overlayBounds.maxX + 6);
    expect(unrotatedPoint.y).toBeGreaterThanOrEqual(overlayBounds.minY - 6);
    expect(unrotatedPoint.y).toBeLessThanOrEqual(overlayBounds.maxY + 6);
  }

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.clearSelection();
    window.__PUNCHPRESS_EDITOR__?.setSelectedNodes([
      "compound-vector-a",
      "compound-vector-b",
    ]);
  });
  await pauseForUi(page);

  const [reselectedOverlay] = await getTransformedElementCorners(page, [
    ".canvas-multi-selection",
  ]);

  expect(reselectedOverlay).not.toBeNull();

  if (!reselectedOverlay) {
    return;
  }

  expect(reselectedOverlay.corners.nw.x).toBeCloseTo(overlay.corners.nw.x, 1);
  expect(reselectedOverlay.corners.nw.y).toBeCloseTo(overlay.corners.nw.y, 1);
  expect(reselectedOverlay.corners.se.x).toBeCloseTo(overlay.corners.se.x, 1);
  expect(reselectedOverlay.corners.se.y).toBeCloseTo(overlay.corners.se.y, 1);
});

test("rotating irregular compound vectors keeps the multi-selection box tight to the rendered paths", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, IRREGULAR_MULTI_COMPOUND_VECTOR_DOCUMENT);

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.setSelectedNodes([
      "compound-a",
      "compound-b",
    ]);
    window.__PUNCHPRESS_EDITOR__?.rotateSelectionBy({ deltaRotation: 28 });
  });
  await pauseForUi(page);

  const selectedNodeIds = await page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.selectedNodeIds || [];
  });

  expect(selectedNodeIds).toEqual(["compound-a", "compound-b"]);

  const [overlay] = await getTransformedElementCorners(page, [
    ".canvas-multi-selection",
  ]);
  const renderedPoints = await getRenderedPathSamplePoints(page, [
    "compound-a",
    "compound-b",
  ]);

  expect(overlay).not.toBeNull();
  expect(renderedPoints.length).toBeGreaterThan(0);

  if (!(overlay && renderedPoints.length > 0)) {
    return;
  }

  const overlayCorners = Object.values(overlay.corners);
  const overlayCenter = {
    x:
      overlayCorners.reduce((sum, point) => sum + point.x, 0) /
      overlayCorners.length,
    y:
      overlayCorners.reduce((sum, point) => sum + point.y, 0) /
      overlayCorners.length,
  };
  const overlayAngle =
    (Math.atan2(
      overlay.corners.ne.y - overlay.corners.nw.y,
      overlay.corners.ne.x - overlay.corners.nw.x
    ) *
      180) /
    Math.PI;
  const unrotatedOverlayCorners = overlayCorners.map((point) => {
    return rotatePointAround(point, overlayCenter, -overlayAngle);
  });
  const overlayBounds = {
    maxX: Math.max(...unrotatedOverlayCorners.map((point) => point.x)),
    maxY: Math.max(...unrotatedOverlayCorners.map((point) => point.y)),
    minX: Math.min(...unrotatedOverlayCorners.map((point) => point.x)),
    minY: Math.min(...unrotatedOverlayCorners.map((point) => point.y)),
  };
  const unrotatedRenderedPoints = renderedPoints.map((point) => {
    return rotatePointAround(point, overlayCenter, -overlayAngle);
  });
  const renderedBounds = {
    maxX: Math.max(...unrotatedRenderedPoints.map((point) => point.x)),
    maxY: Math.max(...unrotatedRenderedPoints.map((point) => point.y)),
    minX: Math.min(...unrotatedRenderedPoints.map((point) => point.x)),
    minY: Math.min(...unrotatedRenderedPoints.map((point) => point.y)),
  };

  expect(Math.abs(overlayBounds.minX - renderedBounds.minX)).toBeLessThan(10);
  expect(Math.abs(overlayBounds.maxX - renderedBounds.maxX)).toBeLessThan(10);
  expect(Math.abs(overlayBounds.minY - renderedBounds.minY)).toBeLessThan(10);
  expect(Math.abs(overlayBounds.maxY - renderedBounds.maxY)).toBeLessThan(10);
});
