import { expect, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocument,
  resetViewport,
  setViewport,
} from "./helpers/editor";

const transform = (x: number, y: number) => ({
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  x,
  y,
});

const getStagePoint = async (
  page,
  point: {
    x: number;
    y: number;
  }
) => {
  const box = await page.getByTestId("canvas-stage").boundingBox();

  if (!box) {
    throw new Error("Expected canvas stage");
  }

  return { x: box.x + point.x, y: box.y + point.y };
};

const getCursorAtPoint = (
  page,
  point: {
    x: number;
    y: number;
  }
) => {
  return page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);

    return element ? window.getComputedStyle(element).cursor : null;
  }, point);
};

test("Workspace Brush is disabled and cannot create a Raster", async ({
  page,
}) => {
  await gotoEditor(page);
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 0.04 });
  await page.keyboard.press("b");

  const surfaceBox = await page.locator(".canvas-surface").boundingBox();

  if (!surfaceBox) {
    throw new Error("Expected canvas surface");
  }

  const start = {
    x: surfaceBox.x + surfaceBox.width * 0.25,
    y: surfaceBox.y + surfaceBox.height * 0.25,
  };
  const end = {
    x: surfaceBox.x + surfaceBox.width * 0.75,
    y: surfaceBox.y + surfaceBox.height * 0.75,
  };

  await page.mouse.move(start.x, start.y);
  await expect(page.locator(".canvas-host")).toHaveAttribute(
    "data-raster-cursor-disabled",
    "true"
  );
  await expect(page.getByTestId("brush-cursor")).toBeHidden();

  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 3 });
  await page.mouse.up();

  expect(
    await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.nodes.length)
  ).toBe(0);
});

test("Brush footprint replaces the native cursor through a captured drag", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 300,
          id: "frame",
          locked: false,
          name: "Frame",
          parentId: "root",
          transform: transform(220, 160),
          type: "artboard",
          visible: true,
          width: 400,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.clearSelection());
  await page.keyboard.press("b");

  const frameBox = await page
    .locator('[data-artboard-body="frame"]')
    .boundingBox();

  if (!frameBox) {
    throw new Error("Expected Frame body");
  }

  const point = {
    x: frameBox.x + 80,
    y: frameBox.y + 80,
  };
  const movedPoint = {
    x: point.x + 12,
    y: point.y + 8,
  };
  const cursor = page.getByTestId("brush-cursor");

  await page.mouse.move(point.x, point.y);
  await expect(cursor).toBeVisible();
  await expect.poll(() => getCursorAtPoint(page, point)).toBe("none");

  await page.evaluate(() => {
    const cursorElement = document.querySelector(
      '[data-testid="brush-cursor"]'
    );
    const host = document.querySelector(".canvas-host");

    if (
      !(cursorElement instanceof HTMLElement && host instanceof HTMLElement)
    ) {
      throw new Error("Expected Brush cursor and canvas host");
    }

    let pendingMove:
      | {
          capturedCursor: string;
          capturedTarget: string;
          eventTime: number;
          hitCursor: string | null;
          x: number;
          y: number;
        }
      | undefined;

    host.addEventListener(
      "pointermove",
      (event) => {
        if (!(event instanceof PointerEvent) || event.buttons !== 1) {
          return;
        }

        const capturedTarget =
          event.target instanceof Element ? event.target : null;
        const hitTarget = document.elementFromPoint(
          event.clientX,
          event.clientY
        );
        pendingMove = {
          capturedCursor: capturedTarget
            ? getComputedStyle(capturedTarget).cursor
            : "",
          capturedTarget:
            capturedTarget?.getAttribute("class") ??
            capturedTarget?.tagName ??
            "",
          eventTime: performance.now(),
          hitCursor: hitTarget ? getComputedStyle(hitTarget).cursor : null,
          x: event.clientX,
          y: event.clientY,
        };
      },
      { capture: true }
    );

    const observer = new MutationObserver(() => {
      if (!pendingMove) {
        return;
      }

      const bounds = cursorElement.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      host.dataset.brushCursorDragSample = JSON.stringify({
        alignmentError: Math.hypot(
          centerX - pendingMove.x,
          centerY - pendingMove.y
        ),
        capturedCursor: pendingMove.capturedCursor,
        capturedTarget: pendingMove.capturedTarget,
        hitCursor: pendingMove.hitCursor,
        latencyMs: performance.now() - pendingMove.eventTime,
      });
      pendingMove = undefined;
    });

    observer.observe(cursorElement, {
      attributeFilter: ["style"],
      attributes: true,
    });
  });

  await page.mouse.down();
  await expect(cursor).toBeVisible();
  await expect.poll(() => getCursorAtPoint(page, point)).toBe("none");

  await page.mouse.move(movedPoint.x, movedPoint.y);
  await expect
    .poll(() =>
      page.locator(".canvas-host").getAttribute("data-brush-cursor-drag-sample")
    )
    .not.toBeNull();
  const dragSample = await page
    .locator(".canvas-host")
    .getAttribute("data-brush-cursor-drag-sample");

  expect(JSON.parse(dragSample ?? "null")).toMatchObject({
    alignmentError: expect.any(Number),
    capturedCursor: "none",
    hitCursor: "none",
    latencyMs: expect.any(Number),
  });
  const measuredDrag = JSON.parse(dragSample ?? "null") as {
    alignmentError: number;
    latencyMs: number;
  };
  expect(measuredDrag.alignmentError).toBeLessThanOrEqual(0.5);
  expect(measuredDrag.latencyMs).toBeLessThanOrEqual(50);
  await expect.poll(() => getCursorAtPoint(page, movedPoint)).toBe("none");
  await expect(cursor).toBeVisible();

  await page.mouse.up();
  await expect(cursor).toBeVisible();
  await expect.poll(() => getCursorAtPoint(page, movedPoint)).toBe("none");
});

