import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  exportDocument,
  gotoEditor,
  panViewportBy,
  resizeSelectionFromCorner,
  waitForSelectionHandles,
  zoomOut,
} from "./helpers/editor";

const ARCH_WARP_SVG = `
  <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M423.75 212.481C284.346 72.1556 137.665 154.012 81.75 212.481L158.863 377C158.863 377 195.023 341.254 258.867 341.254C322.71 341.254 355.65 377 355.65 377L423.75 212.481Z" stroke="black" stroke-width="40" stroke-linejoin="round"/>
    <path d="M394.75 289C323.119 239.796 224.939 202.059 121.75 289" stroke="black" stroke-width="40"/>
  </svg>
`;
const TRANSLATE_TRANSFORM_RE = /^translate(3d)?\(/;
const WHITESPACE_RE = /\s+/;
const LARGE_SVG_FIXTURE = readFileSync(
  new URL("../../public/performance/large-svg.svg", import.meta.url),
  "utf8"
);

const importSvgIntoDocument = (page, source) => {
  return page.evaluate(async (nextSource) => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return null;
    }

    const module = await import("/src/platform/svg-import-document.ts");
    const nodes = await module.importSvgToNodes(nextSource, {
      targetCenter: editor.getViewportCenter?.(),
    });

    editor.insertNodes(nodes);
    return editor.getDebugDump();
  }, source);
};

const getImportedCenter = (dump) => {
  const importedBounds = (dump?.nodes || []).reduce(
    (bounds, node) => {
      const frameBounds = node.frame?.bounds;

      if (!frameBounds) {
        return bounds;
      }

      return {
        minX: Math.min(bounds.minX, frameBounds.minX),
        minY: Math.min(bounds.minY, frameBounds.minY),
        maxX: Math.max(bounds.maxX, frameBounds.maxX),
        maxY: Math.max(bounds.maxY, frameBounds.maxY),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );

  return {
    x: (importedBounds.minX + importedBounds.maxX) / 2,
    y: (importedBounds.minY + importedBounds.maxY) / 2,
  };
};

const getImportedGroup = (dump) => {
  return dump?.nodes?.find((node) => node.type === "group") || null;
};

const getPointDistance = (a, b) => {
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const getSelectionTopEdgeAngle = async (page) => {
  const selection = await waitForSelectionHandles(page);
  const nw = selection.handles.nw;
  const ne = selection.handles.ne;

  return (Math.atan2(ne.y - nw.y, ne.x - nw.x) * 180) / Math.PI;
};

const getRenderedSelectionTopEdgeAngle = async (page) => {
  const getHandleCenter = async (corner) => {
    const handle = page.locator(
      `.canvas-moveable .moveable-control.moveable-${corner}`
    );

    await expect(handle).toBeVisible();

    const box = await handle.boundingBox();

    if (!box) {
      throw new Error(`Missing rendered ${corner} selection handle`);
    }

    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
  };
  const nw = await getHandleCenter("nw");
  const ne = await getHandleCenter("ne");

  return (Math.atan2(ne.y - nw.y, ne.x - nw.x) * 180) / Math.PI;
};

const getBestCornerDistance = (actualCorners, expectedCorners) => {
  const visit = (remaining, index, distance) => {
    if (index >= actualCorners.length) {
      return distance;
    }

    return Math.min(
      ...remaining.map((corner, cornerIndex) =>
        visit(
          remaining.filter((_, indexToKeep) => indexToKeep !== cornerIndex),
          index + 1,
          Math.max(distance, getPointDistance(actualCorners[index], corner))
        )
      )
    );
  };

  return visit(expectedCorners, 0, 0);
};

const readRenderedPathCornersByFill = (page, fill) => {
  return page.evaluate((targetFill) => {
    const path = [...document.querySelectorAll(".canvas-node-layer path")].find(
      (element) => element.getAttribute("fill")?.toLowerCase() === targetFill
    );

    if (!(path instanceof SVGGraphicsElement)) {
      return null;
    }

    const bbox = path.getBBox();
    const matrix = path.getScreenCTM();

    if (!matrix) {
      return null;
    }

    return [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
      { x: bbox.x, y: bbox.y + bbox.height },
    ].map((point) => {
      const transformedPoint = new DOMPoint(point.x, point.y).matrixTransform(
        matrix
      );

      return {
        x: transformedPoint.x,
        y: transformedPoint.y,
      };
    });
  }, fill);
};

const getGroupChildren = (dump, groupId) => {
  return (dump?.nodes || []).filter((node) => node.parentId === groupId);
};

const dispatchSvgFileDrop = async (page, source, point) => {
  const dataTransfer = await page.evaluateHandle((nextSource) => {
    const transfer = new DataTransfer();
    const file = new File([nextSource], "dropped-artwork.svg", {
      type: "image/svg+xml",
    });

    transfer.items.add(file);
    return transfer;
  }, source);

  const canvasHost = page.locator(".canvas-host");

  await canvasHost.dispatchEvent("dragover", {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    dataTransfer,
  });
  await canvasHost.dispatchEvent("drop", {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    dataTransfer,
  });
};

const getCanvasPointFromClientPoint = (page, point) => {
  return page.evaluate((clientPoint) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const host = editor?.hostRef;
    const viewer = editor?.viewerRef;

    if (!(editor && host && viewer)) {
      return null;
    }

    const rect = host.getBoundingClientRect();

    return {
      x: viewer.getScrollLeft() + (clientPoint.x - rect.left) / editor.zoom,
      y: viewer.getScrollTop() + (clientPoint.y - rect.top) / editor.zoom,
    };
  }, point);
};

const getClientPointFromCanvasPoint = (page, point) => {
  return page.evaluate((canvasPoint) => {
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
};

const getRenderedNodeBounds = (page, nodeId) => {
  return page.locator(`.canvas-node[data-node-id="${nodeId}"]`).boundingBox();
};

test("imports svg artwork centered in the current viewport", async ({
  page,
}) => {
  await gotoEditor(page);
  await panViewportBy(page, { x: 1400, y: 900 });

  const dump = await importSvgIntoDocument(page, ARCH_WARP_SVG);
  const viewportCenter = await page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.getViewportCenter() || null;
  });
  const importedGroup = getImportedGroup(dump);
  const importedCenter = getImportedCenter(dump);

  expect(importedGroup).not.toBeNull();
  expect(getGroupChildren(dump, importedGroup?.id)).toHaveLength(2);
  expect(dump?.selection?.ids).toEqual([importedGroup?.id]);
  expect(viewportCenter).not.toBeNull();
  expect(Math.abs(importedCenter.x - viewportCenter.x)).toBeLessThanOrEqual(5);
  expect(Math.abs(importedCenter.y - viewportCenter.y)).toBeLessThanOrEqual(5);
});

test("imports an SVG file dropped from the OS onto the canvas", async ({
  page,
}) => {
  await gotoEditor(page);
  await panViewportBy(page, { x: 900, y: 650 });

  const canvasHost = page.locator(".canvas-host");
  const hostBox = await canvasHost.boundingBox();

  if (!hostBox) {
    throw new Error("Expected canvas host to have layout bounds");
  }

  const dropClientPoint = {
    x: hostBox.x + hostBox.width * 0.38,
    y: hostBox.y + hostBox.height * 0.44,
  };
  const targetCanvasPoint = await getCanvasPointFromClientPoint(
    page,
    dropClientPoint
  );

  await dispatchSvgFileDrop(page, ARCH_WARP_SVG, dropClientPoint);

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getDebugDump()?.nodes?.length || 0;
      });
    })
    .toBeGreaterThan(0);

  const dump = await page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.getDebugDump() || null;
  });
  const importedGroup = getImportedGroup(dump);
  const importedCenter = getImportedCenter(dump);

  expect(importedGroup).not.toBeNull();
  expect(targetCanvasPoint).not.toBeNull();
  expect(dump?.nodes?.length).toBeGreaterThan(0);
  expect(dump?.selection?.ids).toEqual([importedGroup?.id]);
  expect(getGroupChildren(dump, importedGroup?.id)).toHaveLength(2);
  expect(Math.abs(importedCenter.x - targetCanvasPoint.x)).toBeLessThanOrEqual(
    5
  );
  expect(Math.abs(importedCenter.y - targetCanvasPoint.y)).toBeLessThanOrEqual(
    5
  );
});

