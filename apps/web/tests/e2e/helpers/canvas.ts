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
              ".canvas-node-toolbar",
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
  const node = page.locator(`.canvas-node[data-node-id="${nodeId}"]`);

  await node.waitFor({ state: "visible" });

  const rect = await node.boundingBox();

  if (!rect) {
    throw new Error(`Missing visible canvas node ${nodeId}`);
  }

  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
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