test("active Frame defers Raster creation until an outside drag intersects it", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 300,
          id: "frame",
          locked: false,
          name: "Frame",
          parentId: "root",
          transform: transform(220, 160),
          type: "artboard",
          visible: true,
          width: 400,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.clearSelection());
  await expect(page.locator('[data-layer-row-id="frame"]')).toHaveAttribute(
    "data-active-layer",
    "true"
  );
  expect(
    await page.evaluate(
      () => window.__PUNCHPRESS_EDITOR__?.selectedNodeIds.length
    )
  ).toBe(0);
  await page.keyboard.press("b");

  const frameBox = await page
    .locator('[data-artboard-body="frame"]')
    .boundingBox();

  if (!frameBox) {
    throw new Error("Expected Frame body");
  }

  const outsideStart = {
    x: frameBox.x - 120,
    y: frameBox.y + 80,
  };
  const outsideEnd = {
    x: frameBox.x - 60,
    y: frameBox.y + 100,
  };

  await page.mouse.move(outsideStart.x, outsideStart.y);
  await expect(page.getByTestId("brush-cursor")).toBeVisible();
  const revisionBefore = await page.evaluate(
    () => window.__PUNCHPRESS_EDITOR__?.history.currentRevision
  );

  await page.mouse.down();
  await page.mouse.move(outsideEnd.x, outsideEnd.y, { steps: 3 });
  await page.mouse.up();

  expect(
    await page.evaluate(
      () =>
        window.__PUNCHPRESS_EDITOR__?.nodes.filter(
          (node) => node.type === "image"
        ).length
    )
  ).toBe(0);
  expect(
    await page.evaluate(
      () => window.__PUNCHPRESS_EDITOR__?.history.currentRevision
    )
  ).toBe(revisionBefore);

  const crossingStart = {
    x: frameBox.x - 120,
    y: frameBox.y + 120,
  };
  const crossingOutside = {
    x: frameBox.x - 40,
    y: frameBox.y + 120,
  };
  const crossingEnd = {
    x: frameBox.x + 80,
    y: frameBox.y + 128,
  };

  await page.mouse.move(crossingStart.x, crossingStart.y);
  await page.mouse.down();
  await page.mouse.move(crossingOutside.x, crossingOutside.y, { steps: 2 });
  expect(
    await page.evaluate(
      () =>
        window.__PUNCHPRESS_EDITOR__?.nodes.filter(
          (node) => node.type === "image"
        ).length
    )
  ).toBe(0);
  await page.mouse.move(crossingEnd.x, crossingEnd.y, { steps: 6 });
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const raster = editor?.nodes.find((node) => node.type === "image");

        return raster?.type === "image"
          ? {
              height: raster.height,
              active: editor?.activeLayerId === raster.id,
              parentId: raster.parentId,
              width: raster.width,
            }
          : null;
      })
    )
    .toMatchObject({
      active: true,
      parentId: "frame",
    });

  const result = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const raster = editor?.nodes.find((node) => node.type === "image");

    return {
      height: raster?.type === "image" ? raster.height : 0,
      revision: editor?.history.currentRevision,
      width: raster?.type === "image" ? raster.width : 0,
    };
  });

  expect(result.revision).toBe((revisionBefore || 0) + 1);
  expect(result.width).toBeLessThan(100);
  expect(result.height).toBeLessThan(80);
});

