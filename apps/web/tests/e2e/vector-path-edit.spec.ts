import { expect, test } from "@playwright/test";
import {
  clickNodeCenter,
  doubleClickNodeCenter,
  findEmptyCanvasPoint,
} from "./helpers/canvas";
import { getDebugDump, gotoEditor, pauseForUi } from "./helpers/editor";

const JOIN_ENDPOINTS_BUTTON_NAME = /Join.*endpoints/i;

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

const loadOpenVectorDocument = async (page) => {
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
                closed: false,
                segments: [
                  {
                    handleIn: { x: 0, y: 0 },
                    handleOut: { x: 36, y: 0 },
                    point: { x: 0, y: 0 },
                    pointType: "smooth",
                  },
                  {
                    handleIn: { x: -48, y: 0 },
                    handleOut: { x: 48, y: 0 },
                    point: { x: 120, y: 120 },
                    pointType: "smooth",
                  },
                  {
                    handleIn: { x: -36, y: 0 },
                    handleOut: { x: 0, y: 0 },
                    point: { x: 240, y: 120 },
                    pointType: "smooth",
                  },
                ],
              },
            ],
            fill: "#000000",
            fillRule: "nonzero",
            id: "open-vector-node",
            parentId: "root",
            stroke: "#000000",
            strokeWidth: 8,
            transform: {
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              x: 280,
              y: 180,
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

const loadMultiContourOpenVectorDocument = async (page) => {
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
                closed: false,
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
                    point: { x: 120, y: 0 },
                    pointType: "corner",
                  },
                  {
                    handleIn: { x: 0, y: 0 },
                    handleOut: { x: 0, y: 0 },
                    point: { x: 220, y: 40 },
                    pointType: "corner",
                  },
                ],
              },
              {
                closed: false,
                segments: [
                  {
                    handleIn: { x: 0, y: 0 },
                    handleOut: { x: 0, y: 0 },
                    point: { x: 300, y: 40 },
                    pointType: "corner",
                  },
                  {
                    handleIn: { x: 0, y: 0 },
                    handleOut: { x: 0, y: 0 },
                    point: { x: 420, y: 40 },
                    pointType: "corner",
                  },
                ],
              },
            ],
            fill: null,
            fillRule: "nonzero",
            id: "multi-open-vector-node",
            parentId: "root",
            stroke: "#000000",
            strokeWidth: 8,
            transform: {
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              x: 220,
              y: 180,
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

const loadPolygonShapeDocument = async (page) => {
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return false;
    }

    editor.loadDocument(
      JSON.stringify({
        nodes: [
          {
            cornerRadius: 0,
            fill: "#ffffff",
            height: 160,
            id: "polygon-shape-node",
            parentId: "root",
            points: [
              { x: -130, y: 0 },
              { x: -10, y: -110 },
              { x: 110, y: -90 },
              { x: 110, y: -20 },
              { x: 10, y: 120 },
            ],
            shape: "polygon",
            stroke: "#000000",
            strokeWidth: 12,
            transform: {
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              x: 400,
              y: 280,
            },
            type: "shape",
            visible: true,
            width: 240,
          },
        ],
        version: "1.4",
      })
    );

    return true;
  });
};
const getViewerScroll = (page) => {
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

const getCursorAtPoint = (page, point) => {
  return page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return element ? window.getComputedStyle(element).cursor : null;
  }, point);
};

const getCursorVariableValue = (page, variableName) => {
  return page.evaluate((currentVariableName) => {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(currentVariableName)
      .trim();
  }, variableName);
};

const getActiveCanvasCursorToken = (page) => {
  return page.evaluate(() => {
    const root = document.querySelector(".canvas-host");
    return root instanceof HTMLElement
      ? root.dataset.activeCanvasCursor || null
      : null;
  });
};

const getCursorForCanvasToken = (page, datasetName, token) => {
  return page.evaluate(
    ({ currentDatasetName, currentToken }) => {
      const probe = document.createElement("div");
      probe.dataset[currentDatasetName] = currentToken;
      document.body.appendChild(probe);
      const cursor = getComputedStyle(probe).cursor;
      probe.remove();
      return cursor;
    },
    {
      currentDatasetName: datasetName,
      currentToken: token,
    }
  );
};

const getCanvasSurfaceCursor = (page) => {
  return page
    .locator(".canvas-surface")
    .evaluate((element) => window.getComputedStyle(element).cursor);
};

const getCanvasHostCursor = (page) => {
  return page
    .locator(".canvas-host")
    .evaluate((element) => window.getComputedStyle(element).cursor);
};

const getVectorOverlayInkCountAroundTarget = (page, padding = 20) => {
  return page.evaluate((currentPadding) => {
    const target = document.querySelector(".canvas-vector-path-target");
    const canvas = document.querySelector(".canvas-vector-paper");

    if (
      !(target instanceof HTMLElement && canvas instanceof HTMLCanvasElement)
    ) {
      return null;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    const rect = target.getBoundingClientRect();
    const x = Math.max(Math.floor(rect.left - currentPadding), 0);
    const y = Math.max(Math.floor(rect.top - currentPadding), 0);
    const width = 120;
    const height = 100;
    const { data } = context.getImageData(x, y, width, height);
    let inkCount = 0;

    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 0) {
        inkCount += 1;
      }
    }

    return inkCount;
  }, padding);
};

const isCustomCursor = (cursor) => {
  return typeof cursor === "string" && cursor.includes("data:image/svg+xml");
};

const getVectorNodeDocument = (page, nodeId = "vector-node") => {
  return page.evaluate((currentNodeId) => {
    const dump = window.__PUNCHPRESS_EDITOR__?.getDebugDump();
    const document = dump?.document?.serialized
      ? JSON.parse(dump.document.serialized)
      : null;

    return document?.nodes?.find((entry) => entry.id === currentNodeId) || null;
  }, nodeId);
};

const getVectorSegmentDocument = async (
  page,
  segmentIndex,
  contourIndex = 0,
  nodeId = "vector-node"
) => {
  const vectorNode = await getVectorNodeDocument(page, nodeId);

  return vectorNode?.contours?.[contourIndex]?.segments?.[segmentIndex] || null;
};

const getVectorPointCornerRadius = (
  page,
  segmentIndex,
  contourIndex = 0,
  nodeId = "vector-node"
) => {
  return page.evaluate(
    ({ currentContourIndex, currentNodeId, currentSegmentIndex }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;

      if (!editor) {
        return 0;
      }

      return (
        editor.getPathPointCornerRadius(currentNodeId, {
          contourIndex: currentContourIndex,
          segmentIndex: currentSegmentIndex,
        }) || 0
      );
    },
    {
      currentContourIndex: contourIndex,
      currentNodeId: nodeId,
      currentSegmentIndex: segmentIndex,
    }
  );
};

const getVectorPaperPixel = (page, point) => {
  return page.evaluate(({ x, y }) => {
    const canvas = document.querySelector(".canvas-vector-paper");

    if (!(canvas instanceof HTMLCanvasElement)) {
      return null;
    }

    const context = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();

    if (!context) {
      return null;
    }

    const pixel = context.getImageData(
      Math.round(x - rect.left),
      Math.round(y - rect.top),
      1,
      1
    ).data;

    return {
      a: pixel[3],
      b: pixel[2],
      g: pixel[1],
      r: pixel[0],
    };
  }, point);
};

const getVectorPaperRingAlphaTotal = (
  page,
  point,
  { maxRadius = 18, minRadius = 10 } = {}
) => {
  return page.evaluate(
    ({ maxRadius: currentMaxRadius, minRadius: currentMinRadius, x, y }) => {
      const canvas = document.querySelector(".canvas-vector-paper");

      if (!(canvas instanceof HTMLCanvasElement)) {
        return 0;
      }

      const context = canvas.getContext("2d");
      const rect = canvas.getBoundingClientRect();

      if (!context) {
        return 0;
      }

      let alphaTotal = 0;

      for (
        let offsetY = -currentMaxRadius;
        offsetY <= currentMaxRadius;
        offsetY += 1
      ) {
        for (
          let offsetX = -currentMaxRadius;
          offsetX <= currentMaxRadius;
          offsetX += 1
        ) {
          const distance = Math.hypot(offsetX, offsetY);

          if (distance < currentMinRadius || distance > currentMaxRadius) {
            continue;
          }

          const pixel = context.getImageData(
            Math.round(x - rect.left + offsetX),
            Math.round(y - rect.top + offsetY),
            1,
            1
          ).data;

          alphaTotal += pixel[3];
        }
      }

      return alphaTotal;
    },
    {
      maxRadius,
      minRadius,
      x: point.x,
      y: point.y,
    }
  );
};

const getVectorPathScreenPoint = (page, nodeId, distance = 0) => {
  return page.evaluate(
    ({ currentDistance, currentNodeId }) => {
      const path = document.querySelector(
        `.canvas-node[data-node-id="${currentNodeId}"] path`
      );

      if (!(path instanceof SVGPathElement)) {
        return null;
      }

      const svg = path.ownerSVGElement;
      const ctm = path.getScreenCTM();

      if (!(svg && ctm)) {
        return null;
      }

      const pathPoint = path.getPointAtLength(currentDistance);
      const screenPoint = svg.createSVGPoint();
      screenPoint.x = pathPoint.x;
      screenPoint.y = pathPoint.y;

      const transformedPoint = screenPoint.matrixTransform(ctm);

      return {
        x: transformedPoint.x,
        y: transformedPoint.y,
      };
    },
    {
      currentDistance: distance,
      currentNodeId: nodeId,
    }
  );
};

const getVectorSegmentScreenPoint = (
  page,
  nodeId,
  segmentIndex,
  contourIndex = 0
) => {
  return page.evaluate(
    ({ currentContourIndex, currentNodeId, currentSegmentIndex }) => {
      const dump = window.__PUNCHPRESS_EDITOR__?.getDebugDump();
      const nodeSnapshot = dump?.nodes?.find(
        (entry) => entry.id === currentNodeId
      );
      const serializedDocument = dump?.document?.serialized
        ? JSON.parse(dump.document.serialized)
        : null;
      const vectorNode = serializedDocument?.nodes?.find(
        (entry) => entry.id === currentNodeId
      );
      const localPoint =
        vectorNode?.contours?.[currentContourIndex]?.segments?.[
          currentSegmentIndex
        ]?.point;
      const bbox = nodeSnapshot?.geometry?.bbox;
      const svg = document.querySelector(
        `.canvas-node[data-node-id="${currentNodeId}"] svg`
      );

      if (!(localPoint && bbox && svg instanceof SVGSVGElement)) {
        return null;
      }

      const ctm = svg.getScreenCTM();

      if (!ctm) {
        return null;
      }

      const svgPoint = svg.createSVGPoint();
      svgPoint.x = localPoint.x - bbox.minX;
      svgPoint.y = localPoint.y - bbox.minY;

      const transformedPoint = svgPoint.matrixTransform(ctm);

      return {
        x: transformedPoint.x,
        y: transformedPoint.y,
      };
    },
    {
      currentContourIndex: contourIndex,
      currentNodeId: nodeId,
      currentSegmentIndex: segmentIndex,
    }
  );
};