test("preserves SVG group opacity while rendering imported paths", async ({
  page,
}) => {
  await gotoEditor(page);

  const fillerPaths = Array.from({ length: 301 }, (_, index) => {
    const x = index % 43;
    const y = Math.floor(index / 43);

    return `<path d="M ${x * 3} ${y * 3} L ${x * 3 + 1} ${y * 3} L ${x * 3 + 1} ${y * 3 + 1} L ${x * 3} ${y * 3 + 1} Z" fill="#3AAAFF" />`;
  }).join("");
  const dump = await importSvgIntoDocument(
    page,
    `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#3AAAFF" />
        <g style="opacity:0.3;">
          <path d="M 10 10 L 90 10 L 90 90 L 10 90 Z" fill="#390075" />
          <path d="M 30 30 L 95 30 L 95 95 L 30 95 Z" fill="#390075" />
        </g>
        ${fillerPaths}
      </svg>
    `
  );
  const importedGroup = getImportedGroup(dump);
  const translucentNode = await page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.nodes?.find((node) => {
      return node.opacity === 0.3;
    });
  });

  expect(importedGroup).not.toBeNull();
  expect(translucentNode).toBeTruthy();

  await page.evaluate((nodeId) => {
    if (nodeId) {
      window.__PUNCHPRESS_EDITOR__?.updateNode(nodeId, { opacity: 0.4 });
    }
  }, importedGroup?.id);

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return [...document.querySelectorAll(".canvas-node-layer g")]
          .map((group) => group.getAttribute("opacity"))
          .filter(Boolean);
      });
    })
    .toContain("0.3");

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return document
          .querySelector(".canvas-node-layer svg > g")
          ?.getAttribute("opacity");
      });
    })
    .toBe("0.4");

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return document.querySelectorAll(
          '.canvas-node-layer g[opacity="0.3"] path'
        ).length;
      });
    })
    .toBe(2);
});