test("an extreme outside tail stays finite after intersecting an active Frame", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 300,
          id: "frame",
          locked: false,
          name: "Frame",
          parentId: "root",
          transform: transform(220, 160),
          type: "artboard",
          visible: true,
          width: 400,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 0.04 });

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      throw new Error("Expected editor");
    }

    editor.clearSelection();
    editor.setBrushSettings(
      {
        hardness: 0.5,
        opacity: 1,
        size: 4,
        spacing: 0.25,
      },
      "brush"
    );
    editor.setActiveTool("brush");
    const revisionBefore = editor.history.currentRevision;
    const session = editor.dispatchCanvasPointerDown({
      point: { x: -1_000_000, y: 300 },
    });

    session?.update({ point: { x: 240, y: 300 } });
    await session?.complete({ point: { x: 1_000_000, y: 300 } });

    const raster = editor.nodes.find((node) => node.type === "image");

    return raster?.type === "image"
      ? {
          height: raster.height,
          revisionDelta: editor.history.currentRevision - revisionBefore,
          right: raster.transform.x + raster.width,
          tileSourceCount: raster.tileSources?.length || 0,
          width: raster.width,
          x: raster.transform.x,
        }
      : null;
  });

  expect(result).toMatchObject({
    revisionDelta: 1,
    tileSourceCount: expect.any(Number),
  });
  expect(result?.tileSourceCount).toBeGreaterThan(0);
  expect(result?.x).toBeGreaterThanOrEqual(220);
  expect(result?.right).toBeLessThanOrEqual(620);
  expect(result?.width).toBeLessThanOrEqual(400);
  expect(result?.height).toBeLessThanOrEqual(300);
});

test("outside excursion re-entry does not paint a chord across the Frame", async ({
  page,
}) => {
  await gotoEditor(page);
  const transparentSrc = await page.evaluate(() => {
    const canvas = document.createElement("canvas");

    canvas.width = 400;
    canvas.height = 300;
    return canvas.toDataURL("image/png");
  });
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 300,
          id: "frame",
          locked: false,
          name: "Frame",
          parentId: "root",
          transform: transform(220, 160),
          type: "artboard",
          visible: true,
          width: 400,
        },
        {
          assetId: "asset-raster",
          height: 300,
          id: "raster",
          mimeType: "image/png",
          name: "Raster",
          opacity: 1,
          parentId: "frame",
          src: transparentSrc,
          transform: transform(220, 160),
          type: "image",
          visible: true,
          width: 400,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      throw new Error("Expected editor");
    }

    editor.clearSelection();
    editor.setBrushSettings(
      {
        hardness: 0.5,
        opacity: 1,
        size: 8,
        spacing: 0.25,
      },
      "brush"
    );
    editor.setActiveTool("brush");
    const session = editor.dispatchCanvasPointerDown({
      point: { x: 240, y: 440 },
    });

    session?.update({ point: { x: 700, y: 80 } });
    await session?.complete({ point: { x: 600, y: 440 } });

    const raster = editor.getNode("raster");

    if (!(raster?.type === "image" && raster.src)) {
      throw new Error("Expected committed Raster");
    }

    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Expected Raster image"));
    });
    image.src = raster.src;
    await loaded;

    const canvas = document.createElement("canvas");
    canvas.width = raster.width;
    canvas.height = raster.height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Expected Canvas2D context");
    }

    context.drawImage(image, 0, 0);
    const sampleX = 392;
    const sampleY = 95;
    const alpha = context.getImageData(sampleX, sampleY, 1, 1).data[3];

    return {
      alpha,
      height: raster.height,
      width: raster.width,
    };
  });

  expect(result.alpha).toBe(0);
  expect(result.width).toBe(400);
  expect(result.height).toBe(300);
});

