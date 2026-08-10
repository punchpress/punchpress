import { expect, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocument,
  resetViewport,
  serializeDocument,
  setViewport,
} from "./helpers/editor";

const ARTBOARD_DOCUMENT = JSON.stringify({
  nodes: [
    {
      background: "#ffffff",
      height: 540,
      id: "artboard-1",
      locked: false,
      name: "Artboard 1",
      parentId: "root",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 420,
        y: 260,
      },
      type: "artboard",
      visible: true,
      width: 450,
    },
  ],
  version: "1.8",
});

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

const getViewportZoom = (page) => {
  return page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.viewport.zoom || null;
  });
};

const waitForViewportSettle = (page) => {
  return expect
    .poll(() =>
      page.evaluate(() => {
        return Boolean(window.__PUNCHPRESS_EDITOR__?.viewportInteracting);
      })
    )
    .toBe(false);
};

const dispatchWheelAtPoint = (page, point, eventInit) => {
  return page.evaluate(
    ({ init, targetPoint }) => {
      const target = document.elementFromPoint(targetPoint.x, targetPoint.y);

      target?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: targetPoint.x,
          clientY: targetPoint.y,
          deltaMode: WheelEvent.DOM_DELTA_PIXEL,
          ...init,
        })
      );

      return target
        ? {
            className: target instanceof HTMLElement ? target.className : null,
            tagName: target instanceof Element ? target.tagName : null,
          }
        : null;
    },
    {
      init: eventInit,
      targetPoint: point,
    }
  );
};

const mouseWheelAndMeasureScrollDelta = async (page, point, wheelDelta) => {
  const initialScroll = await getViewerScroll(page);

  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(wheelDelta.deltaX, wheelDelta.deltaY);

  await expect
    .poll(async () => {
      const nextScroll = await getViewerScroll(page);

      return Math.hypot(
        (nextScroll?.x || 0) - (initialScroll?.x || 0),
        (nextScroll?.y || 0) - (initialScroll?.y || 0)
      );
    })
    .toBeGreaterThan(1);

  const nextScroll = await getViewerScroll(page);

  return {
    x: (nextScroll?.x || 0) - (initialScroll?.x || 0),
    y: (nextScroll?.y || 0) - (initialScroll?.y || 0),
  };
};

test("wheel pan works over a selected artboard after trackpad zoom", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await resetViewport(page);
  await setViewport(page, { x: 260, y: 180, zoom: 1 });
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("artboard-1");
  });

  const overlay = page.locator(".canvas-single-selection");
  await expect(overlay).toBeVisible();

  const overlayBox = await overlay.boundingBox();

  if (!overlayBox) {
    throw new Error("Missing artboard selection overlay");
  }

  const wheelPoint = {
    x: overlayBox.x + overlayBox.width / 2,
    y: overlayBox.y + overlayBox.height / 2,
  };

  const zoomTarget = await dispatchWheelAtPoint(page, wheelPoint, {
    ctrlKey: true,
    deltaY: 180,
  });

  expect(zoomTarget?.className).toContain("canvas-single-selection");

  await expect.poll(() => getViewportZoom(page)).toBeLessThan(1);
  await waitForViewportSettle(page);

  const initialScroll = await getViewerScroll(page);

  await dispatchWheelAtPoint(page, wheelPoint, {
    deltaX: 96,
    deltaY: 64,
  });

  await expect.poll(() => getViewerScroll(page)).not.toEqual(initialScroll);
});

test("wheel pan over selected artboard chrome respects viewport zoom", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await resetViewport(page);
  await setViewport(page, { x: 260, y: 180, zoom: 1 });
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("artboard-1");
  });

  const overlay = page.locator(".canvas-single-selection");
  await expect(overlay).toBeVisible();

  const overlayBox = await overlay.boundingBox();

  if (!overlayBox) {
    throw new Error("Missing artboard selection overlay");
  }

  const wheelPoint = {
    x: overlayBox.x + overlayBox.width / 2,
    y: overlayBox.y + overlayBox.height / 2,
  };
  const wheelDelta = {
    deltaX: 96,
    deltaY: 64,
  };

  await dispatchWheelAtPoint(page, wheelPoint, {
    ctrlKey: true,
    deltaY: 180,
  });

  await expect.poll(() => getViewportZoom(page)).toBeLessThan(1);
  await waitForViewportSettle(page);

  const zoomedScroll = await getViewerScroll(page);
  const zoomedViewport = {
    x: zoomedScroll?.x || 0,
    y: zoomedScroll?.y || 0,
    zoom: (await getViewportZoom(page)) || 1,
  };
  const overlayPan = await mouseWheelAndMeasureScrollDelta(
    page,
    wheelPoint,
    wheelDelta
  );

  const expectedDelta = {
    x: wheelDelta.deltaX / zoomedViewport.zoom,
    y: wheelDelta.deltaY / zoomedViewport.zoom,
  };

  expect(overlayPan.x).toBeCloseTo(expectedDelta.x, 0);
  expect(overlayPan.y).toBeCloseTo(expectedDelta.y, 0);
});