const getVectorCornerWidgetScreenPoint = (
  page,
  nodeId,
  segmentIndex,
  contourIndex = 0
) => {
  return page.evaluate(
    ({ currentContourIndex, currentNodeId, currentSegmentIndex }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const dump = window.__PUNCHPRESS_EDITOR__?.getDebugDump();
      const nodeSnapshot = dump?.nodes?.find(
        (entry) => entry.id === currentNodeId
      );
      const serializedDocument = dump?.document?.serialized
        ? JSON.parse(dump.document.serialized)
        : null;
      const vectorNode = serializedDocument?.nodes?.find(
        (entry) => entry.id === currentNodeId
      );
      const contour = vectorNode?.contours?.[currentContourIndex];
      const segment = contour?.segments?.[currentSegmentIndex];
      const svg = document.querySelector(
        `.canvas-node[data-node-id="${currentNodeId}"] svg`
      );
      const bbox = nodeSnapshot?.geometry?.bbox;

      if (
        !(
          contour &&
          segment &&
          bbox &&
          svg instanceof SVGSVGElement &&
          segment.pointType === "corner"
        )
      ) {
        return null;
      }

      let previousIndex = -1;

      if (currentSegmentIndex > 0) {
        previousIndex = currentSegmentIndex - 1;
      } else if (contour.closed) {
        previousIndex = contour.segments.length - 1;
      }

      let nextIndex = -1;

      if (currentSegmentIndex < contour.segments.length - 1) {
        nextIndex = currentSegmentIndex + 1;
      } else if (contour.closed) {
        nextIndex = 0;
      }
      const previousSegment = contour.segments[previousIndex];
      const nextSegment = contour.segments[nextIndex];

      if (!(previousSegment && nextSegment)) {
        return null;
      }

      const hasHandle = (handle) => {
        return (
          Math.abs(handle?.x || 0) > 0.01 || Math.abs(handle?.y || 0) > 0.01
        );
      };

      if (
        hasHandle(previousSegment.handleOut) ||
        hasHandle(segment.handleIn) ||
        hasHandle(segment.handleOut) ||
        hasHandle(nextSegment.handleIn)
      ) {
        return null;
      }

      const getDirection = (from, to) => {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.hypot(dx, dy);

        if (length <= 0.0001) {
          return null;
        }

        return {
          x: dx / length,
          y: dy / length,
        };
      };
      const previousDirection = getDirection(
        segment.point,
        previousSegment.point
      );
      const nextDirection = getDirection(segment.point, nextSegment.point);

      if (!(previousDirection && nextDirection)) {
        return null;
      }

      const bisectorLength = Math.hypot(
        previousDirection.x + nextDirection.x,
        previousDirection.y + nextDirection.y
      );

      if (bisectorLength <= 0.0001) {
        return null;
      }

      const bisector = {
        x: (previousDirection.x + nextDirection.x) / bisectorLength,
        y: (previousDirection.y + nextDirection.y) / bisectorLength,
      };
      const cornerAngle = Math.acos(
        Math.min(
          1,
          Math.max(
            -1,
            previousDirection.x * nextDirection.x +
              previousDirection.y * nextDirection.y
          )
        )
      );
      const ctm = svg.getScreenCTM();

      if (!ctm) {
        return null;
      }

      const toScreenPoint = (point) => {
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = point.x - bbox.minX;
        svgPoint.y = point.y - bbox.minY;
        return svgPoint.matrixTransform(ctm);
      };

      const anchor = toScreenPoint(segment.point);
      const bisectorTarget = toScreenPoint({
        x: segment.point.x + bisector.x,
        y: segment.point.y + bisector.y,
      });
      const projectedBisector = {
        x: bisectorTarget.x - anchor.x,
        y: bisectorTarget.y - anchor.y,
      };
      const pixelsPerLocalUnit = Math.hypot(
        projectedBisector.x,
        projectedBisector.y
      );

      if (pixelsPerLocalUnit <= 0.0001) {
        return null;
      }

      const screenDirection = {
        x: projectedBisector.x / pixelsPerLocalUnit,
        y: projectedBisector.y / pixelsPerLocalUnit,
      };
      const distancePerRadius = 1 / Math.sin(cornerAngle / 2);
      const currentRadius =
        editor.getPathPointCornerRadius(currentNodeId, {
          contourIndex: currentContourIndex,
          segmentIndex: currentSegmentIndex,
        }) || 0;
      const distancePx =
        30 + currentRadius * distancePerRadius * pixelsPerLocalUnit;

      return {
        direction: screenDirection,
        x: anchor.x + screenDirection.x * distancePx,
        y: anchor.y + screenDirection.y * distancePx,
      };
    },
    {
      currentContourIndex: contourIndex,
      currentNodeId: nodeId,
      currentSegmentIndex: segmentIndex,
    }
  );
};

const getEditablePathPointScreenPoint = (
  page,
  nodeId,
  segmentIndex,
  contourIndex = 0
) => {
  return page.evaluate(
    ({ currentContourIndex, currentNodeId, currentSegmentIndex }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const dump = editor?.getDebugDump();
      const nodeSnapshot = dump?.nodes?.find(
        (entry) => entry.id === currentNodeId
      );
      const session = editor?.getEditablePathSession?.(currentNodeId);
      const localPoint =
        session?.contours?.[currentContourIndex]?.segments?.[
          currentSegmentIndex
        ]?.point;
      const bbox = nodeSnapshot?.geometry?.bbox;
      const svg = document.querySelector(
        `.canvas-node[data-node-id="${currentNodeId}"] svg`
      );

      if (!(localPoint && bbox && svg instanceof SVGSVGElement)) {
        return null;
      }

      const ctm = svg.getScreenCTM();

      if (!ctm) {
        return null;
      }

      const svgPoint = svg.createSVGPoint();
      svgPoint.x = localPoint.x - bbox.minX;
      svgPoint.y = localPoint.y - bbox.minY;

      const transformedPoint = svgPoint.matrixTransform(ctm);

      return {
        x: transformedPoint.x,
        y: transformedPoint.y,
      };
    },
    {
      currentContourIndex: contourIndex,
      currentNodeId: nodeId,
      currentSegmentIndex: segmentIndex,
    }
  );
};

const getEditablePathCornerWidgetScreenPoint = (
  page,
  nodeId,
  segmentIndex,
  contourIndex = 0
) => {
  return page.evaluate(
    ({ currentContourIndex, currentNodeId, currentSegmentIndex }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const dump = editor?.getDebugDump();
      const nodeSnapshot = dump?.nodes?.find(
        (entry) => entry.id === currentNodeId
      );
      const session = editor?.getEditablePathSession?.(currentNodeId);
      const contour = session?.contours?.[currentContourIndex];
      const segment = contour?.segments?.[currentSegmentIndex];
      const currentRadius = editor?.getPathPointCornerRadius?.(currentNodeId, {
        contourIndex: currentContourIndex,
        segmentIndex: currentSegmentIndex,
      });
      const svg = document.querySelector(
        `.canvas-node[data-node-id="${currentNodeId}"] svg`
      );
      const bbox = nodeSnapshot?.geometry?.bbox;

      if (
        !(
          contour &&
          segment &&
          bbox &&
          svg instanceof SVGSVGElement &&
          segment.pointType === "corner"
        )
      ) {
        return null;
      }

      let previousIndex = -1;

      if (currentSegmentIndex > 0) {
        previousIndex = currentSegmentIndex - 1;
      } else if (contour.closed) {
        previousIndex = contour.segments.length - 1;
      }

      let nextIndex = -1;

      if (currentSegmentIndex < contour.segments.length - 1) {
        nextIndex = currentSegmentIndex + 1;
      } else if (contour.closed) {
        nextIndex = 0;
      }
      const previousSegment = contour.segments[previousIndex];
      const nextSegment = contour.segments[nextIndex];

      if (!(previousSegment && nextSegment)) {
        return null;
      }

      const hasHandle = (handle) => {
        return (
          Math.abs(handle?.x || 0) > 0.01 || Math.abs(handle?.y || 0) > 0.01
        );
      };

      if (
        hasHandle(previousSegment.handleOut) ||
        hasHandle(segment.handleIn) ||
        hasHandle(segment.handleOut) ||
        hasHandle(nextSegment.handleIn)
      ) {
        return null;
      }

      const getDirection = (from, to) => {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.hypot(dx, dy);

        if (length <= 0.0001) {
          return null;
        }

        return {
          x: dx / length,
          y: dy / length,
        };
      };
      const previousDirection = getDirection(
        segment.point,
        previousSegment.point
      );
      const nextDirection = getDirection(segment.point, nextSegment.point);

      if (!(previousDirection && nextDirection)) {
        return null;
      }

      const bisectorLength = Math.hypot(
        previousDirection.x + nextDirection.x,
        previousDirection.y + nextDirection.y
      );

      if (bisectorLength <= 0.0001) {
        return null;
      }

      const bisector = {
        x: (previousDirection.x + nextDirection.x) / bisectorLength,
        y: (previousDirection.y + nextDirection.y) / bisectorLength,
      };
      const cornerAngle = Math.acos(
        Math.min(
          1,
          Math.max(
            -1,
            previousDirection.x * nextDirection.x +
              previousDirection.y * nextDirection.y
          )
        )
      );
      const ctm = svg.getScreenCTM();

      if (!ctm) {
        return null;
      }

      const toScreenPoint = (point) => {
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = point.x - bbox.minX;
        svgPoint.y = point.y - bbox.minY;
        return svgPoint.matrixTransform(ctm);
      };

      const anchor = toScreenPoint(segment.point);
      const bisectorTarget = toScreenPoint({
        x: segment.point.x + bisector.x,
        y: segment.point.y + bisector.y,
      });
      const projectedBisector = {
        x: bisectorTarget.x - anchor.x,
        y: bisectorTarget.y - anchor.y,
      };
      const pixelsPerLocalUnit = Math.hypot(
        projectedBisector.x,
        projectedBisector.y
      );

      if (pixelsPerLocalUnit <= 0.0001) {
        return null;
      }

      const screenDirection = {
        x: projectedBisector.x / pixelsPerLocalUnit,
        y: projectedBisector.y / pixelsPerLocalUnit,
      };
      const distancePerRadius = 1 / Math.sin(cornerAngle / 2);
      const distancePx =
        30 + (currentRadius || 0) * distancePerRadius * pixelsPerLocalUnit;

      return {
        direction: screenDirection,
        x: anchor.x + screenDirection.x * distancePx,
        y: anchor.y + screenDirection.y * distancePx,
      };
    },
    {
      currentContourIndex: contourIndex,
      currentNodeId: nodeId,
      currentSegmentIndex: segmentIndex,
    }
  );
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
  await expect(
    page.locator(".canvas-single-node-transform-overlay")
  ).toHaveCount(0);
});