test("native Hard Round restarts with a clipped round cap after a Frame excursion", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 300,
          id: "frame",
          locked: false,
          name: "Frame",
          parentId: "root",
          transform: transform(220, 160),
          type: "artboard",
          visible: true,
          width: 400,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      throw new Error("Expected editor");
    }

    editor.select("frame");
    editor.setBrushSettings(
      {
        flow: 1,
        hardness: 1,
        opacity: 1,
        size: 24,
        smoothing: 0.1,
        spacing: 0,
      },
      "brush"
    );
    editor.setActiveTool("brush");
    const session = editor.dispatchCanvasPointerDown({
      point: { x: 240, y: 310 },
    });

    session?.update({ point: { x: 180, y: 100 } });
    session?.update({ point: { x: 660, y: 100 } });
    session?.update({ point: { x: 600, y: 310 } });
    await session?.delegate?.ready;
    const workingGroup = editor
      .getRasterWorkingPresentations()
      .flatMap((presentation) => presentation.groups)
      .find((group) => group.phase === "active");
    await session?.complete({ point: { x: 590, y: 330 } });

    const raster = editor.nodes.find((node) => node.type === "image");

    if (!(raster?.type === "image" && raster.src)) {
      throw new Error("Expected committed Raster");
    }

    const image = new Image();

    image.src = raster.src;
    await image.decode();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = raster.width;
    canvas.height = raster.height;
    if (!context) {
      throw new Error("Expected Canvas2D context");
    }
    context.drawImage(image, 0, 0);
    const readWorldAlpha = (point) => {
      const x = Math.floor(point.x - raster.transform.x);
      const y = Math.floor(point.y - raster.transform.y);

      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
        return 0;
      }

      return context.getImageData(x, y, 1, 1).data[3];
    };

    return {
      chordAlpha: readWorldAlpha({ x: 420, y: 240 }),
      frameBounds: editor.getNodeRenderFrame("frame")?.bounds,
      rasterBounds: editor.getNodeRenderFrame(raster.id)?.bounds,
      reentryCapAlpha: readWorldAlpha({ x: 618, y: 240 }),
      workingSize:
        workingGroup?.content.kind === "canvas"
          ? {
              height: workingGroup.content.canvas.height,
              width: workingGroup.content.canvas.width,
            }
          : null,
    };
  });

  expect(result.chordAlpha).toBe(0);
  expect(result.reentryCapAlpha).toBe(255);
  expect(result.workingSize?.width).toBeLessThanOrEqual(400);
  expect(result.workingSize?.height).toBeLessThanOrEqual(300);
  expect(result.rasterBounds?.minX).toBeGreaterThanOrEqual(
    result.frameBounds?.minX || 0
  );
  expect(result.rasterBounds?.minY).toBeGreaterThanOrEqual(
    result.frameBounds?.minY || 0
  );
  expect(result.rasterBounds?.maxX).toBeLessThanOrEqual(
    result.frameBounds?.maxX || 0
  );
  expect(result.rasterBounds?.maxY).toBeLessThanOrEqual(
    result.frameBounds?.maxY || 0
  );
});

