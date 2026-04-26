import { expect, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocumentFixture,
  waitForNodeReady,
} from "./helpers/editor";

const CURSOR_SVG_VALUE_PATTERN = /url\("data:image\/svg\+xml,([^"]+)"\)/;
const CURSOR_SVG_WIDTH_PATTERN = /width="(\d+)"/;
const CURSOR_SVG_HEIGHT_PATTERN = /height="(\d+)"/;
const CURSOR_ROTATION_PATTERN = /rotate\((-?\d+(?:\.\d+)?) 12 12\)/;

const getNodeCursor = (page, nodeId) => {
  return page.locator(`[data-node-id="${nodeId}"]`).evaluate((element) => {
    return window.getComputedStyle(element).cursor;
  });
};

const getCursorAtPoint = (page, point) => {
  return page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return element ? window.getComputedStyle(element).cursor : null;
  }, point);
};

const getLocatorCursor = (locator) => {
  return locator.evaluate((element) => {
    return window.getComputedStyle(element).cursor;
  });
};

const getCanvasCursorSvg = (page, variableName) => {
  return page.evaluate((currentVariableName) => {
    const host = document.querySelector(".canvas-host");

    if (!(host instanceof HTMLElement)) {
      return null;
    }

    return host.style.getPropertyValue(currentVariableName);
  }, variableName);
};

const getCursorSvgFromValue = (cursor) => {
  if (typeof cursor !== "string") {
    return null;
  }

  const cursorMatch = cursor.match(CURSOR_SVG_VALUE_PATTERN);

  if (!cursorMatch) {
    return null;
  }

  return decodeURIComponent(cursorMatch[1]);
};

const getCursorSvgSize = (svg) => {
  if (typeof svg !== "string") {
    return null;
  }

  const widthMatch = svg.match(CURSOR_SVG_WIDTH_PATTERN);
  const heightMatch = svg.match(CURSOR_SVG_HEIGHT_PATTERN);

  if (!(widthMatch && heightMatch)) {
    return null;
  }

  return {
    height: Number.parseInt(heightMatch[1] || "0", 10),
    width: Number.parseInt(widthMatch[1] || "0", 10),
  };
};

const getCursorRotationDegrees = (svg) => {
  if (typeof svg !== "string") {
    return 0;
  }

  const rotationMatch = svg.match(CURSOR_ROTATION_PATTERN);

  return rotationMatch ? Number.parseFloat(rotationMatch[1] || "0") : 0;
};

const normalizeRotationDegrees = (rotationDegrees) => {
  const normalizedRotation = rotationDegrees % 360;

  return normalizedRotation < 0 ? normalizedRotation + 360 : normalizedRotation;
};

const getRotationDistance = (firstRotationDegrees, secondRotationDegrees) => {
  const delta = Math.abs(
    normalizeRotationDegrees(firstRotationDegrees) -
      normalizeRotationDegrees(secondRotationDegrees)
  );

  return Math.min(delta, 360 - delta);
};

const getSelectedNodeRotation = (page, nodeId) => {
  return page.evaluate((currentNodeId) => {
    const dump = window.__PUNCHPRESS_EDITOR__?.getDebugDump();
    const node = dump?.nodes?.find((entry) => entry.id === currentNodeId);

    return node?.rotation || 0;
  }, nodeId);
};

const isCustomCursor = (cursor) => {
  return typeof cursor === "string" && cursor.includes("data:image/svg+xml");
};

test("uses contrasting fill and stroke colors for custom cursors", async ({
  page,
}) => {
  await gotoEditor(page);

  const addSvg = getCursorSvgFromValue(
    await getCanvasCursorSvg(page, "--canvas-cursor-add")
  );
  const defaultSvg = getCursorSvgFromValue(
    await getCanvasCursorSvg(page, "--canvas-cursor-default")
  );
  const moveSvg = getCursorSvgFromValue(
    await getCanvasCursorSvg(page, "--canvas-cursor-move")
  );
  const rotateSvg = getCursorSvgFromValue(
    await getCanvasCursorSvg(page, "--canvas-cursor-rotate")
  );
  const scaleSvg = getCursorSvgFromValue(
    await getCanvasCursorSvg(page, "--canvas-cursor-scale")
  );
  const textSvg = getCursorSvgFromValue(
    await getCanvasCursorSvg(page, "--canvas-cursor-text")
  );

  expect(addSvg).toContain('fill="#111111"');
  expect(addSvg).toContain('flood-color="#ffffff"');
  expect(addSvg).toContain("<feGaussianBlur");
  expect(defaultSvg).toContain('fill="#111111"');
  expect(defaultSvg).toContain('flood-color="#ffffff"');
  expect(defaultSvg).toContain("<feGaussianBlur");
  expect(defaultSvg).not.toContain('opacity="0.4"');
  expect(getCursorSvgSize(defaultSvg)).toEqual({ width: 21, height: 21 });
  expect(textSvg).toContain('fill="#111111"');
  expect(textSvg).toContain('flood-color="#ffffff"');
  expect(textSvg).toContain("<feGaussianBlur");
  expect(textSvg).toEqual(expect.stringContaining('width="33"'));
  expect(textSvg).toEqual(expect.stringContaining('height="33"'));

  expect(moveSvg).toContain('fill="#111111"');
  expect(moveSvg).toContain('stroke="#ffffff"');
  expect(moveSvg).toContain('stroke="#111111"');
  expect(scaleSvg).toContain('fill="#111111"');
  expect(scaleSvg).toContain('flood-color="#ffffff"');
  expect(scaleSvg).toContain("<feGaussianBlur");
  expect(scaleSvg).not.toContain('stroke="#ffffff"');
  expect(getCursorRotationDegrees(scaleSvg)).toBe(0);
  expect(rotateSvg).toContain('fill="#111111"');
  expect(rotateSvg).toContain('flood-color="#ffffff"');
  expect(rotateSvg).toContain("<feGaussianBlur");
});