test("applies vector container opacity while rendering child paths", async ({
  page,
}) => {
  await gotoEditor(page);

  await page.evaluate(() => {
    const zeroHandle = { x: 0, y: 0 };
    const contour = {
      closed: true,
      segments: [
        {
          handleIn: zeroHandle,
          handleOut: zeroHandle,
          point: { x: 0, y: 0 },
          pointType: "corner",
        },
        {
          handleIn: zeroHandle,
          handleOut: zeroHandle,
          point: { x: 80, y: 0 },
          pointType: "corner",
        },
        {
          handleIn: zeroHandle,
          handleOut: zeroHandle,
          point: { x: 80, y: 80 },
          pointType: "corner",
        },
        {
          handleIn: zeroHandle,
          handleOut: zeroHandle,
          point: { x: 0, y: 80 },
          pointType: "corner",
        },
      ],
    };

    window.__PUNCHPRESS_EDITOR__?.getState().loadNodes([
      {
        id: "opacity-vector",
        name: "Vector",
        opacity: 0.35,
        parentId: "root",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 320, y: 240 },
        type: "vector",
        visible: true,
      },
      {
        closed: true,
        contours: [contour],
        fill: "#390075",
        fillRule: "nonzero",
        id: "opacity-vector-path",
        opacity: 0.5,
        parentId: "opacity-vector",
        segments: contour.segments,
        stroke: null,
        strokeLineCap: "butt",
        strokeLineJoin: "miter",
        strokeMiterLimit: 4,
        strokeWidth: 0,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "path",
        visible: true,
      },
    ]);
  });

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return document
          .querySelector(".canvas-node-layer svg > g")
          ?.getAttribute("opacity");
      });
    })
    .toBe("0.35");

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return document
          .querySelector('.canvas-node-layer path[fill="#390075"]')
          ?.getAttribute("opacity");
      });
    })
    .toBe("0.5");
});

test("applies nested vector opacity inside dense group surfaces", async ({
  page,
}) => {
  await gotoEditor(page);

  await page.evaluate(() => {
    const zeroHandle = { x: 0, y: 0 };
    const createContour = (minX, minY, maxX, maxY) => ({
      closed: true,
      segments: [
        {
          handleIn: zeroHandle,
          handleOut: zeroHandle,
          point: { x: minX, y: minY },
          pointType: "corner",
        },
        {
          handleIn: zeroHandle,
          handleOut: zeroHandle,
          point: { x: maxX, y: minY },
          pointType: "corner",
        },
        {
          handleIn: zeroHandle,
          handleOut: zeroHandle,
          point: { x: maxX, y: maxY },
          pointType: "corner",
        },
        {
          handleIn: zeroHandle,
          handleOut: zeroHandle,
          point: { x: minX, y: maxY },
          pointType: "corner",
        },
      ],
    });
    const createPath = (id, parentId, visible = true) => {
      const contour = createContour(0, 0, 1, 1);

      return {
        closed: true,
        contours: [contour],
        fill: "#111111",
        fillRule: "nonzero",
        id,
        parentId,
        segments: contour.segments,
        stroke: null,
        strokeLineCap: "butt",
        strokeLineJoin: "miter",
        strokeMiterLimit: 4,
        strokeWidth: 0,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "path",
        visible,
      };
    };
    const contour = createContour(0, 0, 80, 80);
    const fillerNodes = Array.from({ length: 301 }, (_, index) =>
      createPath(`hidden-filler-${index}`, "dense-opacity-group", false)
    );

    window.__PUNCHPRESS_EDITOR__?.getState().loadNodes([
      {
        id: "dense-opacity-group",
        name: "Imported SVG",
        parentId: "root",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 320, y: 240 },
        type: "group",
        visible: true,
      },
      {
        id: "nested-opacity-vector",
        name: "Vector",
        opacity: 0.5,
        parentId: "dense-opacity-group",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "vector",
        visible: true,
      },
      {
        ...createPath("nested-opacity-path", "nested-opacity-vector"),
        contours: [contour],
        fill: "#390075",
        opacity: 0.5,
        segments: contour.segments,
      },
      ...fillerNodes,
    ]);
  });

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return {
          canvasNodeCount: document.querySelectorAll(".canvas-node").length,
          opacity: document
            .querySelector('.canvas-node-layer path[fill="#390075"]')
            ?.getAttribute("opacity"),
        };
      });
    })
    .toEqual({
      canvasNodeCount: 1,
      opacity: "0.25",
    });
});

test("renders filled open SVG paths with implicit fill closure", async ({
  page,
}) => {
  await gotoEditor(page);

  const dump = await importSvgIntoDocument(
    page,
    `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
        <path d="M 10 70 C 40 5 80 5 110 70" fill="#C8B6EE" stroke="#390075" stroke-width="4" />
      </svg>
    `
  );
  const importedGroup = getImportedGroup(dump);
  const importedPath = getGroupChildren(dump, importedGroup?.id).find(
    (node) => node.type === "path"
  );

  expect(importedGroup).not.toBeNull();
  expect(importedPath).toBeTruthy();
  expect(importedPath?.fill).toBe("#c8b6ee");

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return [...document.querySelectorAll(".canvas-node-layer path")]
          .map((path) => path.getAttribute("fill"))
          .filter(Boolean);
      });
    })
    .toContain("#c8b6ee");
});