test("rotated Frame clipping retains the native boundary fallback", async ({
  page,
}) => {
  await gotoEditor(page);
  const transparentSrc = await page.evaluate(() => {
    const canvas = document.createElement("canvas");

    canvas.width = 200;
    canvas.height = 200;
    return canvas.toDataURL("image/png");
  });
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 300,
          id: "frame",
          locked: false,
          name: "Frame",
          parentId: "root",
          transform: transform(220, 160),
          type: "artboard",
          visible: true,
          width: 400,
        },
        {
          assetId: "rotated-raster-asset",
          height: 200,
          id: "rotated-raster",
          mimeType: "image/png",
          name: "Rotated Raster",
          opacity: 1,
          parentId: "frame",
          src: transparentSrc,
          transform: { ...transform(320, 210), rotation: 45 },
          type: "image",
          visible: true,
          width: 200,
        },
      ],
      version: "1.8",
    })
  );

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const raster = editor?.getNode("rotated-raster");
    const frame = editor?.getNodeRenderFrame("frame")?.bounds;

    if (!(editor && raster?.type === "image" && frame)) {
      throw new Error("Expected rotated Frame Raster");
    }

    Object.assign(editor, { rasterSurface: null });
    const spans: Record<string, number[]> = {};

    window.__PUNCHPRESS_PERF_SINK__ = {
      incrementCounter() {
        // This contract records only the boundary fallback duration.
      },
      recordDuration(label, durationMs) {
        spans[label] ||= [];
        spans[label].push(durationMs);
      },
    };
    editor.select(raster.id);
    editor.setBrushSettings(
      {
        flow: 1,
        hardness: 1,
        opacity: 1,
        size: 24,
        smoothing: 0.1,
        spacing: 0,
      },
      "brush"
    );
    editor.setActiveTool("brush");
    const rasterBounds = editor.getNodeRenderFrame(raster.id)?.bounds;
    const start = {
      x: ((rasterBounds?.minX || 0) + (rasterBounds?.maxX || 0)) / 2,
      y: ((rasterBounds?.minY || 0) + (rasterBounds?.maxY || 0)) / 2,
    };
    const session = editor.dispatchNodePointerDown({
      node: raster,
      point: start,
    });

    await session?.delegate?.ready;
    session?.update({
      point: { x: frame.minX - 2, y: (frame.minY + frame.maxY) / 2 },
    });
    session?.cancel();
    window.__PUNCHPRESS_PERF_SINK__ = undefined;

    return {
      boundaryApplyCount: spans["brush.nativeBoundary.apply"]?.length || 0,
      usedSurfaceClipFastPath: Boolean(
        session?.delegate?.canRenderNativePathWithSurfaceClip?.()
      ),
    };
  });

  expect(result.usedSurfaceClipFastPath).toBe(false);
  expect(result.boundaryApplyCount).toBeGreaterThan(0);
});

test("fractional Frame clipping retains the native boundary fallback", async ({
  page,
}) => {
  await gotoEditor(page);
  const transparentSrc = await page.evaluate(() => {
    const canvas = document.createElement("canvas");

    canvas.width = 200;
    canvas.height = 200;
    return canvas.toDataURL("image/png");
  });
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 300,
          id: "frame",
          locked: false,
          name: "Frame",
          parentId: "root",
          transform: transform(220, 160),
          type: "artboard",
          visible: true,
          width: 399.5,
        },
        {
          assetId: "fractional-raster-asset",
          height: 200,
          id: "fractional-raster",
          mimeType: "image/png",
          name: "Fractional Raster",
          opacity: 1,
          parentId: "frame",
          src: transparentSrc,
          transform: transform(500, 210),
          type: "image",
          visible: true,
          width: 200,
        },
      ],
      version: "1.8",
    })
  );

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const raster = editor?.getNode("fractional-raster");
    const frame = editor?.getNodeRenderFrame("frame")?.bounds;

    if (!(editor && raster?.type === "image" && frame)) {
      throw new Error("Expected fractionally clipped Frame Raster");
    }

    Object.assign(editor, { rasterSurface: null });
    const spans: Record<string, number[]> = {};

    window.__PUNCHPRESS_PERF_SINK__ = {
      incrementCounter() {
        // This contract records only the boundary fallback duration.
      },
      recordDuration(label, durationMs) {
        spans[label] ||= [];
        spans[label].push(durationMs);
      },
    };
    editor.select(raster.id);
    editor.setBrushSettings(
      {
        flow: 1,
        hardness: 1,
        opacity: 1,
        size: 24,
        smoothing: 0.1,
        spacing: 0,
      },
      "brush"
    );
    editor.setActiveTool("brush");
    const session = editor.dispatchNodePointerDown({
      node: raster,
      point: {
        x: frame.maxX - 40,
        y: (frame.minY + frame.maxY) / 2,
      },
    });

    await session?.delegate?.ready;
    session?.update({
      point: { x: frame.maxX + 2, y: (frame.minY + frame.maxY) / 2 },
    });
    session?.cancel();
    window.__PUNCHPRESS_PERF_SINK__ = undefined;

    return {
      boundaryApplyCount: spans["brush.nativeBoundary.apply"]?.length || 0,
      usedSurfaceClipFastPath: Boolean(
        session?.delegate?.canRenderNativePathWithSurfaceClip?.()
      ),
    };
  });

  expect(result.usedSurfaceClipFastPath).toBe(false);
  expect(result.boundaryApplyCount).toBeGreaterThan(0);
});

