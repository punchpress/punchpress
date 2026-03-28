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

const getCursorAtPoint = (page, point) => {
  return page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return element ? window.getComputedStyle(element).cursor : null;
  }, point);
};

const getVectorNodeDocument = async (page, nodeId = "vector-node") => {
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

  await page.mouse.move(rect.x + 6, rect.y + 6);
  await page.mouse.down();
  await page.mouse.move(rect.x - 30, rect.y - 18, { steps: 6 });
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

test("selecting a vector anchor exposes point controls and converts it to smooth", async ({
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

  await page.mouse.click(rect.x + 6, rect.y + 6);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathPoint || null)
    .toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });

  await expect(page.getByRole("button", { name: "Corner" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Smooth" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Corner" })).toHaveAttribute(
    "data-active",
    "true"
  );
  await expect(page.getByRole("button", { name: "Smooth" })).toHaveAttribute(
    "data-active",
    "false"
  );

  await page.getByRole("button", { name: "Smooth" }).click();
  await pauseForUi(page);

  await expect(page.getByRole("button", { name: "Corner" })).toHaveAttribute(
    "data-active",
    "false"
  );
  await expect(page.getByRole("button", { name: "Smooth" })).toHaveAttribute(
    "data-active",
    "true"
  );

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

  await page.getByRole("button", { name: "Corner" }).click();
  await pauseForUi(page);

  await expect(page.getByRole("button", { name: "Corner" })).toHaveAttribute(
    "data-active",
    "true"
  );
  await expect(page.getByRole("button", { name: "Smooth" })).toHaveAttribute(
    "data-active",
    "false"
  );

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

test("switching between corner anchors retargets the point toolbar actions", async ({
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

  await page.mouse.click(rect.x + 6, rect.y + 6);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathPoint || null)
    .toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });

  await page.mouse.click(rect.x + rect.width - 6, rect.y + 6);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathPoint || null)
    .toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });

  await expect(page.getByRole("button", { name: "Corner" })).toHaveAttribute(
    "data-active",
    "true"
  );
  await expect(page.getByRole("button", { name: "Smooth" })).toHaveAttribute(
    "data-active",
    "false"
  );

  await page.getByRole("button", { name: "Smooth" }).click();
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
  await expect.poll(() => getCursorAtPoint(page, topSegmentPoint)).toBe(
    "crosshair"
  );

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
            handleOutLength: Math.hypot(segment.handleOut.x, segment.handleOut.y),
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

test("re-entering path edit mode still allows selecting a smooth point", async ({
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

  await expect
    .poll(async () => (await getDebugDump(page))?.editing?.pathPoint || null)
    .toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });

  await page.getByRole("button", { name: "Smooth" }).click();
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
  await page.getByRole("button", { name: "Smooth" }).click();
  await pauseForUi(page);

  const beforeSegment = await getVectorSegmentDocument(page, 1);

  if (!beforeSegment) {
    throw new Error("Missing selected smooth vector segment");
  }

  const handleOutPoint = {
    x: rect.x + beforeSegment.point.x + beforeSegment.handleOut.x,
    y: rect.y + beforeSegment.point.y + beforeSegment.handleOut.y,
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
  await page.getByRole("button", { name: "Smooth" }).click();
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
  await page.getByRole("button", { name: "Smooth" }).click();
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
  await page.getByRole("button", { name: "Smooth" }).click();
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

test("vector path editing uses distinct point and body drag cursors", async ({
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

  const anchorPoint = {
    x: rect.x + 6,
    y: rect.y + 6,
  };
  const bodyPoint = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };

  await page.mouse.move(anchorPoint.x, anchorPoint.y);
  await expect.poll(() => getCursorAtPoint(page, anchorPoint)).toBe("pointer");

  await page.mouse.down();
  await page.mouse.move(anchorPoint.x - 10, anchorPoint.y - 8, { steps: 4 });
  await expect
    .poll(() =>
      getCursorAtPoint(page, {
        x: anchorPoint.x - 10,
        y: anchorPoint.y - 8,
      })
    )
    .toBe("pointer");
  await page.mouse.up();

  await page.mouse.move(bodyPoint.x, bodyPoint.y);
  await expect.poll(() => getCursorAtPoint(page, bodyPoint)).toBe("grab");

  await page.mouse.down();
  await page.mouse.move(bodyPoint.x + 18, bodyPoint.y + 12, { steps: 4 });
  await expect
    .poll(() =>
      getCursorAtPoint(page, {
        x: bodyPoint.x + 18,
        y: bodyPoint.y + 12,
      })
    )
    .toBe("grabbing");
  await page.mouse.up();

  await expect
    .poll(() =>
      getCursorAtPoint(page, {
        x: bodyPoint.x + 18,
        y: bodyPoint.y + 12,
      })
    )
    .toBe("grab");
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