test("wheel pan keeps the same screen-space speed at high zoom", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await resetViewport(page);
  await setViewport(page, { x: 260, y: 180, zoom: 16 });

  const host = page.locator(".canvas-host");
  const hostBox = await host.boundingBox();

  if (!hostBox) {
    throw new Error("Missing canvas host");
  }

  const wheelPoint = {
    x: hostBox.x + hostBox.width / 2,
    y: hostBox.y + hostBox.height / 2,
  };
  const wheelDelta = {
    deltaX: 96,
    deltaY: 64,
  };
  const pan = await mouseWheelAndMeasureScrollDelta(
    page,
    wheelPoint,
    wheelDelta
  );

  expect(pan.x).toBeCloseTo(wheelDelta.deltaX / 16, 0);
  expect(pan.y).toBeCloseTo(wheelDelta.deltaY / 16, 0);
});

for (const modifier of [
  { altKey: true, label: "command-option", metaKey: true },
  { altKey: true, ctrlKey: true, label: "control-option" },
]) {
  test(`${modifier.label} wheel remains a pan gesture`, async ({ page }) => {
    await gotoEditor(page);
    await loadDocument(page, ARTBOARD_DOCUMENT);
    await resetViewport(page);
    await setViewport(page, { x: 260, y: 180, zoom: 6 });

    const hostBox = await page.locator(".canvas-host").boundingBox();

    if (!hostBox) {
      throw new Error("Missing canvas host");
    }

    const wheelPoint = {
      x: Math.round(hostBox.x + hostBox.width * 0.72),
      y: Math.round(hostBox.y + hostBox.height * 0.38),
    };
    const initialScroll = await getViewerScroll(page);

    await dispatchWheelAtPoint(page, wheelPoint, {
      ...modifier,
      deltaX: 96,
      deltaY: 64,
    });

    await expect.poll(() => getViewportZoom(page)).toBe(6);
    await expect.poll(() => getViewerScroll(page)).not.toEqual(initialScroll);
  });
}

test("space-drag pan keeps the same screen-space speed at high zoom", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await resetViewport(page);
  await setViewport(page, { x: 260, y: 180, zoom: 16 });

  const hostBox = await page.locator(".canvas-host").boundingBox();

  if (!hostBox) {
    throw new Error("Missing canvas host");
  }

  const start = {
    x: hostBox.x + hostBox.width / 2,
    y: hostBox.y + hostBox.height / 2,
  };
  const dragDelta = {
    x: 96,
    y: 64,
  };
  const initialScroll = await getViewerScroll(page);

  await page.keyboard.down("Space");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dragDelta.x, start.y + dragDelta.y, {
    steps: 4,
  });
  await page.mouse.up();
  await page.keyboard.up("Space");
  await expect.poll(() => getViewerScroll(page)).not.toEqual(initialScroll);
  const nextScroll = await getViewerScroll(page);

  expect((nextScroll?.x || 0) - (initialScroll?.x || 0)).toBeCloseTo(
    -dragDelta.x / 16,
    0
  );
  expect((nextScroll?.y || 0) - (initialScroll?.y || 0)).toBeCloseTo(
    -dragDelta.y / 16,
    0
  );
});

test("space-drag over a selected Raster pans without changing the document", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Expected Canvas2D");
    }

    context.fillStyle = "#3366ff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  });

  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          assetId: "asset-space-pan-raster",
          height: 64,
          id: "space-pan-raster",
          mimeType: "image/png",
          name: "Space Pan Raster",
          opacity: 1,
          parentId: "root",
          src,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 320,
            y: 220,
          },
          type: "image",
          visible: true,
          width: 64,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);
  await setViewport(
    page,
    await page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const hostRect = editor?.hostRef?.getBoundingClientRect();
      const zoom = 16;

      if (!(editor && hostRect)) {
        throw new Error("Expected editor viewport");
      }

      return {
        x: 320 + 32 - hostRect.width / (2 * zoom),
        y: 220 + 32 - hostRect.height / (2 * zoom),
        zoom,
      };
    })
  );

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("space-pan-raster");
  });

  const rasterButton = page.locator('[data-node-id="space-pan-raster"] button');
  await expect(rasterButton).toBeVisible();
  const rasterBox = await rasterButton.boundingBox();

  if (!rasterBox) {
    throw new Error("Expected selected Raster hit target");
  }

  const start = {
    x: rasterBox.x + rasterBox.width / 2,
    y: rasterBox.y + rasterBox.height / 2,
  };
  const dragDelta = { x: 96, y: 64 };
  const initialScroll = await getViewerScroll(page);
  const beforeDocument = await serializeDocument(page);

  await page.keyboard.down("Space");
  await expect(page.locator(".canvas-host")).toHaveAttribute(
    "data-panning",
    "true"
  );
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dragDelta.x, start.y + dragDelta.y, {
    steps: 4,
  });
  await page.mouse.up();
  await page.keyboard.up("Space");

  await expect.poll(() => getViewerScroll(page)).not.toEqual(initialScroll);
  expect(await serializeDocument(page)).toBe(beforeDocument);

  const beforeNormalDragDocument = await serializeDocument(page);
  const normalDragBox = await rasterButton.boundingBox();

  if (!normalDragBox) {
    throw new Error("Expected Raster hit target after Space release");
  }

  const normalDragStart = {
    x: normalDragBox.x + normalDragBox.width / 2,
    y: normalDragBox.y + normalDragBox.height / 2,
  };

  await page.mouse.move(normalDragStart.x, normalDragStart.y);
  await page.mouse.down();
  await page.mouse.move(
    normalDragStart.x + dragDelta.x,
    normalDragStart.y + dragDelta.y,
    { steps: 4 }
  );
  await page.mouse.up();

  await expect
    .poll(() => serializeDocument(page))
    .not.toBe(beforeNormalDragDocument);
});