test("renders dense imported svg groups through one canvas vector surface while keeping editable paths", async ({
  page,
}) => {
  await gotoEditor(page);

  const pathCount = 301;
  const densePathMarkup = Array.from({ length: pathCount }, (_, index) => {
    const x = index % 43;
    const y = Math.floor(index / 43);

    return `<path d="M ${x * 4} ${y * 4} L ${x * 4 + 2} ${y * 4} L ${x * 4 + 2} ${y * 4 + 2} L ${x * 4} ${y * 4 + 2} Z" fill="#111111" />`;
  }).join("");
  const dump = await importSvgIntoDocument(
    page,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 32">${densePathMarkup}</svg>`
  );
  const importedGroup = getImportedGroup(dump);
  const importedPaths = getGroupChildren(dump, importedGroup?.id).filter(
    (node) => node.type === "path"
  );

  expect(importedGroup).not.toBeNull();
  expect(importedPaths).toHaveLength(pathCount);
  expect(dump?.nodes).toHaveLength(pathCount + 1);

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return {
          canvasNodeCount: document.querySelectorAll(".canvas-node").length,
          imageCount: document.querySelectorAll(".canvas-node-layer image")
            .length,
          layerRowCount: document.querySelectorAll("[data-layer-row-id]")
            .length,
          renderedPathCount: document.querySelectorAll(
            ".canvas-node-layer path"
          ).length,
        };
      });
    })
    .toEqual({
      canvasNodeCount: 1,
      imageCount: 0,
      layerRowCount: 1,
      renderedPathCount: pathCount,
    });

  await page.getByLabel("Expand container").click();

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return document.querySelectorAll("[data-layer-row-id]").length;
      });
    })
    .toBeGreaterThan(1);

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return document.querySelectorAll("[data-layer-row-id]").length;
      });
    })
    .toBeLessThan(pathCount + 1);
});

test("omits hidden descendants from dense imported svg group surfaces", async ({
  page,
}) => {
  await gotoEditor(page);

  const hiddenFill = "#ff00ff";
  const visibleFill = "#111111";
  const pathCount = 301;
  const densePathMarkup = Array.from({ length: pathCount }, (_, index) => {
    const x = index % 43;
    const y = Math.floor(index / 43);
    const fill = index === 0 ? hiddenFill : visibleFill;

    return `<path d="M ${x * 4} ${y * 4} L ${x * 4 + 2} ${y * 4} L ${x * 4 + 2} ${y * 4 + 2} L ${x * 4} ${y * 4 + 2} Z" fill="${fill}" />`;
  }).join("");
  const dump = await importSvgIntoDocument(
    page,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 32">${densePathMarkup}</svg>`
  );
  const importedGroup = getImportedGroup(dump);
  const importedPaths = getGroupChildren(dump, importedGroup?.id).filter(
    (node) => node.type === "path"
  );
  const hiddenPath = importedPaths.find((node) => node.fill === hiddenFill);

  expect(importedGroup).not.toBeNull();
  expect(hiddenPath).toBeTruthy();

  await page.evaluate((nodeId) => {
    window.__PUNCHPRESS_EDITOR__?.toggleVisibility(nodeId);
  }, hiddenPath?.id);

  await expect
    .poll(() => {
      return page.evaluate(() => {
        const fills = [...document.querySelectorAll(".canvas-node-layer path")]
          .map((path) => path.getAttribute("fill"))
          .filter(Boolean);

        return {
          hasHiddenFill: fills.includes("#ff00ff"),
          renderedPathCount: fills.length,
        };
      });
    })
    .toEqual({
      hasHiddenFill: false,
      renderedPathCount: pathCount - 1,
    });
});