test("pen tool uses the custom pen cursor on the canvas", async ({ page }) => {
  await gotoEditor(page);

  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      return isCustomCursor(await getCanvasSurfaceCursor(page));
    })
    .toBe(true);
});

test("clicking the action-bar pen button preserves vector path editing", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        activeTool: dump?.tool || null,
        pathNodeId: dump?.editing?.pathNodeId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      activeTool: "pointer",
      pathNodeId: "vector-node",
      selectedNodeIds: ["vector-node"],
    });

  await expect(page.getByTestId("path-corner-radius-handle")).toHaveCount(4);

  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        activeTool: dump?.tool || null,
        pathNodeId: dump?.editing?.pathNodeId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      activeTool: "pen",
      pathNodeId: "vector-node",
      selectedNodeIds: ["vector-node"],
    });

  await expect(page.getByTestId("path-corner-radius-handle")).toHaveCount(0);
});

test("selecting an open endpoint then clicking pen continues that path", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadOpenVectorDocument(page);

  await clickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);

  const endpoint = await getVectorSegmentScreenPoint(
    page,
    "open-vector-node",
    2
  );

  if (!endpoint) {
    throw new Error("Missing open vector endpoint screen point");
  }

  await page.mouse.click(endpoint.x, endpoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathPoint || null)
    .toEqual({
      contourIndex: 0,
      segmentIndex: 2,
    });

  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  const emptyPoint = await findEmptyCanvasPoint(page);
  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await pauseForUi(page);

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getPenPreviewState?.() || null;
      });
    })
    .toMatchObject({
      contourIndex: 0,
      kind: "segment",
      nodeId: "open-vector-node",
      target: null,
    });

  await page.mouse.click(emptyPoint.x, emptyPoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const document = dump?.document?.serialized
        ? JSON.parse(dump.document.serialized)
        : null;
      const vectorNode = document?.nodes?.find(
        (entry) => entry.id === "open-vector-node"
      );

      return {
        nodeCount: document?.nodes?.length || 0,
        pathNodeId: dump?.editing?.pathNodeId || null,
        pathPoint: dump?.editing?.pathPoint || null,
        segmentCount: vectorNode?.contours?.[0]?.segments?.length || 0,
        tool: dump?.tool || null,
      };
    })
    .toEqual({
      nodeCount: 1,
      pathNodeId: "open-vector-node",
      pathPoint: {
        contourIndex: 0,
        segmentIndex: 3,
      },
      segmentCount: 4,
      tool: "pen",
    });
});

test("holding command in pen mode temporarily enables direct anchor dragging", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadOpenVectorDocument(page);

  await clickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  const anchorPoint = await getEditablePathPointScreenPoint(
    page,
    "open-vector-node",
    1
  );

  if (!anchorPoint) {
    throw new Error("Missing editable anchor point for pen command-drag test");
  }

  await page.keyboard.down("Meta");
  await page.mouse.move(anchorPoint.x, anchorPoint.y);
  await page.mouse.down();
  await page.mouse.move(anchorPoint.x + 40, anchorPoint.y + 24, {
    steps: 6,
  });
  await page.mouse.up();
  await page.keyboard.up("Meta");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const document = dump?.document?.serialized
        ? JSON.parse(dump.document.serialized)
        : null;
      const vectorNode = document?.nodes?.find(
        (entry) => entry.id === "open-vector-node"
      );
      const segment = vectorNode?.contours?.[0]?.segments?.[1];

      return {
        pathNodeId: dump?.editing?.pathNodeId || null,
        point: segment?.point || null,
        segmentCount: vectorNode?.contours?.[0]?.segments?.length || 0,
        tool: dump?.tool || null,
      };
    })
    .toEqual({
      pathNodeId: "open-vector-node",
      point: {
        x: 160,
        y: 144,
      },
      segmentCount: 3,
      tool: "pen",
    });
});

test("pen mode still shows the endpoint hover halo for open vector continuation", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadOpenVectorDocument(page);
  const penCursor = await getCursorVariableValue(
    page,
    "--canvas-cursor-pen-tool"
  );

  await clickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  const endpoint = await getVectorSegmentScreenPoint(
    page,
    "open-vector-node",
    2
  );

  if (!endpoint) {
    throw new Error("Missing open vector endpoint screen point");
  }

  const beforeHoverAlpha = await getVectorPaperRingAlphaTotal(page, endpoint);

  await page.mouse.move(endpoint.x, endpoint.y);
  await pauseForUi(page);

  await expect
    .poll(() => {
      return getCursorAtPoint(page, endpoint);
    })
    .toBe(penCursor);

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getPenHoverState?.() || null;
      });
    })
    .toMatchObject({
      contourIndex: 0,
      nodeId: "open-vector-node",
      role: "anchor",
      segmentIndex: 2,
    });

  await expect
    .poll(async () => {
      const ringAlpha = await getVectorPaperRingAlphaTotal(page, endpoint);

      return {
        afterHoverAlpha: ringAlpha,
        beforeHoverAlpha,
      };
    })
    .toMatchObject({
      beforeHoverAlpha,
    });

  await expect
    .poll(() => {
      return getVectorPaperRingAlphaTotal(page, endpoint);
    })
    .toBeGreaterThan(beforeHoverAlpha);
});

test("pen mode uses the minus cursor and deletes interior anchors without affecting endpoints", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadOpenVectorDocument(page);
  const penMinusCursor = await getCursorVariableValue(
    page,
    "--canvas-cursor-pen-tool-minus"
  );

  await clickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  const interiorAnchor = await getVectorSegmentScreenPoint(
    page,
    "open-vector-node",
    1
  );

  if (!interiorAnchor) {
    throw new Error("Missing interior anchor screen point");
  }

  await page.mouse.move(interiorAnchor.x, interiorAnchor.y);
  await pauseForUi(page);

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getPenHoverState?.() || null;
      });
    })
    .toMatchObject({
      contourIndex: 0,
      intent: "delete",
      nodeId: "open-vector-node",
      role: "anchor",
      segmentIndex: 1,
    });

  await expect
    .poll(() => {
      return getCursorAtPoint(page, interiorAnchor);
    })
    .toBe(penMinusCursor);

  await page.mouse.click(interiorAnchor.x, interiorAnchor.y);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const document = dump?.document?.serialized
        ? JSON.parse(dump.document.serialized)
        : null;
      const vectorNode = document?.nodes?.find(
        (entry) => entry.id === "open-vector-node"
      );

      return {
        pathNodeId: dump?.editing?.pathNodeId || null,
        pathPoint: dump?.editing?.pathPoint || null,
        segmentCount: vectorNode?.contours?.[0]?.segments?.length || 0,
      };
    })
    .toEqual({
      pathNodeId: "open-vector-node",
      pathPoint: {
        contourIndex: 0,
        segmentIndex: 1,
      },
      segmentCount: 2,
    });
});

test("option-clicking an anchor with pen toggles it between smooth and corner", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadOpenVectorDocument(page);

  await clickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  const interiorAnchor = await getVectorSegmentScreenPoint(
    page,
    "open-vector-node",
    1
  );

  if (!interiorAnchor) {
    throw new Error("Missing interior anchor point for pen toggle test");
  }

  await page.keyboard.down("Alt");
  await page.mouse.click(interiorAnchor.x, interiorAnchor.y);
  await page.keyboard.up("Alt");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const document = dump?.document?.serialized
        ? JSON.parse(dump.document.serialized)
        : null;
      const vectorNode = document?.nodes?.find(
        (entry) => entry.id === "open-vector-node"
      );
      const segment = vectorNode?.contours?.[0]?.segments?.[1];

      return segment
        ? {
            pathPoint: dump?.editing?.pathPoint || null,
            pointType: segment.pointType || null,
            tool: dump?.tool || null,
          }
        : null;
    })
    .toEqual({
      pathPoint: {
        contourIndex: 0,
        segmentIndex: 1,
      },
      pointType: "corner",
      tool: "pen",
    });

  await page.keyboard.down("Alt");
  await page.mouse.click(interiorAnchor.x, interiorAnchor.y);
  await page.keyboard.up("Alt");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const segment = await getVectorSegmentDocument(
        page,
        1,
        0,
        "open-vector-node"
      );

      return segment
        ? {
            handleInLength: Math.hypot(segment.handleIn.x, segment.handleIn.y),
            handleOutLength: Math.hypot(
              segment.handleOut.x,
              segment.handleOut.y
            ),
            pointType: segment.pointType || null,
          }
        : null;
    })
    .toMatchObject({
      handleInLength: expect.any(Number),
      handleOutLength: expect.any(Number),
      pointType: "smooth",
    });
});

test("pen hover tooltip states the click action for anchors", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadOpenVectorDocument(page);

  await clickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  const interiorAnchor = await getVectorSegmentScreenPoint(
    page,
    "open-vector-node",
    1
  );
  const endpoint = await getVectorSegmentScreenPoint(
    page,
    "open-vector-node",
    2
  );

  if (!(interiorAnchor && endpoint)) {
    throw new Error("Missing vector hover points for pen tooltip test");
  }

  await page.mouse.move(interiorAnchor.x, interiorAnchor.y);
  await pauseForUi(page);
  await expect(page.getByTestId("canvas-pen-hover-tooltip")).toContainText(
    "Delete Point"
  );

  await page.mouse.move(endpoint.x, endpoint.y);
  await pauseForUi(page);
  await expect(page.getByTestId("canvas-pen-hover-tooltip")).toContainText(
    "Continue Path"
  );
});