test("uses the add cursor on the canvas surface while placement tools are armed", async ({
  page,
}) => {
  await gotoEditor(page);

  const addSvg = getCursorSvgFromValue(
    await getCanvasCursorSvg(page, "--canvas-cursor-add")
  );
  const getSurfaceCursor = () => {
    return page
      .locator(".canvas-surface")
      .evaluate((element) => window.getComputedStyle(element).cursor);
  };

  await page.keyboard.press("r");
  await expect
    .poll(async () => getCursorSvgFromValue(await getSurfaceCursor()))
    .toBe(addSvg);

  await page.keyboard.press("t");
  await expect
    .poll(async () => getCursorSvgFromValue(await getSurfaceCursor()))
    .toBe(addSvg);
});

test("uses the move cursor for both unselected and selected node hover", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "hover-preview.punch");
  const nodeId = "hover-node";
  await waitForNodeReady(page, nodeId);

  const node = page.locator(`[data-node-id="${nodeId}"]`);
  const box = await node.boundingBox();

  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  await node.hover();
  await expect
    .poll(async () => isCustomCursor(await getNodeCursor(page, nodeId)))
    .toBe(true);

  await node.click();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect
    .poll(async () =>
      isCustomCursor(
        await getCursorAtPoint(page, {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        })
      )
    )
    .toBe(true);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect
    .poll(async () =>
      isCustomCursor(
        await getCursorAtPoint(page, {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        })
      )
    )
    .toBe(true);
  await page.mouse.move(box.x + box.width / 2 + 8, box.y + box.height / 2 + 8);
  await expect
    .poll(async () =>
      isCustomCursor(
        await getCursorAtPoint(page, {
          x: box.x + box.width / 2 + 8,
          y: box.y + box.height / 2 + 8,
        })
      )
    )
    .toBe(true);
  await page.mouse.up();
});

test("uses the hand cursor only while canvas panning is active", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "hover-preview.punch");
  const nodeId = "hover-node";
  await waitForNodeReady(page, nodeId);

  const node = page.locator(`[data-node-id="${nodeId}"]`);
  const box = await node.boundingBox();

  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  await page.keyboard.down("Space");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect
    .poll(async () =>
      isCustomCursor(
        await getCursorAtPoint(page, {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        })
      )
    )
    .toBe(true);
  await page.keyboard.up("Space");
});

test("uses resize and rotate cursors on the single-node transform overlay", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-move.punch");
  const nodeId = "move-node";

  await waitForNodeReady(page, nodeId);
  await page.locator(`[data-node-id="${nodeId}"]`).click();

  const nwResizeHandle = page.locator(
    ".canvas-single-selection .moveable-control.moveable-nw"
  );
  const neResizeHandle = page.locator(
    ".canvas-single-selection .moveable-control.moveable-ne"
  );
  const neRotationZone = page.locator(
    '.canvas-single-selection .canvas-single-node-rotation-zone[data-corner="ne"]'
  );
  const seRotationZone = page.locator(
    '.canvas-single-selection .canvas-single-node-rotation-zone[data-corner="se"]'
  );

  await expect(nwResizeHandle).toBeVisible();
  await expect(neResizeHandle).toBeVisible();
  await expect(neRotationZone).toBeVisible();
  await expect(seRotationZone).toBeVisible();

  await expect
    .poll(async () => isCustomCursor(await getLocatorCursor(nwResizeHandle)))
    .toBe(true);
  await expect
    .poll(async () => isCustomCursor(await getLocatorCursor(neRotationZone)))
    .toBe(true);

  const neResizeCursorSvg = getCursorSvgFromValue(
    await getLocatorCursor(neResizeHandle)
  );
  const seRotateCursorSvg = getCursorSvgFromValue(
    await getLocatorCursor(seRotationZone)
  );

  expect(getCursorRotationDegrees(neResizeCursorSvg)).toBe(0);
  expect(getCursorRotationDegrees(seRotateCursorSvg)).toBe(90);

  await page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.rotateSelectionBy({
      deltaRotation: 30,
    });
  });

  await expect
    .poll(async () => {
      return Math.abs(await getSelectedNodeRotation(page, nodeId));
    })
    .toBeGreaterThan(5);
  await expect
    .poll(async () => {
      const cursor = await getLocatorCursor(neRotationZone);
      const svg = getCursorSvgFromValue(cursor);

      return getCursorRotationDegrees(svg);
    })
    .toBe(30);
});