test("rotates dense imported svg group surfaces uniformly across nesting depths", async ({
  page,
}, testInfo) => {
  await gotoEditor(page);

  const dump = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const zeroHandle = { x: 0, y: 0 };
    const createRectContour = (minX, minY, maxX, maxY) => ({
      closed: true,
      segments: [
        {
          handleIn: zeroHandle,
          handleOut: zeroHandle,
          point: { x: minX, y: minY },
          pointType: "corner",
        },
        {
          handleIn: zeroHandle,
          handleOut: zeroHandle,
          point: { x: maxX, y: minY },
          pointType: "corner",
        },
        {
          handleIn: zeroHandle,
          handleOut: zeroHandle,
          point: { x: maxX, y: maxY },
          pointType: "corner",
        },
        {
          handleIn: zeroHandle,
          handleOut: zeroHandle,
          point: { x: minX, y: maxY },
          pointType: "corner",
        },
      ],
    });
    const createPath = (id, parentId, fill, transform, contour) => ({
      closed: true,
      contours: [contour],
      fill,
      fillRule: "nonzero",
      id,
      parentId,
      segments: contour.segments,
      stroke: null,
      strokeLineCap: "butt",
      strokeLineJoin: "miter",
      strokeMiterLimit: 4,
      strokeWidth: 0,
      transform,
      type: "path",
      visible: true,
    });
    const fillerNodes = Array.from({ length: 301 }, (_, index) => {
      const x = 20 + (index % 43) * 3;
      const y = 20 + Math.floor(index / 43) * 3;
      const contour = createRectContour(0, 0, 1, 1);

      return createPath(
        `filler-${index}`,
        "imported-svg",
        "#111111",
        { rotation: 0, scaleX: 1, scaleY: 1, x, y },
        contour
      );
    });
    const backgroundContour = createRectContour(0, 0, 600, 600);
    const nestedContour = createRectContour(-170, -120, 170, 120);
    const nodes = [
      {
        id: "imported-svg",
        name: "Imported SVG",
        parentId: "root",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "group",
        visible: true,
      },
      {
        id: "nested-group",
        name: "Nested group",
        parentId: "imported-svg",
        transform: { rotation: 20, scaleX: 1, scaleY: 1, x: 300, y: 300 },
        type: "group",
        visible: true,
      },
      createPath(
        "background-path",
        "imported-svg",
        "#3AAAFF",
        { rotation: 0, scaleX: 1, scaleY: 1, x: 100, y: 100 },
        backgroundContour
      ),
      createPath(
        "nested-path",
        "nested-group",
        "#F99B28",
        { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        nestedContour
      ),
      ...fillerNodes,
    ];

    editor.insertNodes(nodes);
    editor.setSelectedNodes(["imported-svg"]);

    return editor.getDebugDump();
  });
  const importedGroup = getImportedGroup(dump);

  expect(importedGroup).not.toBeNull();
  await zoomOut(page, 12);

  const readPathMetrics = () => {
    return page.evaluate(() => {
      const getMetrics = (fill) => {
        const paths = [
          ...document.querySelectorAll(".canvas-node-layer path"),
        ].filter((element) => {
          return element.getAttribute("fill")?.toLowerCase() === fill;
        });
        const matrix = paths[0]?.getScreenCTM();
        const rects = paths
          .map((path) => path.getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.height > 0);

        if (!(matrix && rects.length > 0)) {
          return null;
        }

        const left = Math.min(...rects.map((rect) => rect.left));
        const top = Math.min(...rects.map((rect) => rect.top));
        const right = Math.max(...rects.map((rect) => rect.right));
        const bottom = Math.max(...rects.map((rect) => rect.bottom));

        return {
          angle: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
          center: {
            x: left + (right - left) / 2,
            y: top + (bottom - top) / 2,
          },
        };
      };

      return {
        background: getMetrics("#3aaaff"),
        nested: getMetrics("#f99b28"),
      };
    });
  };
  const normalizeDelta = (before, after) => {
    let delta = after - before;

    while (delta > 180) {
      delta -= 360;
    }

    while (delta < -180) {
      delta += 360;
    }

    return delta;
  };

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return document.querySelectorAll(".canvas-node-layer path").length;
      });
    })
    .toBeGreaterThan(100);

  const beforeMetrics = await readPathMetrics();

  expect(beforeMetrics.background).not.toBeNull();
  expect(beforeMetrics.nested).not.toBeNull();
  expect(beforeMetrics.background?.angle).toBeCloseTo(0, 1);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const session = editor.beginRotateSelection({ nodeId: "imported-svg" });

    window.__PUNCHPRESS_E2E_ROTATE_SESSION__ = session;
    editor.updateRotateSelection(session, { deltaRotation: 30 });
  });

  const activeMetrics = await readPathMetrics();
  await testInfo.attach("active-rotation-preview", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  expect(activeMetrics.background).not.toBeNull();
  expect(activeMetrics.nested).not.toBeNull();

  const activeBackgroundDelta = normalizeDelta(
    beforeMetrics.background?.angle,
    activeMetrics.background?.angle
  );
  const activeNestedDelta = normalizeDelta(
    beforeMetrics.nested?.angle,
    activeMetrics.nested?.angle
  );

  expect(Math.abs(activeBackgroundDelta)).toBeGreaterThan(5);
  expect(activeNestedDelta).toBeCloseTo(activeBackgroundDelta, 1);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const session = window.__PUNCHPRESS_E2E_ROTATE_SESSION__;

    editor.commitRotateSelection(session);
    window.__PUNCHPRESS_E2E_ROTATE_SESSION__ = null;
  });

  const afterMetrics = await readPathMetrics();
  await testInfo.attach("post-rotation-release", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  expect(afterMetrics.background).not.toBeNull();
  expect(afterMetrics.nested).not.toBeNull();
  expect(
    Math.abs(
      normalizeDelta(
        beforeMetrics.background?.angle,
        afterMetrics.background?.angle
      )
    )
  ).toBeGreaterThan(5);
  expect(
    normalizeDelta(
      beforeMetrics.background?.angle,
      afterMetrics.background?.angle
    )
  ).toBeCloseTo(activeBackgroundDelta, 0);
  expect(
    normalizeDelta(beforeMetrics.nested?.angle, afterMetrics.nested?.angle)
  ).toBeCloseTo(activeNestedDelta, 0);
});

