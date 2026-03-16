export const clickEmptyCanvas = async (page) => {
  const canvas = page.getByTestId("canvas-stage");
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error("Missing canvas bounds");
  }

  await page.mouse.click(box.x + box.width - 80, box.y + 80);
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