test("option modifier updates pen hover affordances immediately for an already-hovered anchor", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadOpenVectorDocument(page);
  const penCursor = await getCursorVariableValue(
    page,
    "--canvas-cursor-pen-tool"
  );
  const penMinusCursor = await getCursorVariableValue(
    page,
    "--canvas-cursor-pen-tool-minus"
  );

  await clickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  const interiorAnchor = await getVectorSegmentScreenPoint(
    page,
    "open-vector-node",
    1
  );

  if (!interiorAnchor) {
    throw new Error("Missing interior anchor point for pen convert hover test");
  }

  await page.mouse.move(interiorAnchor.x, interiorAnchor.y);
  await pauseForUi(page);

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getPenHoverState?.() || null;
      });
    })
    .toMatchObject({
      contourIndex: 0,
      intent: "delete",
      nodeId: "open-vector-node",
      role: "anchor",
      segmentIndex: 1,
    });

  await expect(page.getByTestId("canvas-pen-hover-tooltip")).toContainText(
    "Delete Point"
  );
  await expect
    .poll(() => {
      return getCursorAtPoint(page, interiorAnchor);
    })
    .toBe(penMinusCursor);

  await page.keyboard.down("Alt");

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getPenHoverState?.() || null;
      });
    })
    .toMatchObject({
      contourIndex: 0,
      intent: "convert-to-corner",
      nodeId: "open-vector-node",
      role: "anchor",
      segmentIndex: 1,
    });

  await expect(page.getByTestId("canvas-pen-hover-tooltip")).toContainText(
    "Convert to Corner Point"
  );
  await expect
    .poll(() => {
      return getCursorAtPoint(page, interiorAnchor);
    })
    .toBe(penCursor);

  await page.keyboard.up("Alt");

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getPenHoverState?.() || null;
      });
    })
    .toMatchObject({
      contourIndex: 0,
      intent: "delete",
      nodeId: "open-vector-node",
      role: "anchor",
      segmentIndex: 1,
    });

  await expect(page.getByTestId("canvas-pen-hover-tooltip")).toContainText(
    "Delete Point"
  );
  await expect
    .poll(() => {
      return getCursorAtPoint(page, interiorAnchor);
    })
    .toBe(penMinusCursor);
});

test("option-dragging a corner anchor with pen converts it to smooth and authors mirrored handles", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  const anchorPoint = await getVectorSegmentScreenPoint(page, "vector-node", 1);

  if (!anchorPoint) {
    throw new Error("Missing vector anchor point for pen convert drag test");
  }

  await page.keyboard.down("Alt");
  await page.mouse.move(anchorPoint.x, anchorPoint.y);
  await page.mouse.down();
  await page.mouse.move(anchorPoint.x + 42, anchorPoint.y + 18, {
    steps: 4,
  });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const segment = await getVectorSegmentDocument(page, 1);

      if (!segment) {
        return null;
      }

      return {
        handleIn: segment.handleIn,
        handleOut: segment.handleOut,
        point: segment.point,
        pointType: segment.pointType || "corner",
      };
    })
    .toEqual({
      handleIn: { x: -42, y: -18 },
      handleOut: { x: 42, y: 18 },
      point: { x: 200, y: 0 },
      pointType: "smooth",
    });
});

test("snapping endpoints across contours selects both endpoints so join is one click away", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadMultiContourOpenVectorDocument(page);

  await clickNodeCenter(page, "multi-open-vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "multi-open-vector-node");
  await pauseForUi(page);

  const sourceEndpoint = await getVectorSegmentScreenPoint(
    page,
    "multi-open-vector-node",
    2,
    0
  );
  const targetEndpoint = await getVectorSegmentScreenPoint(
    page,
    "multi-open-vector-node",
    0,
    1
  );

  if (!(sourceEndpoint && targetEndpoint)) {
    throw new Error("Missing vector endpoints for snap-join flow test");
  }

  await page.mouse.move(sourceEndpoint.x, sourceEndpoint.y);
  await page.mouse.down();
  await page.mouse.move(targetEndpoint.x, targetEndpoint.y, {
    steps: 10,
  });
  await pauseForUi(page);

  await expect(page.getByTestId("canvas-pen-hover-tooltip")).toContainText(
    "Snap to Point"
  );

  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        pathPoint: dump?.editing?.pathPoint || null,
        pathPoints: dump?.editing?.pathPoints || [],
      };
    })
    .toEqual({
      pathPoint: null,
      pathPoints: [
        {
          contourIndex: 0,
          segmentIndex: 2,
        },
        {
          contourIndex: 1,
          segmentIndex: 0,
        },
      ],
    });

  await expect(
    page.getByRole("button", { name: JOIN_ENDPOINTS_BUTTON_NAME })
  ).toBeVisible();
  await page.getByRole("button", { name: JOIN_ENDPOINTS_BUTTON_NAME }).click();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const document = dump?.document?.serialized
        ? JSON.parse(dump.document.serialized)
        : null;
      const node = document?.nodes?.find(
        (entry) => entry.id === "multi-open-vector-node"
      );

      return {
        contourCount: node?.contours?.length || 0,
        pathPoint: dump?.editing?.pathPoint || null,
        pathPoints: dump?.editing?.pathPoints || [],
        segmentCounts:
          node?.contours?.map((contour) => contour.segments.length) || [],
      };
    })
    .toEqual({
      contourCount: 1,
      pathPoint: {
        contourIndex: 0,
        segmentIndex: 2,
      },
      pathPoints: [
        {
          contourIndex: 0,
          segmentIndex: 2,
        },
      ],
      segmentCounts: [4],
    });
});

test("pen hover shows add-point feedback and inserts at an off-center segment location", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  const firstPoint = await getVectorSegmentScreenPoint(page, "vector-node", 0);
  const secondPoint = await getVectorSegmentScreenPoint(page, "vector-node", 1);

  if (!(firstPoint && secondPoint)) {
    throw new Error("Missing vector segment screen points for add-point hover");
  }

  const quarterPoint = {
    x: firstPoint.x + (secondPoint.x - firstPoint.x) * 0.25,
    y: firstPoint.y + (secondPoint.y - firstPoint.y) * 0.25,
  };

  await page.mouse.move(quarterPoint.x, quarterPoint.y);
  await pauseForUi(page);

  await expect(page.getByTestId("canvas-pen-hover-tooltip")).toContainText(
    "Add Point"
  );
  await expect(
    page.getByTestId("canvas-pen-insert-ghost-anchor")
  ).toBeVisible();

  const ghostAnchor = page.getByTestId("canvas-pen-insert-ghost-anchor");
  const ghostBox = await ghostAnchor.boundingBox();

  if (!ghostBox) {
    throw new Error("Missing visible pen insert ghost anchor");
  }

  expect(
    Math.abs(ghostBox.x + ghostBox.width / 2 - quarterPoint.x)
  ).toBeLessThan(3);
  expect(
    Math.abs(ghostBox.y + ghostBox.height / 2 - quarterPoint.y)
  ).toBeLessThan(3);

  const threeQuarterPoint = {
    x: firstPoint.x + (secondPoint.x - firstPoint.x) * 0.75,
    y: firstPoint.y + (secondPoint.y - firstPoint.y) * 0.75,
  };

  await page.mouse.move(threeQuarterPoint.x, threeQuarterPoint.y);
  await pauseForUi(page);

  const movedGhostBox = await ghostAnchor.boundingBox();

  if (!movedGhostBox) {
    throw new Error("Missing moved pen insert ghost anchor");
  }

  expect(
    Math.abs(movedGhostBox.x + movedGhostBox.width / 2 - threeQuarterPoint.x)
  ).toBeLessThan(3);
  expect(
    Math.abs(movedGhostBox.y + movedGhostBox.height / 2 - threeQuarterPoint.y)
  ).toBeLessThan(3);

  await page.mouse.click(quarterPoint.x, quarterPoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const vectorNode = await getVectorNodeDocument(page, "vector-node");

      return {
        pathPoint: (await getDebugDump(page))?.editing?.pathPoint || null,
        point: vectorNode?.contours?.[0]?.segments?.[1]?.point || null,
        segmentCount: vectorNode?.contours?.[0]?.segments?.length || 0,
      };
    })
    .toEqual({
      pathPoint: {
        contourIndex: 0,
        segmentIndex: 1,
      },
      point: {
        x: 50,
        y: 0,
      },
      segmentCount: 5,
    });
});

test("dragging on a segment with pen inserts a smooth point and authors handles", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  const firstPoint = await getVectorSegmentScreenPoint(page, "vector-node", 0);
  const secondPoint = await getVectorSegmentScreenPoint(page, "vector-node", 1);

  if (!(firstPoint && secondPoint)) {
    throw new Error(
      "Missing vector segment screen points for dragged add-point"
    );
  }

  const quarterPoint = {
    x: firstPoint.x + (secondPoint.x - firstPoint.x) * 0.25,
    y: firstPoint.y,
  };
  const dragEndPoint = {
    x: quarterPoint.x + 40,
    y: quarterPoint.y - 30,
  };

  await page.mouse.move(quarterPoint.x, quarterPoint.y);
  await page.mouse.down();
  await page.mouse.move(dragEndPoint.x, dragEndPoint.y, { steps: 8 });
  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const vectorNode = await getVectorNodeDocument(page, "vector-node");

      return {
        pathPoint: (await getDebugDump(page))?.editing?.pathPoint || null,
        segment: vectorNode?.contours?.[0]?.segments?.[1] || null,
        segmentCount: vectorNode?.contours?.[0]?.segments?.length || 0,
      };
    })
    .toEqual({
      pathPoint: {
        contourIndex: 0,
        segmentIndex: 1,
      },
      segment: {
        handleIn: { x: -40, y: 30 },
        handleOut: { x: 40, y: -30 },
        point: { x: 50, y: 0 },
        pointType: "smooth",
      },
      segmentCount: 5,
    });
});

