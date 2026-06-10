import { expect, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocument,
  resetViewport,
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

const dispatchWheelAtPoint = (page, point, eventInit) => {
  return page.evaluate(
    ({ init, targetPoint }) => {
      const target = document.elementFromPoint(targetPoint.x, targetPoint.y);

      target?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
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
    deltaY: 180,
    metaKey: true,
  });

  expect(zoomTarget?.className).toContain("canvas-single-selection");

  await expect.poll(() => getViewportZoom(page)).toBeLessThan(1);

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
    deltaY: 180,
    metaKey: true,
  });

  await expect.poll(() => getViewportZoom(page)).toBeLessThan(1);

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