test("keeps real imported svg background aligned after rotate release", async ({
  page,
}, testInfo) => {
  await gotoEditor(page);
  const dump = await importSvgIntoDocument(page, LARGE_SVG_FIXTURE);
  const importedGroup = getImportedGroup(dump);

  expect(importedGroup).not.toBeNull();

  await page.evaluate((nodeId) => {
    window.__PUNCHPRESS_EDITOR__?.setSelectedNodes([nodeId]);
  }, importedGroup?.id);
  await zoomOut(page, 10);

  const sessionCreated = await page.evaluate((nodeId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const session = editor?.beginRotateSelection({ nodeId });

    if (!(editor && session)) {
      return false;
    }

    editor.updateRotateSelection(session, { deltaRotation: 30 });
    editor.commitRotateSelection(session);
    return true;
  }, importedGroup?.id);

  expect(sessionCreated).toBe(true);

  await testInfo.attach("large-svg-post-rotation-release", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  const selection = await waitForSelectionHandles(page);
  const backgroundCorners = await readRenderedPathCornersByFill(
    page,
    "#3aaaff"
  );
  const shellContain = await page.evaluate((nodeId) => {
    const nodeElement = document.querySelector(
      `.canvas-node[data-node-id="${nodeId}"]`
    );
    const shellElement = nodeElement?.closest("[data-node-shell='true']");

    return shellElement ? getComputedStyle(shellElement).contain : "";
  }, importedGroup?.id);

  expect(backgroundCorners).not.toBeNull();
  expect(shellContain.split(WHITESPACE_RE)).not.toContain("paint");

  const handleCorners = ["nw", "ne", "se", "sw"].map((corner) => {
    const handle = selection.handles[corner];

    return {
      x: handle.x + handle.width / 2,
      y: handle.y + handle.height / 2,
    };
  });

  expect(
    getBestCornerDistance(backgroundCorners || [], handleCorners)
  ).toBeLessThan(14);
});

test("resizes selected imported svg groups from transform handles", async ({
  page,
}) => {
  await gotoEditor(page);

  const pathCount = 301;
  const densePathMarkup = Array.from({ length: pathCount }, (_, index) => {
    const x = index % 43;
    const y = Math.floor(index / 43);

    return `<path d="M ${x * 4} ${y * 4} L ${x * 4 + 2} ${y * 4} L ${x * 4 + 2} ${y * 4 + 2} L ${x * 4} ${y * 4 + 2} Z" fill="#111111" />`;
  }).join("");
  const dump = await importSvgIntoDocument(
    page,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 32">${densePathMarkup}</svg>`
  );
  const importedGroup = getImportedGroup(dump);
  const firstPath = getGroupChildren(dump, importedGroup?.id).find(
    (node) => node.type === "path"
  );

  expect(importedGroup).not.toBeNull();
  expect(firstPath).toBeTruthy();

  const handle = page.locator(
    ".canvas-multi-selection .moveable-control.moveable-se"
  );
  await expect(handle).toBeVisible();

  const handleTargetClass = await handle.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );

    return target?.className?.toString() || "";
  });

  expect(handleTargetClass).toContain("canvas-multi-node-control");

  await resizeSelectionFromCorner(page, {
    corner: "se",
    drag: { x: 80, y: 80 },
  });

  await expect
    .poll(() => {
      return page.evaluate((nodeId) => {
        return window.__PUNCHPRESS_EDITOR__?.getNode(nodeId)?.transform?.scaleX;
      }, firstPath.id);
    })
    .toBeGreaterThan(1);
});

test("keeps rotated imported svg selection box rotated while resizing", async ({
  page,
}, testInfo) => {
  await gotoEditor(page);

  const dump = await importSvgIntoDocument(page, LARGE_SVG_FIXTURE);
  const importedGroup = getImportedGroup(dump);

  expect(importedGroup).not.toBeNull();

  await page.evaluate((nodeId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    editor.setSelectedNodes([nodeId]);
    const session = editor.beginRotateSelection({ nodeId });
    editor.updateRotateSelection(session, { deltaRotation: 30 });
    editor.commitRotateSelection(session);
  }, importedGroup?.id);
  await zoomOut(page, 8);

  const beforeAngle = await getSelectionTopEdgeAngle(page);
  const beforeRenderedAngle = await getRenderedSelectionTopEdgeAngle(page);

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.resizeSelectionFromCorner({
      corner: "se",
      scale: 1.08,
    });
  });

  const committedAngle = await getSelectionTopEdgeAngle(page);
  const committedRenderedAngle = await getRenderedSelectionTopEdgeAngle(page);
  const handle = page.locator(
    ".canvas-multi-selection .moveable-control.moveable-se"
  );

  await expect(handle).toBeVisible();

  const handleBox = await handle.boundingBox();

  expect(handleBox).not.toBeNull();

  const start = {
    x: handleBox.x + handleBox.width / 2,
    y: handleBox.y + handleBox.height / 2,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 70, start.y + 70, { steps: 16 });
  await page.waitForTimeout(100);

  const activeAngle = await getSelectionTopEdgeAngle(page);
  const activeRenderedAngle = await getRenderedSelectionTopEdgeAngle(page);
  await testInfo.attach("rotated-resize-preview", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  await page.mouse.up();

  expect(beforeAngle).toBeCloseTo(30, 1);
  expect(beforeRenderedAngle).toBeCloseTo(beforeAngle, 1);
  expect(committedAngle).toBeCloseTo(beforeAngle, 1);
  expect(committedRenderedAngle).toBeCloseTo(beforeAngle, 1);
  expect(activeAngle).toBeCloseTo(beforeAngle, 1);
  expect(activeRenderedAngle).toBeCloseTo(beforeAngle, 1);
});

test("moves visible imported svg children with the selected group drag preview", async ({
  page,
}) => {
  await gotoEditor(page);

  const dump = await importSvgIntoDocument(page, ARCH_WARP_SVG);
  const importedGroup = getImportedGroup(dump);
  const firstPath = getGroupChildren(dump, importedGroup?.id).find(
    (node) => node.type === "path"
  );
  const importedCenter = getImportedCenter(dump);
  const dragStartPoint = await getClientPointFromCanvasPoint(
    page,
    importedCenter
  );

  expect(importedGroup).not.toBeNull();
  expect(firstPath).toBeTruthy();
  expect(dragStartPoint).not.toBeNull();

  const beforeBounds = await getRenderedNodeBounds(page, firstPath.id);

  expect(beforeBounds).not.toBeNull();

  await page.mouse.move(dragStartPoint.x, dragStartPoint.y);
  await page.mouse.down();
  await page.mouse.move(dragStartPoint.x - 90, dragStartPoint.y + 20, {
    steps: 6,
  });

  await expect
    .poll(async () => {
      const currentBounds = await getRenderedNodeBounds(page, firstPath.id);
      return currentBounds ? currentBounds.x - beforeBounds.x : 0;
    })
    .toBeLessThan(-40);

  await page.mouse.up();
});