test("pen mode accepts slightly off-center interior anchor clicks within the hover halo", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadOpenVectorDocument(page);
  const penMinusCursor = await getCursorVariableValue(
    page,
    "--canvas-cursor-pen-tool-minus"
  );

  await clickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  const interiorAnchor = await getVectorSegmentScreenPoint(
    page,
    "open-vector-node",
    1
  );

  if (!interiorAnchor) {
    throw new Error("Missing interior anchor screen point");
  }

  const offsetInteriorAnchor = {
    x: interiorAnchor.x + 16,
    y: interiorAnchor.y,
  };

  await page.mouse.move(offsetInteriorAnchor.x, offsetInteriorAnchor.y);
  await pauseForUi(page);

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getPenHoverState?.() || null;
      });
    })
    .toMatchObject({
      contourIndex: 0,
      intent: "delete",
      nodeId: "open-vector-node",
      role: "anchor",
      segmentIndex: 1,
    });

  await expect
    .poll(() => {
      return getCursorAtPoint(page, offsetInteriorAnchor);
    })
    .toBe(penMinusCursor);

  await expect
    .poll(async () => {
      return (await getVectorPaperPixel(page, offsetInteriorAnchor))?.a || 0;
    })
    .toBeGreaterThan(0);

  await page.mouse.click(offsetInteriorAnchor.x, offsetInteriorAnchor.y);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const document = dump?.document?.serialized
        ? JSON.parse(dump.document.serialized)
        : null;
      const vectorNode = document?.nodes?.find(
        (entry) => entry.id === "open-vector-node"
      );

      return {
        nodeCount: document?.nodes?.length || 0,
        pathNodeId: dump?.editing?.pathNodeId || null,
        pathPoint: dump?.editing?.pathPoint || null,
        segmentCount: vectorNode?.contours?.[0]?.segments?.length || 0,
      };
    })
    .toEqual({
      nodeCount: 1,
      pathNodeId: "open-vector-node",
      pathPoint: {
        contourIndex: 0,
        segmentIndex: 1,
      },
      segmentCount: 2,
    });
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

  await page.mouse.move(rect.x + 6, rect.y + 6);
  await page.mouse.down();
  await page.mouse.move(rect.x - 30, rect.y - 18, { steps: 6 });
  await expect(page.locator(".canvas-selecto .selecto-selection")).toHaveCount(
    0
  );
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
    const vectorNode = document?.nodes?.find(
      (entry) => entry.id === "vector-node"
    );

    return vectorNode?.contours?.[0]?.segments?.[0]?.point || null;
  });

  expect(firstPoint?.x).toBeLessThan(-10);
  expect(firstPoint?.y).toBeLessThan(-10);
});

test("dragging a vector anchor keeps the rendered vector aligned mid-drag", async ({
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

  const startPoint = {
    x: rect.x + 6,
    y: rect.y + 6,
  };
  const dragPoint = {
    x: rect.x - 26,
    y: rect.y + 22,
  };

  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down();
  await page.mouse.move(dragPoint.x, dragPoint.y, { steps: 6 });

  await expect
    .poll(async () => {
      const point = await getVectorPathScreenPoint(page, "vector-node", 0);

      if (!point) {
        return Number.POSITIVE_INFINITY;
      }

      return Math.hypot(point.x - dragPoint.x, point.y - dragPoint.y);
    })
    .toBeLessThan(8);

  await page.mouse.up();
});

test("tiny pointer jitter while selecting a vector anchor does not move it", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const anchorPoint = await getVectorSegmentScreenPoint(page, "vector-node", 0);

  if (!anchorPoint) {
    throw new Error("Missing vector anchor point");
  }

  await page.mouse.move(anchorPoint.x, anchorPoint.y);
  await page.mouse.down();
  await page.mouse.move(anchorPoint.x + 2, anchorPoint.y + 2, {
    steps: 2,
  });
  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      return (await getDebugDump(page))?.editing?.pathPoint || null;
    })
    .toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });

  await expect
    .poll(async () => {
      return (await getVectorSegmentDocument(page, 0))?.point || null;
    })
    .toEqual({
      x: 0,
      y: 0,
    });
});

test("shift-clicking path points selects multiple anchors and dragging one moves them together", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const firstPoint = await getVectorSegmentScreenPoint(page, "vector-node", 0);
  const secondPoint = await getVectorSegmentScreenPoint(page, "vector-node", 1);

  if (!(firstPoint && secondPoint)) {
    throw new Error("Missing vector anchor points for multi-select drag");
  }

  await page.mouse.click(firstPoint.x, firstPoint.y);
  await page.keyboard.down("Shift");
  await page.mouse.click(secondPoint.x, secondPoint.y);
  await page.keyboard.up("Shift");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      return (await getDebugDump(page))?.editing?.pathPoints || [];
    })
    .toEqual([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
    ]);

  await page.mouse.move(secondPoint.x, secondPoint.y);
  await page.mouse.down();
  await page.mouse.move(secondPoint.x + 36, secondPoint.y + 24, {
    steps: 8,
  });
  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const segments = (await getVectorNodeDocument(page))?.contours?.[0]
        ?.segments;

      return segments?.slice(0, 2).map((segment) => segment.point) || [];
    })
    .toEqual([
      { x: 36, y: 24 },
      { x: 236, y: 24 },
    ]);
});

test("dragging a marquee in path edit mode selects multiple path anchors", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const firstPoint = await getVectorSegmentScreenPoint(page, "vector-node", 0);
  const secondPoint = await getVectorSegmentScreenPoint(page, "vector-node", 1);

  if (!(firstPoint && secondPoint)) {
    throw new Error("Missing vector anchor points for marquee selection");
  }

  await page.mouse.move(firstPoint.x - 24, firstPoint.y - 24);
  await page.mouse.down();
  await page.mouse.move(secondPoint.x + 24, secondPoint.y + 24, {
    steps: 8,
  });
  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      return (await getDebugDump(page))?.editing?.pathPoints || [];
    })
    .toEqual([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
    ]);
});

test("dragging the live corner widget updates vector corner radius", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const anchorPoint = await getVectorSegmentScreenPoint(page, "vector-node", 0);

  if (!anchorPoint) {
    throw new Error("Missing vector anchor point");
  }

  await page.mouse.click(anchorPoint.x, anchorPoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      return (await getDebugDump(page))?.editing?.pathPoint || null;
    })
    .toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });

  await expect
    .poll(async () => {
      return Boolean(
        await getVectorCornerWidgetScreenPoint(page, "vector-node", 0)
      );
    })
    .toBe(true);

  const widgetPoint = await getVectorCornerWidgetScreenPoint(
    page,
    "vector-node",
    0
  );

  if (!widgetPoint) {
    throw new Error("Missing vector corner widget");
  }

  await expect(page.getByTestId("path-corner-radius-handle")).toBeVisible();

  await page.mouse.move(widgetPoint.x, widgetPoint.y);
  await page.mouse.down();
  await page.mouse.move(
    widgetPoint.x + widgetPoint.direction.x * 36,
    widgetPoint.y + widgetPoint.direction.y * 36,
    { steps: 8 }
  );
  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(() => getVectorPointCornerRadius(page, 0))
    .toBeGreaterThan(0);
});

test("multi-selected corner points each show a radius handle and dragging one rounds the selected points", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const firstPoint = await getVectorSegmentScreenPoint(page, "vector-node", 0);
  const secondPoint = await getVectorSegmentScreenPoint(page, "vector-node", 1);

  if (!(firstPoint && secondPoint)) {
    throw new Error("Missing vector anchor points for multi-corner handles");
  }

  await page.mouse.click(firstPoint.x, firstPoint.y);
  await page.keyboard.down("Shift");
  await page.mouse.click(secondPoint.x, secondPoint.y);
  await page.keyboard.up("Shift");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      return (await getDebugDump(page))?.editing?.pathPoints || [];
    })
    .toEqual([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
    ]);

  await expect(page.getByTestId("path-corner-radius-handle")).toHaveCount(2);

  const secondWidgetPoint = await getVectorCornerWidgetScreenPoint(
    page,
    "vector-node",
    1
  );

  if (!secondWidgetPoint) {
    throw new Error("Missing second vector corner widget");
  }

  await page.mouse.move(secondWidgetPoint.x, secondWidgetPoint.y);
  await page.mouse.down();
  await page.mouse.move(
    secondWidgetPoint.x + secondWidgetPoint.direction.x * 36,
    secondWidgetPoint.y + secondWidgetPoint.direction.y * 36,
    { steps: 8 }
  );
  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(() => getVectorPointCornerRadius(page, 0))
    .toBeGreaterThan(0);

  await expect
    .poll(() => getVectorPointCornerRadius(page, 1))
    .toBeGreaterThan(0);

  await expect
    .poll(async () => {
      const firstCornerRadius = await getVectorPointCornerRadius(page, 0);
      const secondCornerRadius = await getVectorPointCornerRadius(page, 1);

      return Math.abs(firstCornerRadius - secondCornerRadius) <= 0.01;
    })
    .toBe(true);
});

test("polygon shape points show the live corner widget and update shape corner radius", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadPolygonShapeDocument(page);

  await clickNodeCenter(page, "polygon-shape-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "polygon-shape-node");
  await pauseForUi(page);

  const anchorPoint = await getEditablePathPointScreenPoint(
    page,
    "polygon-shape-node",
    0
  );

  if (!anchorPoint) {
    throw new Error("Missing polygon shape anchor point");
  }

  await page.mouse.click(anchorPoint.x, anchorPoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      return (await getDebugDump(page))?.editing?.pathPoint || null;
    })
    .toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });

  await expect
    .poll(async () => {
      return Boolean(
        await getEditablePathCornerWidgetScreenPoint(
          page,
          "polygon-shape-node",
          0
        )
      );
    })
    .toBe(true);

  const widgetPoint = await getEditablePathCornerWidgetScreenPoint(
    page,
    "polygon-shape-node",
    0
  );

  if (!widgetPoint) {
    throw new Error("Missing polygon shape corner widget");
  }

  await expect(page.getByTestId("path-corner-radius-handle")).toBeVisible();

  await page.mouse.move(widgetPoint.x, widgetPoint.y);
  await page.mouse.down();
  await page.mouse.move(
    widgetPoint.x + widgetPoint.direction.x * 36,
    widgetPoint.y + widgetPoint.direction.y * 36,
    { steps: 8 }
  );
  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const document = dump?.document?.serialized
        ? JSON.parse(dump.document.serialized)
        : null;
      const shapeNode = document?.nodes?.find(
        (entry) => entry.id === "polygon-shape-node"
      );

      return shapeNode?.cornerRadius || 0;
    })
    .toBeGreaterThan(0);
});

test("properties panel shows mixed path corner radius and can apply one value to all vector corners", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });
    editor.setPathPointCornerRadius(12, "vector-node", {
      contourIndex: 0,
      segmentIndex: 0,
    });
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 2,
    });
    editor.setPathPointCornerRadius(30, "vector-node", {
      contourIndex: 0,
      segmentIndex: 2,
    });
    editor.setPathEditingPoint(null);
  });
  await pauseForUi(page);

  const bulkCornerSlider = page.getByRole("slider", {
    name: "Path corner radius",
  });

  await expect(bulkCornerSlider).toHaveAttribute("aria-valuetext", "Mixed");

  await bulkCornerSlider.focus();
  await page.keyboard.press("ArrowRight");
  await pauseForUi(page);

  await expect
    .poll(() => {
      return Promise.all(
        [0, 1, 2, 3].map((segmentIndex) => {
          return getVectorPointCornerRadius(page, segmentIndex);
        })
      );
    })
    .toEqual([1, 1, 1, 1]);
});