test("clipped legacy pointer-up applies its endpoint once", async ({
  page,
}) => {
  await gotoEditor(page);
  const transparentSrc = await page.evaluate(() => {
    const canvas = document.createElement("canvas");

    canvas.width = 100;
    canvas.height = 100;
    return canvas.toDataURL("image/png");
  });
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          assetId: "asset-raster",
          height: 100,
          id: "raster",
          mimeType: "image/png",
          name: "Raster",
          opacity: 1,
          parentId: "root",
          src: transparentSrc,
          transform: transform(0, 0),
          type: "image",
          visible: true,
          width: 100,
        },
      ],
      version: "1.8",
    })
  );

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const raster = editor?.getNode("raster");

    if (!(editor && raster?.type === "image")) {
      throw new Error("Expected Raster");
    }

    Object.assign(editor, { rasterSurface: null });
    editor.clearSelection();
    editor.setBrushSettings(
      {
        hardness: 0.5,
        opacity: 0.5,
        size: 8,
        smoothing: 0,
        spacing: 2,
      },
      "brush"
    );
    editor.setActiveTool("brush");
    const session = editor.dispatchNodePointerDown({
      node: raster,
      point: { x: 20, y: 50 },
    });

    await session?.complete({ point: { x: 40, y: 50 } });
  });

  await expect
    .poll(() =>
      page.evaluate(
        (initialSource) =>
          window.__PUNCHPRESS_EDITOR__?.getNode("raster")?.src !==
          initialSource,
        transparentSrc
      )
    )
    .toBe(true);

  const alpha = await page.evaluate(async () => {
    const raster = window.__PUNCHPRESS_EDITOR__?.getNode("raster");

    if (!(raster?.type === "image" && raster.src)) {
      throw new Error("Expected committed Raster");
    }

    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Expected Raster image"));
    });
    image.src = raster.src;
    await loaded;

    const canvas = document.createElement("canvas");
    canvas.width = raster.width;
    canvas.height = raster.height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Expected Canvas2D context");
    }

    context.drawImage(image, 0, 0);
    return context.getImageData(40, 50, 1, 1).data[3];
  });

  expect(alpha).toBeGreaterThanOrEqual(115);
  expect(alpha).toBeLessThanOrEqual(130);
});