test("repeated trackpad pinch zoom keeps the cursor world point anchored", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await resetViewport(page);
  await setViewport(page, { x: 260, y: 180, zoom: 16 });

  const host = page.locator(".canvas-host");
  const hostBox = await host.boundingBox();

  if (!hostBox) {
    throw new Error("Missing canvas host");
  }

  const wheelPoint = {
    x: Math.round(hostBox.x + hostBox.width * 0.72),
    y: Math.round(hostBox.y + hostBox.height * 0.38),
  };
  const getWorldPoint = () =>
    page.evaluate((point) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const hostRect = editor?.hostRef?.getBoundingClientRect();

      if (!(editor && hostRect)) {
        return null;
      }

      return {
        x: editor.viewport.x + (point.x - hostRect.left) / editor.viewport.zoom,
        y: editor.viewport.y + (point.y - hostRect.top) / editor.viewport.zoom,
        zoom: editor.viewport.zoom,
      };
    }, wheelPoint);
  const before = await getWorldPoint();

  for (let index = 0; index < 20; index += 1) {
    const previousZoom = (await getWorldPoint())?.zoom;

    await dispatchWheelAtPoint(page, wheelPoint, {
      ctrlKey: true,
      deltaY: -12,
    });
    await expect
      .poll(async () => (await getWorldPoint())?.zoom)
      .not.toBe(previousZoom);
  }

  const after = await getWorldPoint();

  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(
    Math.abs((after?.x || 0) - (before?.x || 0)) * (after?.zoom || 1)
  ).toBeLessThan(1);
  expect(
    Math.abs((after?.y || 0) - (before?.y || 0)) * (after?.zoom || 1)
  ).toBeLessThan(1);
});

test("rapid trackpad pinch keeps its mode through the momentum tail", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await resetViewport(page);
  await setViewport(page, { x: 260, y: 180, zoom: 6 });

  const hostBox = await page.locator(".canvas-host").boundingBox();

  if (!hostBox) {
    throw new Error("Missing canvas host");
  }

  const wheelPoint = {
    x: Math.round(hostBox.x + hostBox.width * 0.72),
    y: Math.round(hostBox.y + hostBox.height * 0.38),
  };
  const readViewport = () =>
    page.evaluate((point) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const hostRect = editor?.hostRef?.getBoundingClientRect();

      if (!(editor && hostRect)) {
        return null;
      }

      return {
        anchorX:
          editor.viewport.x + (point.x - hostRect.left) / editor.viewport.zoom,
        anchorY:
          editor.viewport.y + (point.y - hostRect.top) / editor.viewport.zoom,
        x: editor.viewport.x,
        y: editor.viewport.y,
        zoom: editor.viewport.zoom,
      };
    }, wheelPoint);

  await page.evaluate((point) => {
    const target = document.elementFromPoint(point.x, point.y);

    for (let index = 0; index < 24; index += 1) {
      target?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: point.x,
          ctrlKey: true,
          clientY: point.y,
          deltaMode: WheelEvent.DOM_DELTA_PIXEL,
          deltaY: -12,
        })
      );
    }
  }, wheelPoint);

  const burstViewport = await readViewport();

  await page.evaluate((point) => {
    const target = document.elementFromPoint(point.x, point.y);

    for (let index = 0; index < 12; index += 1) {
      target?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: point.x,
          clientY: point.y,
          deltaMode: WheelEvent.DOM_DELTA_PIXEL,
          deltaY: -12,
        })
      );
    }
  }, wheelPoint);

  await page.waitForTimeout(300);

  const settledViewport = await readViewport();

  expect(burstViewport?.zoom).toBeGreaterThan(6);
  expect(settledViewport).toEqual(burstViewport);
});