test("keeps large resting svg paths out of persistent compositor promotion", async ({
  page,
}) => {
  await gotoEditor(page);

  const dump = await importSvgIntoDocument(
    page,
    `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4000 4000">
        <rect width="4000" height="4000" fill="#3AAAFF" />
        <path d="M 1400 900 C 2100 200 3000 900 2500 1900 C 2200 2500 1500 2500 1200 1900 C 900 1400 1000 1100 1400 900 Z" fill="#F99B28" />
      </svg>
    `
  );
  const importedGroup = getImportedGroup(dump);
  const firstPath = getGroupChildren(dump, importedGroup?.id).find(
    (node) => node.type === "path"
  );

  expect(firstPath).toBeTruthy();

  await expect
    .poll(() => {
      return page.evaluate((nodeId) => {
        const nodeElement = document.querySelector(
          `.canvas-node[data-node-id="${nodeId}"]`
        );
        const shellElement = nodeElement?.closest("[data-node-shell='true']");

        return {
          transform: shellElement?.style.transform || "",
          willChange: shellElement?.style.willChange || "",
        };
      }, firstPath.id);
    })
    .toEqual({
      transform: expect.stringMatching(TRANSLATE_TRANSFORM_RE),
      willChange: "",
    });
});

test("renders large multi-path svg groups through one canvas vector surface", async ({
  page,
}) => {
  await gotoEditor(page);

  const pathCount = 30;
  const pathMarkup = Array.from({ length: pathCount }, (_, index) => {
    const x = 500 + (index % 6) * 420;
    const y = 500 + Math.floor(index / 6) * 420;

    return `<path d="M ${x} ${y} L ${x + 260} ${y} L ${x + 260} ${y + 260} L ${x} ${y + 260} Z" fill="#F99B28" />`;
  }).join("");
  const dump = await importSvgIntoDocument(
    page,
    `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4000 4000">
        <rect width="4000" height="4000" fill="#3AAAFF" />
        ${pathMarkup}
      </svg>
    `
  );
  const importedGroup = getImportedGroup(dump);
  const importedPaths = getGroupChildren(dump, importedGroup?.id).filter(
    (node) => node.type === "path"
  );

  expect(importedGroup).not.toBeNull();
  expect(importedPaths.length).toBeGreaterThan(pathCount);

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return {
          canvasNodeCount: document.querySelectorAll(".canvas-node").length,
          imageCount: document.querySelectorAll(".canvas-node-layer image")
            .length,
          renderedPathCount: document.querySelectorAll(
            ".canvas-node-layer path"
          ).length,
        };
      });
    })
    .toEqual({
      canvasNodeCount: 1,
      imageCount: 0,
      renderedPathCount: importedPaths.length,
    });
});

test("node tool can direct-edit a child path through a compiled svg group surface", async ({
  page,
}) => {
  await gotoEditor(page);

  const dump = await importSvgIntoDocument(
    page,
    `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4000 4000">
        <rect width="4000" height="4000" fill="#3AAAFF" />
        <path d="M 1200 1200 L 2200 1200 L 2200 2200 L 1200 2200 Z" fill="#F99B28" />
        ${Array.from({ length: 28 }, (_, index) => {
          const x = 300 + (index % 7) * 450;
          const y = 2600 + Math.floor(index / 7) * 180;

          return `<path d="M ${x} ${y} L ${x + 120} ${y} L ${x + 120} ${y + 120} L ${x} ${y + 120} Z" fill="#390075" />`;
        }).join("")}
      </svg>
    `
  );
  const importedGroup = getImportedGroup(dump);
  const importedPaths = getGroupChildren(dump, importedGroup?.id).filter(
    (node) => node.type === "path"
  );
  const targetPath = importedPaths.find((node) => {
    const bounds = node.frame?.bounds;

    return (
      bounds &&
      bounds.width > 900 &&
      bounds.width < 1200 &&
      bounds.height > 900 &&
      bounds.height < 1200
    );
  });
  const targetBounds = targetPath?.frame?.bounds;
  const targetClientPoint = targetBounds
    ? await getClientPointFromCanvasPoint(page, {
        x: targetBounds.minX + targetBounds.width / 2,
        y: targetBounds.minY + targetBounds.height / 2,
      })
    : null;

  expect(importedGroup).not.toBeNull();
  expect(targetPath).toBeTruthy();
  expect(targetClientPoint).not.toBeNull();

  await page.getByRole("button", { name: "Node (A)" }).click();
  await page.mouse.click(targetClientPoint.x, targetClientPoint.y);

  await expect
    .poll(() => {
      return page.evaluate(() => {
        const dump = window.__PUNCHPRESS_EDITOR__?.getDebugDump();

        return {
          pathEditingNodeId: dump?.editing?.pathNodeId || null,
          selectedNodeIds: dump?.selection?.ids || [],
        };
      });
    })
    .toEqual({
      pathEditingNodeId: targetPath.id,
      selectedNodeIds: [targetPath.id],
    });
});