test("Crop changes bounds with stationary retained pixels and supports cancel", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = 100;
    canvas.height = 80;
    if (!context) {
      throw new Error("Expected Canvas2D context");
    }
    context.fillStyle = "#ff3366";
    context.fillRect(0, 0, 100, 80);
    return canvas.toDataURL("image/png");
  });

  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          assetId: "asset-raster",
          baseHeight: 80,
          baseWidth: 100,
          baseX: 0,
          baseY: 0,
          height: 80,
          id: "raster",
          mimeType: "image/png",
          name: "Raster",
          opacity: 1,
          parentId: "root",
          src,
          transform: transform(320, 240),
          type: "image",
          visible: true,
          width: 100,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.select("raster"));
  await expect(
    page.locator('[data-raster-resident-surface="canvas2d"]')
  ).toBeVisible();

  await page.getByRole("button", { name: "Crop Raster" }).click();
  await expect(page.getByTestId("raster-crop-overlay")).toBeVisible();

  const northwest = page.locator('[data-raster-crop-handle="nw"]');
  const northwestBox = await northwest.boundingBox();

  if (!northwestBox) {
    throw new Error("Expected Crop northwest handle");
  }

  await page.mouse.move(northwestBox.x + 2, northwestBox.y + 2);
  await page.mouse.down();
  await page.mouse.move(northwestBox.x + 22, northwestBox.y + 12);
  await page.mouse.up();
  await page.keyboard.press("Escape");

  await expect(page.getByTestId("raster-crop-overlay")).toBeHidden();
  expect(
    await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.getNode("raster"))
  ).toMatchObject({
    baseX: 0,
    baseY: 0,
    height: 80,
    transform: { x: 320, y: 240 },
    width: 100,
  });

  await page.getByRole("button", { name: "Crop Raster" }).click();
  await expect(page.getByTestId("raster-crop-overlay")).toBeVisible();
  const nextNorthwestBox = await northwest.boundingBox();

  if (!nextNorthwestBox) {
    throw new Error("Expected Crop northwest handle");
  }

  await page.mouse.move(nextNorthwestBox.x + 2, nextNorthwestBox.y + 2);
  await page.mouse.down();
  await page.mouse.move(nextNorthwestBox.x + 22, nextNorthwestBox.y + 12);
  await page.mouse.up();
  const cropOverlayBox = await page
    .getByTestId("raster-crop-overlay")
    .boundingBox();

  if (!cropOverlayBox) {
    throw new Error("Expected Crop overlay");
  }

  await page.mouse.click(cropOverlayBox.x + 4, cropOverlayBox.y + 4);

  await expect(page.getByTestId("raster-crop-overlay")).toBeHidden();
  expect(
    await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.selectedNodeId)
  ).toBeNull();
  await expect(
    page.locator('[data-raster-resident-surface="canvas2d"]')
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.getNode("raster"))
  ).toMatchObject({
    baseHeight: 80,
    baseWidth: 100,
    baseX: -20,
    baseY: -10,
    height: 70,
    transform: { x: 340, y: 250 },
    width: 80,
  });

  const sourceBeforeBrush = await page.evaluate(
    () => window.__PUNCHPRESS_EDITOR__?.getNode("raster")?.src
  );
  await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.select("raster"));
  await page.keyboard.press("b");
  const paintPoint = await getStagePoint(page, { x: 380, y: 285 });
  await page.mouse.move(paintPoint.x, paintPoint.y);
  await page.mouse.down();
  await page.mouse.move(paintPoint.x + 12, paintPoint.y, { steps: 3 });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const group = window.__PUNCHPRESS_EDITOR__
          ?.getRasterWorkingPresentation("raster")
          ?.groups.find(({ phase }) => phase === "active");

        return group?.content.kind === "canvas"
          ? {
              x: group.content.x,
              y: group.content.y,
            }
          : null;
      })
    )
    .toEqual({ x: -20, y: -10 });
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate((previousSource) => {
        const raster = window.__PUNCHPRESS_EDITOR__?.getNode("raster");

        return raster?.type === "image"
          ? {
              baseHeight: raster.baseHeight,
              baseWidth: raster.baseWidth,
              baseX: raster.baseX,
              baseY: raster.baseY,
              height: raster.height,
              sourceChanged: raster.src !== previousSource,
              width: raster.width,
            }
          : null;
      }, sourceBeforeBrush)
    )
    .toEqual({
      baseHeight: 80,
      baseWidth: 100,
      baseX: -20,
      baseY: -10,
      height: 70,
      sourceChanged: true,
      width: 80,
    });
});

test("tiled painting preserves a cropped Raster plane and local coordinates", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = 100;
    canvas.height = 80;
    if (!context) {
      throw new Error("Expected Canvas2D context");
    }
    context.fillStyle = "#3355ff";
    context.fillRect(0, 0, 100, 80);
    return canvas.toDataURL("image/png");
  });

  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 500,
          id: "frame",
          locked: false,
          name: "Frame",
          parentId: "root",
          transform: transform(0, 0),
          type: "artboard",
          visible: true,
          width: 500,
        },
        {
          assetId: "asset-raster",
          height: 80,
          id: "raster",
          mimeType: "image/png",
          name: "Raster",
          opacity: 1,
          parentId: "frame",
          src,
          transform: transform(320, 240),
          type: "image",
          visible: true,
          width: 100,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 0.1 });

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      throw new Error("Expected editor");
    }

    editor.select("raster");
    editor.startCrop();
    editor.updateCrop({ height: 70, width: 80, x: 20, y: 10 });
    editor.commitCrop();
    editor.setBrushSettings(
      {
        hardness: 1,
        opacity: 1,
        size: 4,
        spacing: 0,
      },
      "brush"
    );
    editor.setActiveTool("brush");
    const raster = editor.getNode("raster");

    if (raster?.type !== "image") {
      throw new Error("Expected Raster");
    }

    const session = editor.dispatchNodePointerDown({
      node: raster,
      point: { x: 350, y: 260 },
    });

    const workingGroup =
      editor.getRasterWorkingPresentation?.("raster")?.groups[0];
    const activeClip = {
      allowsOverflow: workingGroup?.allowOverflow === true,
    };
    await session?.complete({ point: { x: 354, y: 260 } });
    const committed = editor.getNode("raster");

    return committed?.type === "image"
      ? {
          activeClip,
          baseHeight: committed.baseHeight,
          baseWidth: committed.baseWidth,
          baseX: committed.baseX,
          baseY: committed.baseY,
          height: committed.height,
          tileMinX: Math.min(
            ...(committed.tileSources || []).map((tile) => tile.x)
          ),
          tileSourceCount: committed.tileSources?.length || 0,
          width: committed.width,
        }
      : null;
  });

  expect(result).toMatchObject({
    activeClip: {
      allowsOverflow: false,
    },
    baseHeight: 80,
    baseWidth: 100,
    baseX: -20,
    baseY: -10,
    height: 70,
    tileMinX: expect.any(Number),
    width: 80,
  });
  expect(result?.tileSourceCount).toBeGreaterThan(0);
  expect(result?.tileMinX).toBeLessThan(20);
});