test("properties panel scopes path corner radius to the selected path points", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });
    editor.setPathPointCornerRadius(12, "vector-node", {
      contourIndex: 0,
      segmentIndex: 0,
    });
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 2,
    });
    editor.setPathPointCornerRadius(30, "vector-node", {
      contourIndex: 0,
      segmentIndex: 2,
    });
    editor.setPathEditingPoints([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
    ]);
  });
  await pauseForUi(page);

  const bulkCornerSlider = page.getByRole("slider", {
    name: "Path corner radius",
  });

  await expect(bulkCornerSlider).toHaveAttribute("aria-valuetext", "Mixed");

  await bulkCornerSlider.focus();
  await page.keyboard.press("ArrowRight");
  await pauseForUi(page);

  await expect
    .poll(() => {
      return Promise.all(
        [0, 1, 2, 3].map((segmentIndex) => {
          return getVectorPointCornerRadius(page, segmentIndex);
        })
      );
    })
    .toEqual([1, 1, 30, 0]);
});

test("clicking a properties panel control does not exit vector path editing", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const strokeWidthSlider = page.getByRole("slider", {
    name: "Stroke width",
  });

  await expect(strokeWidthSlider).toBeVisible();
  await strokeWidthSlider.click();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      return (await getDebugDump(page))?.editing?.pathNodeId || null;
    })
    .toBe("vector-node");
});

test("dragging one vector anchor does not shift untouched anchors", async ({
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

  const stableBottomRightBefore = await getVectorSegmentScreenPoint(
    page,
    "vector-node",
    2
  );
  const stableBottomLeftBefore = await getVectorSegmentScreenPoint(
    page,
    "vector-node",
    3
  );

  expect(stableBottomRightBefore).not.toBeNull();
  expect(stableBottomLeftBefore).not.toBeNull();
  if (!(stableBottomRightBefore && stableBottomLeftBefore)) {
    return;
  }

  const dragStartPoint = {
    x: rect.x + rect.width - 6,
    y: rect.y + 6,
  };
  const dragPoint = {
    x: dragStartPoint.x - 70,
    y: dragStartPoint.y,
  };

  await page.mouse.move(dragStartPoint.x, dragStartPoint.y);
  await page.mouse.down();
  await page.mouse.move(dragPoint.x, dragPoint.y, { steps: 6 });

  await expect
    .poll(async () => {
      const bottomRight = await getVectorSegmentScreenPoint(
        page,
        "vector-node",
        2
      );
      const bottomLeft = await getVectorSegmentScreenPoint(
        page,
        "vector-node",
        3
      );

      if (!(bottomRight && bottomLeft)) {
        return Number.POSITIVE_INFINITY;
      }

      return Math.max(
        Math.hypot(
          bottomRight.x - stableBottomRightBefore.x,
          bottomRight.y - stableBottomRightBefore.y
        ),
        Math.hypot(
          bottomLeft.x - stableBottomLeftBefore.x,
          bottomLeft.y - stableBottomLeftBefore.y
        )
      );
    })
    .toBeLessThan(3);

  await page.mouse.up();
});

test("dragging an open endpoint onto the opposite endpoint closes the contour", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadOpenVectorDocument(page);

  await clickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);

  const startPoint = await getVectorSegmentScreenPoint(
    page,
    "open-vector-node",
    0
  );
  const endPoint = await getVectorSegmentScreenPoint(
    page,
    "open-vector-node",
    2
  );

  expect(startPoint).not.toBeNull();
  expect(endPoint).not.toBeNull();

  if (!(startPoint && endPoint)) {
    return;
  }

  await page.mouse.move(endPoint.x, endPoint.y);
  await page.mouse.down();
  await page.mouse.move(startPoint.x, startPoint.y, { steps: 12 });
  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const vectorNode = await getVectorNodeDocument(page, "open-vector-node");
      const dump = await getDebugDump(page);

      return {
        closed: vectorNode?.contours?.[0]?.closed ?? false,
        pathPoint: dump?.editing?.pathPoint || null,
        segmentCount: vectorNode?.contours?.[0]?.segments?.length || 0,
      };
    })
    .toEqual({
      closed: true,
      pathPoint: {
        contourIndex: 0,
        segmentIndex: 0,
      },
      segmentCount: 2,
    });
});

test("snapped endpoint close does not drag the rest of the path while the mouse is still down", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadOpenVectorDocument(page);

  await clickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);

  const middlePointBefore = await getVectorSegmentScreenPoint(
    page,
    "open-vector-node",
    1
  );
  const startPoint = await getVectorSegmentScreenPoint(
    page,
    "open-vector-node",
    0
  );
  const endPoint = await getVectorSegmentScreenPoint(
    page,
    "open-vector-node",
    2
  );

  expect(middlePointBefore).not.toBeNull();
  expect(startPoint).not.toBeNull();
  expect(endPoint).not.toBeNull();

  if (!(middlePointBefore && startPoint && endPoint)) {
    return;
  }

  await page.mouse.move(endPoint.x, endPoint.y);
  await page.mouse.down();
  await page.mouse.move(startPoint.x, startPoint.y, { steps: 12 });
  await page.mouse.move(startPoint.x + 6, startPoint.y + 4, { steps: 4 });

  await expect
    .poll(async () => {
      const middlePointDuringHold = await getVectorSegmentScreenPoint(
        page,
        "open-vector-node",
        1
      );

      if (!middlePointDuringHold) {
        return Number.POSITIVE_INFINITY;
      }

      return Math.hypot(
        middlePointDuringHold.x - middlePointBefore.x,
        middlePointDuringHold.y - middlePointBefore.y
      );
    })
    .toBeLessThan(4);

  await page.mouse.up();
});

test("selecting a vector anchor exposes point controls and converts it to smooth", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const anchorPoint = await getVectorSegmentScreenPoint(page, "vector-node", 0);

  if (!anchorPoint) {
    throw new Error("Missing vector anchor point for point controls test");
  }

  await page.mouse.click(anchorPoint.x, anchorPoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathPoint || null)
    .toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });

  await expect(
    page.getByRole("button", { name: "Convert point to corner" })
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Convert point to smooth" })
  ).toHaveCount(1);

  await page.getByRole("button", { name: "Convert point to smooth" }).click();
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
      const segment = vectorNode?.contours?.[0]?.segments?.[0];

      if (!segment) {
        return null;
      }

      return {
        handleInLength: Math.hypot(segment.handleIn.x, segment.handleIn.y),
        handleOutLength: Math.hypot(segment.handleOut.x, segment.handleOut.y),
        pointType: segment.pointType,
      };
    })
    .toMatchObject({
      handleInLength: expect.any(Number),
      handleOutLength: expect.any(Number),
      pointType: "smooth",
    });

  await page.getByRole("button", { name: "Convert point to corner" }).click();
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

      const segment = vectorNode?.contours?.[0]?.segments?.[0];

      if (!segment) {
        return null;
      }

      return {
        handleInLength: Math.hypot(segment.handleIn.x, segment.handleIn.y),
        handleOutLength: Math.hypot(segment.handleOut.x, segment.handleOut.y),
        pointType: segment.pointType || null,
      };
    })
    .toEqual({
      handleInLength: 0,
      handleOutLength: 0,
      pointType: "corner",
    });
});

test("option-dragging a corner anchor converts it to smooth and authors mirrored handles", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const anchorPoint = await getVectorSegmentScreenPoint(page, "vector-node", 1);

  if (!anchorPoint) {
    throw new Error("Missing vector anchor point for convert drag test");
  }

  await page.keyboard.down("Alt");
  await page.mouse.move(anchorPoint.x, anchorPoint.y);
  await page.mouse.down();
  await page.mouse.move(anchorPoint.x + 42, anchorPoint.y + 18, {
    steps: 4,
  });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const segment = await getVectorSegmentDocument(page, 1);

      if (!segment) {
        return null;
      }

      return {
        handleIn: segment.handleIn,
        handleOut: segment.handleOut,
        point: segment.point,
        pointType: segment.pointType || "corner",
      };
    })
    .toEqual({
      handleIn: { x: -42, y: -18 },
      handleOut: { x: 42, y: 18 },
      point: { x: 200, y: 0 },
      pointType: "smooth",
    });
});

test("selecting a vector anchor exposes Delete point and removes the anchor", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const anchorPoint = await getVectorSegmentScreenPoint(page, "vector-node", 1);

  if (!anchorPoint) {
    throw new Error("Missing vector anchor point for delete test");
  }

  await page.mouse.click(anchorPoint.x, anchorPoint.y);
  await pauseForUi(page);

  await expect(page.getByRole("button", { name: "Delete point" })).toHaveCount(
    1
  );

  await page.getByRole("button", { name: "Delete point" }).click();
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

      return {
        nodeCount: document?.nodes?.length || 0,
        pathNodeId: dump?.editing?.pathNodeId || null,
        pathPoint: dump?.editing?.pathPoint || null,
        segmentCount: vectorNode?.contours?.[0]?.segments?.length || 0,
      };
    })
    .toEqual({
      nodeCount: 1,
      pathNodeId: "vector-node",
      pathPoint: {
        contourIndex: 0,
        segmentIndex: 1,
      },
      segmentCount: 3,
    });
});

test("switching between corner anchors retargets the point toolbar actions", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const firstAnchorPoint = await getVectorSegmentScreenPoint(
    page,
    "vector-node",
    0
  );
  const secondAnchorPoint = await getVectorSegmentScreenPoint(
    page,
    "vector-node",
    1
  );

  if (!(firstAnchorPoint && secondAnchorPoint)) {
    throw new Error("Missing vector anchor points for retargeting test");
  }

  await page.mouse.click(firstAnchorPoint.x, firstAnchorPoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathPoint || null)
    .toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });

  await page.mouse.click(secondAnchorPoint.x, secondAnchorPoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathPoint || null)
    .toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });

  await page.getByRole("button", { name: "Convert point to smooth" }).click();
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

      return {
        first: vectorNode?.contours?.[0]?.segments?.[0]?.pointType || null,
        second: vectorNode?.contours?.[0]?.segments?.[1]?.pointType || null,
      };
    })
    .toEqual({
      first: "corner",
      second: "smooth",
    });
});