test("keeps the scale cursor easier to hit at selected node corners", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-move.punch");
  const nodeId = "move-node";

  await waitForNodeReady(page, nodeId);
  await page.locator(`[data-node-id="${nodeId}"]`).click();

  const overlay = page.locator(".canvas-single-selection");
  await expect(overlay).toBeVisible();

  const overlayBox = await overlay.boundingBox();
  expect(overlayBox).not.toBeNull();
  if (!overlayBox) {
    return;
  }

  const cornerPoint = {
    x: overlayBox.x + overlayBox.width + 4,
    y: overlayBox.y - 4,
  };

  await page.mouse.move(cornerPoint.x, cornerPoint.y);

  await expect
    .poll(async () => {
      const cursor = await getCursorAtPoint(page, cornerPoint);
      const svg = getCursorSvgFromValue(cursor);

      return getCursorRotationDegrees(svg);
    })
    .toBe(0);
});

test("does not expose the rotate cursor inside the selected node corner", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-move.punch");
  const nodeId = "move-node";

  await waitForNodeReady(page, nodeId);
  await page.locator(`[data-node-id="${nodeId}"]`).click();

  const overlay = page.locator(".canvas-single-selection");
  const neRotationZone = page.locator(
    '.canvas-single-selection .canvas-single-node-rotation-zone[data-corner="ne"]'
  );

  await expect(overlay).toBeVisible();
  await expect(neRotationZone).toBeVisible();

  const overlayBox = await overlay.boundingBox();
  const rotateCursor = await getLocatorCursor(neRotationZone);

  expect(overlayBox).not.toBeNull();
  if (!(overlayBox && rotateCursor)) {
    return;
  }

  const insideCornerPoint = {
    x: overlayBox.x + overlayBox.width - 6,
    y: overlayBox.y + 6,
  };

  await page.mouse.move(insideCornerPoint.x, insideCornerPoint.y);

  await expect
    .poll(async () => {
      return await getCursorAtPoint(page, insideCornerPoint);
    })
    .not.toBe(rotateCursor);
});

test("keeps the rotate cursor locked while rotation is in progress", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "text-node-move.punch");
  const nodeId = "move-node";

  await waitForNodeReady(page, nodeId);
  await page.locator(`[data-node-id="${nodeId}"]`).click();

  const overlay = page.locator(".canvas-single-selection");
  const neRotationZone = page.locator(
    '.canvas-single-selection .canvas-single-node-rotation-zone[data-corner="ne"]'
  );

  await expect(overlay).toBeVisible();
  await expect(neRotationZone).toBeVisible();

  const rotationZoneBox = await neRotationZone.boundingBox();
  const overlayBox = await overlay.boundingBox();

  expect(rotationZoneBox).not.toBeNull();
  expect(overlayBox).not.toBeNull();
  if (!(rotationZoneBox && overlayBox)) {
    return;
  }

  const startPoint = {
    x: rotationZoneBox.x + rotationZoneBox.width / 2,
    y: rotationZoneBox.y + rotationZoneBox.height / 2,
  };
  const farAwayPoint = {
    x: overlayBox.x + overlayBox.width + 180,
    y: overlayBox.y + overlayBox.height + 180,
  };

  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down();
  await page.mouse.move(farAwayPoint.x, farAwayPoint.y);

  await expect
    .poll(async () => {
      const cursor = await getCursorAtPoint(page, farAwayPoint);
      const svg = getCursorSvgFromValue(cursor);

      return {
        cursorRotationDegrees: getCursorRotationDegrees(svg),
        nodeRotationDegrees: await getSelectedNodeRotation(page, nodeId),
      };
    })
    .toMatchObject({
      cursorRotationDegrees: expect.any(Number),
      nodeRotationDegrees: expect.any(Number),
    });

  await expect
    .poll(async () => {
      const cursor = await getCursorAtPoint(page, farAwayPoint);
      const svg = getCursorSvgFromValue(cursor);
      const cursorRotationDegrees = getCursorRotationDegrees(svg);
      const nodeRotationDegrees = await getSelectedNodeRotation(page, nodeId);

      return (
        getRotationDistance(cursorRotationDegrees, nodeRotationDegrees) < 3
      );
    })
    .toBe(true);

  await page.mouse.up();
});