test("erasing a cropped Frame Raster preserves its plane and local coordinates", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = 100;
    canvas.height = 80;
    if (!context) {
      throw new Error("Expected Canvas2D context");
    }
    context.fillStyle = "#3355ff";
    context.fillRect(0, 0, 100, 80);
    return canvas.toDataURL("image/png");
  });

  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 500,
          id: "frame",
          locked: false,
          name: "Frame",
          parentId: "root",
          transform: transform(0, 0),
          type: "artboard",
          visible: true,
          width: 500,
        },
        {
          assetId: "asset-raster",
          height: 80,
          id: "raster",
          mimeType: "image/png",
          name: "Raster",
          opacity: 1,
          parentId: "frame",
          src,
          transform: transform(320, 240),
          type: "image",
          visible: true,
          width: 100,
        },
      ],
      version: "1.8",
    })
  );
  await resetViewport(page);

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      throw new Error("Expected editor");
    }

    editor.select("raster");
    editor.startCrop();
    editor.updateCrop({ height: 70, width: 80, x: 20, y: 10 });
    editor.commitCrop();
    Object.assign(editor, { rasterSurface: null });
    editor.setBrushSettings(
      {
        hardness: 1,
        opacity: 1,
        size: 4,
        smoothing: 0,
        spacing: 0,
      },
      "eraser"
    );
    editor.setActiveTool("eraser");
    const raster = editor.getNode("raster");

    if (raster?.type !== "image") {
      throw new Error("Expected Raster");
    }
    const bounds = editor.getNodeRenderFrame(raster.id)?.bounds;

    if (!bounds) {
      throw new Error("Expected Raster bounds");
    }
    const point = {
      x: bounds.minX + 2,
      y: bounds.minY + 5,
    };

    const session = editor.dispatchNodePointerDown({
      node: raster,
      point,
    });

    await session?.delegate?.ready;
    const workingGroup =
      editor.getRasterWorkingPresentation?.("raster")?.groups[0];

    await session?.complete({ point });
    const committed = editor.getNode("raster");

    if (committed?.type !== "image" || !committed.src) {
      throw new Error("Expected committed Raster");
    }

    const image = new Image();

    image.src = committed.src;
    await image.decode();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = image.width;
    canvas.height = image.height;
    if (!context) {
      throw new Error("Expected Canvas2D context");
    }
    context.drawImage(image, 0, 0);

    return {
      alpha: context.getImageData(22, 15, 1, 1).data[3],
      sessionStarted: Boolean(session),
      workingSurfaceType: workingGroup?.content.kind ?? null,
      baseHeight: committed.baseHeight,
      baseWidth: committed.baseWidth,
      baseX: committed.baseX,
      baseY: committed.baseY,
      height: committed.height,
      width: committed.width,
    };
  });

  expect(result).toEqual({
    alpha: 0,
    sessionStarted: true,
    workingSurfaceType: "canvas",
    baseHeight: 80,
    baseWidth: 100,
    baseX: -20,
    baseY: -10,
    height: 70,
    width: 80,
  });
});