test("hovering and clicking a vector segment inserts a point", async ({
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

  const topSegmentPoint = {
    x: rect.x + rect.width / 2,
    y: rect.y + 6,
  };

  await page.mouse.move(topSegmentPoint.x, topSegmentPoint.y);
  await expect
    .poll(async () => {
      return isCustomCursor(await getCursorAtPoint(page, topSegmentPoint));
    })
    .toBe(true);

  await page.mouse.click(topSegmentPoint.x, topSegmentPoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathPoint || null)
    .toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });

  await expect
    .poll(async () => {
      const vectorNode = await getVectorNodeDocument(page);
      const segment = vectorNode?.contours?.[0]?.segments?.[1];

      return segment
        ? {
            handleInLength: Math.hypot(segment.handleIn.x, segment.handleIn.y),
            handleOutLength: Math.hypot(
              segment.handleOut.x,
              segment.handleOut.y
            ),
            pointType: segment.pointType || null,
            segmentCount: vectorNode?.contours?.[0]?.segments?.length || 0,
            x: segment.point.x,
            y: segment.point.y,
          }
        : null;
    })
    .toEqual({
      handleInLength: 0,
      handleOutLength: 0,
      pointType: "corner",
      segmentCount: 5,
      x: 100,
      y: 0,
    });
});

test("pen mode hovering and clicking a vector segment inserts a point", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  const node = page.locator('.canvas-node[data-node-id="vector-node"]');
  const rect = await node.boundingBox();

  if (!rect) {
    throw new Error("Missing visible vector node bounds");
  }

  const topSegmentPoint = {
    x: rect.x + rect.width / 2,
    y: rect.y + 6,
  };

  await page.mouse.move(topSegmentPoint.x, topSegmentPoint.y);
  await expect
    .poll(async () => {
      return isCustomCursor(await getCursorAtPoint(page, topSegmentPoint));
    })
    .toBe(true);

  await page.mouse.click(topSegmentPoint.x, topSegmentPoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathPoint || null)
    .toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const vectorNode = await getVectorNodeDocument(page);
      const segment = vectorNode?.contours?.[0]?.segments?.[1];

      return segment
        ? {
            handleInLength: Math.hypot(segment.handleIn.x, segment.handleIn.y),
            handleOutLength: Math.hypot(
              segment.handleOut.x,
              segment.handleOut.y
            ),
            pointType: segment.pointType || null,
            segmentCount: vectorNode?.contours?.[0]?.segments?.length || 0,
            tool: dump?.tool || null,
            x: segment.point.x,
            y: segment.point.y,
          }
        : null;
    })
    .toEqual({
      handleInLength: 0,
      handleOutLength: 0,
      pointType: "corner",
      segmentCount: 5,
      tool: "pen",
      x: 100,
      y: 0,
    });
});

test("clicking away from an edited path with pen starts a clean new path handoff", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadOpenVectorDocument(page);

  await clickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);

  const node = page.locator('.canvas-node[data-node-id="open-vector-node"]');
  const rect = await node.boundingBox();

  if (!rect) {
    throw new Error("Missing visible open vector node bounds");
  }

  await page.mouse.click(
    rect.x + rect.width / 2,
    rect.y + rect.height / 2 + 20
  );
  await pauseForUi(page);
  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  const startPoint = {
    x: rect.x + rect.width + 120,
    y: rect.y + rect.height + 120,
  };
  const hoverPoint = {
    x: startPoint.x + 60,
    y: startPoint.y + 30,
  };

  await page.mouse.click(startPoint.x, startPoint.y);
  await pauseForUi(page);
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const preview = await page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getPenPreviewState?.() || null;
      });

      return {
        pathNodeId: dump?.editing?.pathNodeId || null,
        pathPoint: dump?.editing?.pathPoint || null,
        preview,
        selectedNodeId: dump?.selection?.selectedNodeIds?.[0] || null,
        targetNodeIds: await page.evaluate(() => {
          return Array.from(
            document.querySelectorAll(".canvas-vector-path-target")
          ).map((element) => element.getAttribute("data-node-id"));
        }),
      };
    })
    .toMatchObject({
      pathPoint: {
        contourIndex: 0,
        segmentIndex: 0,
      },
      preview: {
        contourIndex: 0,
        kind: "segment",
        pointer: { x: 60, y: 30 },
        target: null,
      },
    });

  const finalState = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const pathNodeId = editor?.pathEditingNodeId || null;

    return {
      pathNodeId,
      selectedNodeId: editor?.selectedNodeId || null,
      targetNodeIds: Array.from(
        document.querySelectorAll(".canvas-vector-path-target")
      ).map((element) => element.getAttribute("data-node-id")),
      transformTargetCount: document.querySelectorAll(
        ".canvas-vector-path-target"
      ).length,
      vectorPaperCount: document.querySelectorAll(".canvas-vector-paper")
        .length,
    };
  });

  expect(finalState.pathNodeId).not.toBe("open-vector-node");
  expect(finalState.selectedNodeId).toBe(finalState.pathNodeId);
  expect(finalState.targetNodeIds).toEqual([finalState.pathNodeId]);
  expect(finalState.transformTargetCount).toBe(1);
  expect(finalState.vectorPaperCount).toBe(1);
});

test("after escaping a finished pen path, clicking away paints the new path preview", async ({
  page,
}) => {
  await gotoEditor(page);

  await page.keyboard.press("p");
  await page.mouse.click(300, 260);
  await page.mouse.move(360, 300);
  await page.mouse.click(360, 300);
  await page.keyboard.press("Escape");
  await page.mouse.click(520, 360);
  await page.mouse.move(620, 420);

  await expect(
    await page.evaluate(() => {
      return window.__PUNCHPRESS_EDITOR__?.getPenPreviewState?.() || null;
    })
  ).toMatchObject({
    contourIndex: 0,
    kind: "segment",
    pointer: { x: 100, y: 60 },
    target: null,
  });

  expect(await getVectorOverlayInkCountAroundTarget(page)).toBeGreaterThan(0);
});

test("holding space during a pen drag repositions the pending anchor", async ({
  page,
}) => {
  await gotoEditor(page);

  await page.keyboard.press("p");
  await page.mouse.click(300, 260);
  await pauseForUi(page);

  await page.mouse.move(360, 300);
  await page.mouse.down();
  await page.mouse.move(400, 320, { steps: 4 });
  await page.keyboard.down("Space");
  await page.mouse.move(420, 350, { steps: 4 });
  await page.keyboard.up("Space");
  await page.mouse.up();
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const document = dump?.document?.serialized
        ? JSON.parse(dump.document.serialized)
        : null;
      const vectorNode = document?.nodes?.find((entry) => {
        return entry.type === "vector";
      });
      const segment = vectorNode?.contours?.[0]?.segments?.[1];

      return segment
        ? {
            handleIn: segment.handleIn,
            handleOut: segment.handleOut,
            pathPoint: dump?.editing?.pathPoint || null,
            point: segment.point,
            pointType: segment.pointType || null,
            tool: dump?.tool || null,
          }
        : null;
    })
    .toEqual({
      handleIn: { x: -40, y: -20 },
      handleOut: { x: 40, y: 20 },
      pathPoint: {
        contourIndex: 0,
        segmentIndex: 1,
      },
      point: { x: 80, y: 70 },
      pointType: "smooth",
      tool: "pen",
    });
});

test("holding space in pen mode swaps to the pan cursor and hides the pen preview", async ({
  page,
}) => {
  await gotoEditor(page);
  const grabCursor = await getCursorVariableValue(page, "--canvas-cursor-grab");

  await page.keyboard.press("p");
  await page.mouse.click(300, 260);
  await pauseForUi(page);
  await page.mouse.move(380, 320);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getPenPreviewState?.() || null;
      });
    })
    .toMatchObject({
      contourIndex: 0,
      kind: "segment",
      pointer: { x: 80, y: 60 },
      target: null,
    });

  await page.keyboard.down("Space");
  await pauseForUi(page);

  await expect
    .poll(async () => await getCanvasSurfaceCursor(page))
    .toBe(grabCursor);
  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getPenPreviewState?.() || null;
      });
    })
    .toBeNull();
  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getPenHoverState?.() || null;
      });
    })
    .toBeNull();

  await page.keyboard.up("Space");
  await page.mouse.move(390, 330);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getPenPreviewState?.() || null;
      });
    })
    .toMatchObject({
      contourIndex: 0,
      kind: "segment",
      pointer: { x: 90, y: 70 },
      target: null,
    });
});

test("holding space in pen mode hides vector hover halos and suspends hover actions", async ({
  page,
}) => {
  await gotoEditor(page);
  const grabCursor = await getCursorVariableValue(page, "--canvas-cursor-grab");

  await loadOpenVectorDocument(page);
  await clickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "open-vector-node");
  await pauseForUi(page);
  await page.getByRole("button", { name: "Pen (P)" }).click();
  await pauseForUi(page);

  const endpoint = await getVectorSegmentScreenPoint(
    page,
    "open-vector-node",
    2
  );

  if (!endpoint) {
    throw new Error("Missing open vector endpoint screen point");
  }

  const beforeHoverAlpha = await getVectorPaperRingAlphaTotal(page, endpoint);

  await page.mouse.move(endpoint.x, endpoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getPenHoverState?.() || null;
      });
    })
    .toMatchObject({
      contourIndex: 0,
      nodeId: "open-vector-node",
      role: "anchor",
      segmentIndex: 2,
    });
  await expect
    .poll(() => {
      return getVectorPaperRingAlphaTotal(page, endpoint);
    })
    .toBeGreaterThan(beforeHoverAlpha);

  const hoveredAlpha = await getVectorPaperRingAlphaTotal(page, endpoint);

  await page.keyboard.down("Space");
  await pauseForUi(page);

  await expect
    .poll(async () => await getCanvasSurfaceCursor(page))
    .toBe(grabCursor);
  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getPenHoverState?.() || null;
      });
    })
    .toBeNull();
  await expect
    .poll(() => {
      return getVectorPaperRingAlphaTotal(page, endpoint);
    })
    .toBeLessThan(hoveredAlpha);
});

test("closing a pen-authored contour keeps path editing active", async ({
  page,
}) => {
  await gotoEditor(page);

  await page.keyboard.press("p");
  await page.mouse.click(300, 260);
  await page.mouse.move(360, 260);
  await page.mouse.click(360, 260);
  await page.mouse.move(300, 260);
  await page.mouse.click(300, 260);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const pathNodeId = dump?.editing?.pathNodeId || null;

      return {
        activeTool: dump?.tool || null,
        hasPathNodeId: Boolean(pathNodeId),
        pathPoint: dump?.editing?.pathPoint || null,
        selectionIncludesPathNode: pathNodeId
          ? (dump?.selection?.ids || []).includes(pathNodeId)
          : false,
      };
    })
    .toEqual({
      activeTool: "pen",
      hasPathNodeId: true,
      pathPoint: {
        contourIndex: 0,
        segmentIndex: 0,
      },
      selectionIncludesPathNode: true,
    });

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const pathNodeId = dump?.editing?.pathNodeId || null;

      return {
        hasPathNodeId: Boolean(pathNodeId),
        selectionIncludesPathNode: pathNodeId
          ? (dump?.selection?.ids || []).includes(pathNodeId)
          : false,
        vectorPaperCount: await page.locator(".canvas-vector-paper").count(),
      };
    })
    .toEqual({
      hasPathNodeId: true,
      selectionIncludesPathNode: true,
      vectorPaperCount: 1,
    });
});

