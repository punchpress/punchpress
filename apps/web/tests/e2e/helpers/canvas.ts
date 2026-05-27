export const findEmptyCanvasPoint = async (page) => {
  const point = await page.evaluate(() => {
    const minX = 48;
    const maxX = window.innerWidth - 48;
    const minY = 48;
    const maxY = window.innerHeight - 48;

    for (let x = minX; x <= maxX; x += 64) {
      for (let y = minY; y <= maxY; y += 64) {
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
  });

  if (!point) {
    throw new Error("Missing visible blank canvas point");
  }

  return point;
};

export const clickEmptyCanvas = async (page) => {
  const point = await findEmptyCanvasPoint(page);
  await page.mouse.click(point.x, point.y);
};

const getNodeCenter = async (page, nodeId) => {
  const candidateNodeIds = await page.evaluate((requestedNodeId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const visualOwnerNodeId =
      editor?.getPathEditingVisualOwnerNodeId?.(requestedNodeId) ||
      requestedNodeId;

    return [...new Set([requestedNodeId, visualOwnerNodeId].filter(Boolean))];
  }, nodeId);
  const framePoint = await page.evaluate((nodeIds) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const viewer = editor?.viewerRef;
    const host = editor?.hostRef;
    const rect = host?.getBoundingClientRect?.();

    if (!(editor && viewer && rect)) {
      return null;
    }

    const worldPointToScreenPoint = (point) => {
      return {
        x: rect.left + (point.x - viewer.getScrollLeft()) * editor.zoom,
        y: rect.top + (point.y - viewer.getScrollTop()) * editor.zoom,
      };
    };
    const localPointToWorldPoint = (nodeId, point) => {
      const node = editor.getNode?.(nodeId);
      const bbox = editor.getNodeGeometry?.(nodeId)?.bbox;

      if (!(node && bbox)) {
        return null;
      }

      const localCenter = {
        x: (bbox.minX + bbox.maxX) / 2,
        y: (bbox.minY + bbox.maxY) / 2,
      };
      const scaleX = node.transform?.scaleX ?? 1;
      const scaleY = node.transform?.scaleY ?? 1;
      const rotation = ((node.transform?.rotation || 0) * Math.PI) / 180;
      const offset = {
        x: (point.x - localCenter.x) * scaleX,
        y: (point.y - localCenter.y) * scaleY,
      };
      const worldPoint = {
        x:
          (node.transform?.x || 0) +
          localCenter.x +
          offset.x * Math.cos(rotation) -
          offset.y * Math.sin(rotation),
        y:
          (node.transform?.y || 0) +
          localCenter.y +
          offset.x * Math.sin(rotation) +
          offset.y * Math.cos(rotation),
      };

      return {
        x: worldPoint.x,
        y: worldPoint.y,
      };
    };
    const getPaintedFramePoint = (nodeId, bounds) => {
      const center = {
        x: bounds.minX + bounds.width / 2,
        y: bounds.minY + bounds.height / 2,
      };

      if (editor.hitTestNodePoint(nodeId, center)) {
        return center;
      }

      for (let row = 0; row <= 8; row += 1) {
        for (let column = 0; column <= 8; column += 1) {
          const point = {
            x: bounds.minX + (bounds.width * column) / 8,
            y: bounds.minY + (bounds.height * row) / 8,
          };

          if (editor.hitTestNodePoint(nodeId, point)) {
            return point;
          }
        }
      }

      return null;
    };
    const getSelectionFallbackPoint = (nodeId) => {
      const selectionPoint =
        editor.getNodeRenderGeometry?.(nodeId)?.selectionPoints?.[0];

      if (!selectionPoint) {
        return null;
      }

      return localPointToWorldPoint(nodeId, selectionPoint) || selectionPoint;
    };

    for (const candidateNodeId of nodeIds) {
      const bounds = editor.getNodeRenderFrame?.(candidateNodeId)?.bounds;

      if (!bounds) {
        continue;
      }

      const point =
        getPaintedFramePoint(candidateNodeId, bounds) ||
        getSelectionFallbackPoint(candidateNodeId);

      if (point) {
        return worldPointToScreenPoint(point);
      }
    }

    return null;
  }, candidateNodeIds);

  if (framePoint) {
    return framePoint;
  }

  for (const candidateNodeId of candidateNodeIds) {
    const node = page.locator(
      `.canvas-node[data-node-id="${candidateNodeId}"]`
    );

    try {
      await node.waitFor({ state: "visible", timeout: 1000 });
    } catch {
      continue;
    }

    const rect = await node.boundingBox();

    if (!rect) {
      continue;
    }

    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  }

  throw new Error(`Missing visible canvas node ${nodeId}`);
};

export const clickNodeCenter = async (page, nodeId, options) => {
  const point = await getNodeCenter(page, nodeId);
  await page.mouse.click(point.x, point.y, options);
};

export const doubleClickNodeCenter = async (page, nodeId) => {
  const point = await getNodeCenter(page, nodeId);
  await page.mouse.dblclick(point.x, point.y);
};

export const getBoundingUnion = (rects) => {
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));

  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
};