test("preserves non-empty SVG group hierarchy", async ({ page }) => {
  await gotoEditor(page);

  const dump = await importSvgIntoDocument(
    page,
    `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
        <g id="body">
          <path d="M 10 10 L 70 10 L 70 60 L 10 60 Z" fill="#f8ae46" />
          <g id="face">
            <circle cx="30" cy="30" r="5" fill="#111111" />
            <circle cx="50" cy="30" r="5" fill="#111111" />
          </g>
        </g>
        <g id="tail">
          <path d="M 75 25 C 105 5 105 70 75 50" fill="none" stroke="#f8ae46" stroke-width="6" />
        </g>
        <g id="empty" />
      </svg>
    `
  );
  const importedGroup = getImportedGroup(dump);
  const topLevelImportedGroups = getGroupChildren(
    dump,
    importedGroup?.id
  ).filter((node) => node.type === "group");
  const bodyChildren = getGroupChildren(dump, topLevelImportedGroups[0]?.id);
  const bodyNestedGroups = bodyChildren.filter((node) => node.type === "group");
  const faceChildren = getGroupChildren(dump, bodyNestedGroups[0]?.id);
  const tailChildren = getGroupChildren(dump, topLevelImportedGroups[1]?.id);

  expect(importedGroup).not.toBeNull();
  expect(dump?.selection?.ids).toEqual([importedGroup?.id]);
  expect(topLevelImportedGroups).toHaveLength(2);
  expect(bodyChildren.filter((node) => node.type === "path")).toHaveLength(1);
  expect(bodyNestedGroups).toHaveLength(1);
  expect(faceChildren.filter((node) => node.type === "path")).toHaveLength(2);
  expect(tailChildren.filter((node) => node.type === "path")).toHaveLength(1);
});

test("imports compound path svg artwork into the current document as one editable multi-contour path", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.addVectorNode({
      x: 120,
      y: 120,
    });
  });
  const dump = await importSvgIntoDocument(
    page,
    `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path
          d="M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 25 75 L 75 75 L 75 25 Z"
          fill="#ff0000"
          fill-opacity="0.5"
          fill-rule="evenodd"
          stroke="#000000"
          stroke-opacity="0.25"
          stroke-width="4"
          stroke-linecap="square"
          stroke-linejoin="bevel"
          stroke-miterlimit="9"
        />
      </svg>
    `
  );
  const importedPath = dump?.nodes?.find((node) => {
    return (
      node.type === "path" &&
      node.parentId !== "root" &&
      node.contours?.length === 2
    );
  });
  const importedGroup = getImportedGroup(dump);

  expect(dump?.nodes).toHaveLength(3);
  expect(dump?.selection?.ids).toEqual([importedGroup?.id]);
  expect(getGroupChildren(dump, importedGroup?.id)).toEqual([importedPath]);
  expect(importedPath).toMatchObject({
    contours: [
      { closed: true, segments: 4 },
      { closed: true, segments: 4 },
    ],
    fill: "rgba(255,0,0,0.5)",
    fillRule: "evenodd",
    parentId: importedGroup?.id,
    stroke: "rgba(0,0,0,0.25)",
    strokeLineCap: "square",
    strokeLineJoin: "bevel",
    strokeMiterLimit: 9,
    strokeWidth: 4,
    type: "path",
  });

  await expect
    .poll(() => {
      return page.evaluate((currentPathId) => {
        const pathNode = document.querySelector(
          `.canvas-node[data-node-id="${currentPathId}"]`
        );
        const renderedPaths =
          pathNode?.parentElement?.querySelectorAll("path") || [];

        return {
          pathCommandCount:
            renderedPaths[0]?.getAttribute("d")?.match(/M/g)?.length || 0,
          pathCount: renderedPaths.length,
          pathFillRule:
            renderedPaths[0]?.getAttribute("fill-rule") ||
            renderedPaths[0]?.getAttribute("fillRule") ||
            null,
        };
      }, importedPath?.id || null);
    })
    .toEqual({
      pathCommandCount: 2,
      pathCount: 1,
      pathFillRule: "evenodd",
    });
});

test("round-trips imported svg path artwork back through svg export without filling open lines", async ({
  page,
}) => {
  await gotoEditor(page);
  const dump = await importSvgIntoDocument(
    page,
    `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40">
        <line
          x1="10"
          y1="20"
          x2="50"
          y2="20"
          stroke="#123456"
          stroke-width="3"
          stroke-linecap="round"
        />
        <rect
          x="110"
          y="5"
          width="40"
          height="30"
          fill="#abcdef"
        />
      </svg>
    `
  );
  const exportedSvg = await exportDocument(page);
  const importedGroup = getImportedGroup(dump);
  const sortedNodes = getGroupChildren(dump, importedGroup?.id)
    .filter((node) => node.type === "path")
    .sort((left, right) => left.transform.x - right.transform.x);

  expect(importedGroup).not.toBeNull();
  expect(dump?.selection?.ids).toEqual([importedGroup?.id]);
  expect(getGroupChildren(dump, importedGroup?.id)).toHaveLength(2);
  expect(sortedNodes).toHaveLength(2);
  expect(sortedNodes[0]?.parentId).toBe(importedGroup?.id);
  expect(sortedNodes[1]?.parentId).toBe(importedGroup?.id);
  expect(sortedNodes[0]).toMatchObject({
    fill: null,
    stroke: "#123456",
    strokeLineCap: "round",
    strokeWidth: 3,
    type: "path",
  });
  expect(sortedNodes[0]?.contours).toHaveLength(1);
  expect(sortedNodes[0]?.contours[0]?.closed).toBe(false);
  expect(sortedNodes[1]).toMatchObject({
    fill: "#abcdef",
    stroke: null,
    type: "path",
  });
  expect(
    Math.round(sortedNodes[1].transform.x - sortedNodes[0].transform.x)
  ).toBe(100);
  expect(exportedSvg).toContain('fill="none"');
  expect(exportedSvg).toContain('stroke="#123456"');
  expect(exportedSvg).toContain('stroke-linecap="round"');
  expect(exportedSvg).toContain('fill="#abcdef"');
});