test("re-entering path edit mode still allows selecting a smooth point", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const topRightPoint = await getVectorSegmentScreenPoint(
    page,
    "vector-node",
    1
  );

  if (!topRightPoint) {
    throw new Error("Missing vector anchor point for re-entry test");
  }

  await page.mouse.click(topRightPoint.x, topRightPoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathPoint || null)
    .toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });

  await page.getByRole("button", { name: "Convert point to smooth" }).click();
  await pauseForUi(page);

  await page.keyboard.press("Escape");
  await pauseForUi(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  await page.mouse.click(topRightPoint.x, topRightPoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathPoint || null)
    .toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
});

test("option-dragging a smooth handle breaks coupling and converts the point to corner", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorDocument(page);

  await clickNodeCenter(page, "vector-node");
  await pauseForUi(page);
  await doubleClickNodeCenter(page, "vector-node");
  await pauseForUi(page);

  const topRightPoint = await getVectorSegmentScreenPoint(
    page,
    "vector-node",
    1
  );

  if (!topRightPoint) {
    throw new Error("Missing vector anchor point for smooth handle test");
  }

  await page.mouse.click(topRightPoint.x, topRightPoint.y);
  await pauseForUi(page);
  await page.getByRole("button", { name: "Convert point to smooth" }).click();
  await pauseForUi(page);

  const beforeSegment = await getVectorSegmentDocument(page, 1);

  if (!beforeSegment) {
    throw new Error("Missing selected smooth vector segment");
  }

  const handleOutPoint = {
    x: topRightPoint.x + beforeSegment.handleOut.x,
    y: topRightPoint.y + beforeSegment.handleOut.y,
  };

  await page.keyboard.down("Alt");
  await page.mouse.move(handleOutPoint.x, handleOutPoint.y);
  await page.mouse.down();
  await page.mouse.move(handleOutPoint.x + 42, handleOutPoint.y + 18, {
    steps: 4,
  });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const segment = await getVectorSegmentDocument(page, 1);

      if (!segment) {
        return null;
      }

      return {
        handleIn: segment.handleIn,
        handleOut: segment.handleOut,
        pointType: segment.pointType || "corner",
      };
    })
    .toEqual({
      handleIn: beforeSegment.handleIn,
      handleOut: expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
      }),
      pointType: "corner",
    });
});

test("shift-dragging a handle constrains its angle", async ({ page }) => {
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

  const topRightPoint = {
    x: rect.x + rect.width - 6,
    y: rect.y + 6,
  };

  await page.mouse.click(topRightPoint.x, topRightPoint.y);
  await pauseForUi(page);
  await page.getByRole("button", { name: "Convert point to smooth" }).click();
  await pauseForUi(page);

  const segment = await getVectorSegmentDocument(page, 1);

  if (!segment) {
    throw new Error("Missing selected smooth vector segment");
  }

  const handleOutPoint = {
    x: rect.x + segment.point.x + segment.handleOut.x,
    y: rect.y + segment.point.y + segment.handleOut.y,
  };

  await page.keyboard.down("Shift");
  await page.mouse.move(handleOutPoint.x, handleOutPoint.y);
  await page.mouse.down();
  await page.mouse.move(handleOutPoint.x + 54, handleOutPoint.y - 26, {
    steps: 4,
  });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const nextSegment = await getVectorSegmentDocument(page, 1);

      return nextSegment
        ? {
            handleIn: nextSegment.handleIn,
            handleOut: nextSegment.handleOut,
          }
        : null;
    })
    .toMatchObject({
      handleIn: {
        x: expect.any(Number),
        y: expect.closeTo(0, 1),
      },
      handleOut: {
        x: expect.any(Number),
        y: expect.closeTo(0, 1),
      },
    });
});

test("hovering a vector handle expands the hover halo beyond the idle handle", async ({
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

  const topRightPoint = {
    x: rect.x + rect.width - 6,
    y: rect.y + 6,
  };

  await page.mouse.click(topRightPoint.x, topRightPoint.y);
  await pauseForUi(page);
  await page.getByRole("button", { name: "Convert point to smooth" }).click();
  await pauseForUi(page);

  const segment = await getVectorSegmentDocument(page, 1);

  if (!segment) {
    throw new Error("Missing selected smooth vector segment");
  }

  const handleOutPoint = {
    x: rect.x + segment.point.x + segment.handleOut.x,
    y: rect.y + segment.point.y + segment.handleOut.y,
  };
  const haloProbePoint = {
    x: handleOutPoint.x + 14,
    y: handleOutPoint.y,
  };

  await expect
    .poll(async () => (await getVectorPaperPixel(page, haloProbePoint))?.a || 0)
    .toBe(0);

  await page.mouse.move(handleOutPoint.x, handleOutPoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getVectorPaperPixel(page, haloProbePoint))?.a || 0)
    .toBeGreaterThan(0);
});

test("deselecting a smooth point hides its visible handles", async ({
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

  const topRightPoint = {
    x: rect.x + rect.width - 6,
    y: rect.y + 6,
  };

  await page.mouse.click(topRightPoint.x, topRightPoint.y);
  await pauseForUi(page);
  await page.getByRole("button", { name: "Convert point to smooth" }).click();
  await pauseForUi(page);

  const vectorNode = await getVectorNodeDocument(page);
  const segment = vectorNode?.contours?.[0]?.segments?.[1];

  if (!segment) {
    throw new Error("Missing smoothed vector segment");
  }

  const handleOutPoint = {
    x: rect.x + segment.point.x + segment.handleOut.x,
    y: rect.y + segment.point.y + segment.handleOut.y,
  };

  await expect
    .poll(async () => (await getVectorPaperPixel(page, handleOutPoint))?.a || 0)
    .toBeGreaterThan(0);

  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathPoint || null)
    .toBeNull();

  await expect
    .poll(async () => (await getVectorPaperPixel(page, handleOutPoint))?.a || 0)
    .toBe(0);
});

test("selecting another anchor hides the previous smooth point handles", async ({
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

  const topLeftPoint = {
    x: rect.x + 6,
    y: rect.y + 6,
  };
  const topRightPoint = {
    x: rect.x + rect.width - 6,
    y: rect.y + 6,
  };

  await page.mouse.click(topRightPoint.x, topRightPoint.y);
  await pauseForUi(page);
  await page.getByRole("button", { name: "Convert point to smooth" }).click();
  await pauseForUi(page);

  const vectorNode = await getVectorNodeDocument(page);
  const segment = vectorNode?.contours?.[0]?.segments?.[1];

  if (!segment) {
    throw new Error("Missing smoothed vector segment");
  }

  const handleOutPoint = {
    x: rect.x + segment.point.x + segment.handleOut.x,
    y: rect.y + segment.point.y + segment.handleOut.y,
  };

  await expect
    .poll(async () => (await getVectorPaperPixel(page, handleOutPoint))?.a || 0)
    .toBeGreaterThan(0);

  await page.mouse.click(topLeftPoint.x, topLeftPoint.y);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathPoint || null)
    .toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });

  await expect
    .poll(async () => (await getVectorPaperPixel(page, handleOutPoint))?.a || 0)
    .toBe(0);
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
    const vectorNode = document?.nodes?.find(
      (entry) => entry.id === "vector-node"
    );

    return vectorNode?.transform || null;
  });

  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width / 2 + 64,
    rect.y + rect.height / 2 + 40,
    {
      steps: 8,
    }
  );
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
    const vectorNode = document?.nodes?.find(
      (entry) => entry.id === "vector-node"
    );

    return vectorNode?.transform || null;
  });

  expect(endTransform?.x).toBeGreaterThan(startTransform?.x || 0);
  expect(endTransform?.y).toBeGreaterThan(startTransform?.y || 0);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathNodeId || null)
    .toBe("vector-node");
});

test("vector path editing uses the general-purpose cursor for both points and body drag", async ({
  page,
}) => {
  await gotoEditor(page);
  const defaultCursor = await getCursorVariableValue(
    page,
    "--canvas-cursor-default"
  );

  await expect(
    await getCursorForCanvasToken(page, "canvasCursor", "vector-path-point")
  ).toBe(defaultCursor);
  await expect(
    await getCursorForCanvasToken(
      page,
      "activeCanvasCursor",
      "vector-path-point-active"
    )
  ).toBe(defaultCursor);

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

  const anchorPoint = {
    x: rect.x + 6,
    y: rect.y + 6,
  };
  const bodyPoint = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };

  await page.mouse.move(anchorPoint.x, anchorPoint.y);
  await page.mouse.down();
  await page.mouse.move(anchorPoint.x - 10, anchorPoint.y - 8, { steps: 4 });
  await expect
    .poll(async () => await getActiveCanvasCursorToken(page))
    .toBe("vector-path-point-active");
  await expect
    .poll(async () => await getCanvasHostCursor(page))
    .toBe(defaultCursor);
  await page.mouse.up();

  await page.mouse.move(bodyPoint.x, bodyPoint.y);
  await expect
    .poll(async () => await getCursorAtPoint(page, bodyPoint))
    .toBe(defaultCursor);

  await page.mouse.down();
  await page.mouse.move(bodyPoint.x + 18, bodyPoint.y + 12, { steps: 4 });
  await expect
    .poll(async () => await getCanvasHostCursor(page))
    .toBe(defaultCursor);
  await page.mouse.up();

  await expect
    .poll(async () =>
      getCursorAtPoint(page, {
        x: bodyPoint.x + 18,
        y: bodyPoint.y + 12,
      })
    )
    .toBe(defaultCursor);
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
  await page.mouse.move(
    rect.x + rect.width / 2 + 120,
    rect.y + rect.height / 2 + 72,
    {
      steps: 10,
    }
  );
  await page.mouse.up();
  await page.keyboard.up("Space");
  await pauseForUi(page);

  await expect
    .poll(async () => await getViewerScroll(page))
    .not.toEqual(initialScroll);
});

test("wheel panning still works during vector path editing", async ({
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

  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.wheel(96, 64);
  await pauseForUi(page);

  await expect
    .poll(async () => await getViewerScroll(page))
    .not.toEqual(initialScroll);
});
