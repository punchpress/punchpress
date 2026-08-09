import { expect, type Page, test } from "@playwright/test";
import { gotoEditor, loadDocument } from "../e2e/helpers/editor";

const FRAME_HEIGHT = 5400;
const FRAME_WIDTH = 4500;
const FRAME_ID = "edge-input-frame";
const PROBE_KEY = "__PUNCHPRESS_FRAME_EDGE_INPUT_PROBE__";
const VIEWPORT = { height: 916, width: 768 };
const FRAME_SCREEN_ORIGIN = { x: 91, y: 126 };
const ZOOM = 0.15;
const INPUT_BURST_SIZE = 2;
const MAX_EVENT_TO_FRAME_P95_MS = 40;
const MAX_VISIBLE_TO_PAINT_P95_MS = 48;

test("held Frame Raster input stays continuous and responsive across its edge", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize(VIEWPORT);

  await loadFreshFrame(page);
  const center = await runRecordedGesture(page, false);

  await loadFreshFrame(page);
  const edge = await runRecordedGesture(page, true);
  const result = { center, edge };

  await testInfo.attach("frame-edge-input-latency", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  console.log(`frame-edge-input-latency ${JSON.stringify(result)}`);

  expect(edge.reentryCount, JSON.stringify(result)).toBeGreaterThanOrEqual(3);
  expect(edge.expiredVisibilityCount, JSON.stringify(result)).toBe(0);
  expect(edge.visibleSampleCount, JSON.stringify(result)).toBe(
    edge.inBoundsEventCount
  );
  expect(
    edge.reentryAlpha.every((alpha) => alpha > 200),
    JSON.stringify(result)
  ).toBe(true);
  expect(
    edge.appliedSegmentCount,
    JSON.stringify(result)
  ).toBeGreaterThanOrEqual(center.appliedSegmentCount * 0.9);
  expect(
    edge.expandedBounds?.width,
    JSON.stringify(result)
  ).toBeLessThanOrEqual(FRAME_WIDTH);
  expect(
    edge.expandedBounds?.height,
    JSON.stringify(result)
  ).toBeLessThanOrEqual(FRAME_HEIGHT);
  expect(edge.eventToFrame.p95Ms, JSON.stringify(result)).toBeLessThanOrEqual(
    MAX_EVENT_TO_FRAME_P95_MS
  );
  expect(edge.visibleToPaint.p95Ms, JSON.stringify(result)).toBeLessThanOrEqual(
    MAX_VISIBLE_TO_PAINT_P95_MS
  );
  expect(edge.visibleToPaint.p95Ms, JSON.stringify(result)).toBeLessThanOrEqual(
    center.visibleToPaint.p95Ms + 16
  );
});

const loadFreshFrame = async (page: Page) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: FRAME_HEIGHT,
          id: FRAME_ID,
          locked: false,
          name: "Edge Input Frame",
          parentId: "root",
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 0,
            y: 0,
          },
          type: "artboard",
          visible: true,
          width: FRAME_WIDTH,
        },
      ],
      version: "1.8",
    })
  );
  await page.evaluate(
    async ({ frameId, origin, zoom }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const hostRect = editor?.hostRef?.getBoundingClientRect();

      if (!(editor && hostRect)) {
        throw new Error("Expected the browser Editor viewport");
      }

      const viewport = {
        x: (hostRect.left - origin.x) / zoom,
        y: (hostRect.top - origin.y) / zoom,
        zoom,
      };

      editor.select(frameId);
      editor.setActiveTool("brush");
      editor.setBrushSettings(
        {
          color: "#111111",
          flow: 1,
          hardness: 1,
          opacity: 1,
          size: 149,
          smoothing: 0.1,
          spacing: 0,
        },
        "brush"
      );
      editor.viewerRef?.setTo?.(viewport);
      editor.setViewport(viewport);
      editor.getState().setViewport(viewport);
      editor.onViewportChange?.();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
    },
    { frameId: FRAME_ID, origin: FRAME_SCREEN_ORIGIN, zoom: ZOOM }
  );
};

const runRecordedGesture = async (page: Page, edgeExcursion: boolean) => {
  const path = await getRecordedPath(page, edgeExcursion);
  const pointerTarget = await page.evaluate((point) => {
    const element = document.elementFromPoint(point.clientX, point.clientY);

    return {
      inCanvasHost: Boolean(element?.closest(".canvas-host")),
      withinViewport:
        point.clientX >= 0 &&
        point.clientX < window.innerWidth &&
        point.clientY >= 0 &&
        point.clientY < window.innerHeight,
    };
  }, path.start);

  expect(pointerTarget, JSON.stringify(pointerTarget)).toEqual({
    inCanvasHost: true,
    withinViewport: true,
  });

  await page.mouse.move(path.start.clientX, path.start.clientY);
  await installInputProbe(page, edgeExcursion, path.start);
  await page.mouse.down();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const raster = editor?.nodes.find(
          (node) =>
            node.type === "image" && node.parentId === "edge-input-frame"
        );

        return raster?.type === "image" &&
          editor?.rasterSurface?.getPresentation?.(raster.id)
          ? 1
          : 0;
      })
    )
    .toBeGreaterThan(0);
  await page.evaluate((probeKey) => {
    const probe = Reflect.get(window, probeKey);
    const raster = probe?.editor.nodes.find(
      (node) => node.type === "image" && node.parentId === "edge-input-frame"
    );

    if (raster?.type !== "image") {
      throw new Error("Expected the trusted pointer Frame Raster");
    }

    probe.rasterId = raster.id;
  }, PROBE_KEY);

  const client = await page.context().newCDPSession(page);

  await sendTrustedPath(page, client, path.dense);
  await waitForPaintFrames(page);
  const denseBounds = await getActivePreviewBounds(page);
  await page.evaluate((probeKey) => {
    const probe = Reflect.get(window, probeKey);

    if (!probe) {
      throw new Error("Expected the Frame edge input probe");
    }

    probe.reset();
  }, PROBE_KEY);

  await sendTrustedPath(page, client, path.measured);
  await waitForVisibilityProbe(page);
  const expandedBounds = await getActivePreviewBounds(page);
  const result = await readProbeResult(page, {
    denseBounds,
    expandedBounds,
    measuredSampleCount: path.measured.length,
  });

  await page.evaluate((probeKey) => {
    const probe = Reflect.get(window, probeKey);

    if (!probe) {
      return;
    }

    window.removeEventListener("pointermove", probe.handlePointerMove, true);
    window.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        button: 0,
        buttons: 0,
        pointerId: probe.pointerId(),
        pointerType: "mouse",
      })
    );
    window.__PUNCHPRESS_PERF_SINK__ = undefined;
    Reflect.deleteProperty(window, probeKey);
  }, PROBE_KEY);
  await client.send("Input.dispatchMouseEvent", {
    button: "left",
    buttons: 0,
    pointerType: "mouse",
    type: "mouseReleased",
    x: path.measured.at(-1)?.clientX ?? path.start.clientX,
    y: path.measured.at(-1)?.clientY ?? path.start.clientY,
  });
  await client.detach();

  return result;
};

const getRecordedPath = async (page: Page, edgeExcursion: boolean) =>
  page.evaluate(
    ({ edgeExcursion: shouldCrossEdge, frameId }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const frameBounds = editor?.getNodeRenderFrame(frameId)?.bounds;
      const frameElement = document.querySelector(
        `[data-artboard-body="${frameId}"]`
      );

      if (!(editor && frameBounds && frameElement instanceof HTMLElement)) {
        throw new Error("Expected the recorded Frame input surface");
      }

      const frameRect = frameElement.getBoundingClientRect();
      const start = { x: 2250, y: 2700 };
      const dense = Array.from({ length: 180 }, (_, index) => {
        const angle = (index / 179) * Math.PI * 18;

        return {
          x: start.x + Math.sin(angle) * 1040,
          y: start.y + Math.sin(angle * 1.37 + 0.4) * 1040,
        };
      });
      dense.push(start);

      const targets = shouldCrossEdge
        ? [
            { x: -350, y: 2600 },
            { x: 2600, y: 4700 },
            { x: -350, y: 4200 },
            { x: 3150, y: 4650 },
            { x: -350, y: 3350 },
            { x: 2550, y: 3900 },
          ]
        : [
            { x: 500, y: 2600 },
            { x: 3450, y: 4700 },
            { x: 500, y: 4200 },
            { x: 4000, y: 4650 },
            { x: 500, y: 3350 },
            { x: 3400, y: 3900 },
          ];
      const measured: Array<{ x: number; y: number }> = [];
      let previous = start;

      for (const target of targets) {
        for (let step = 1; step <= 4; step += 1) {
          const progress = step / 4;

          measured.push({
            x: previous.x + (target.x - previous.x) * progress,
            y: previous.y + (target.y - previous.y) * progress,
          });
        }
        previous = target;
      }

      const toClientPoint = (point) => ({
        clientX:
          frameRect.left +
          ((point.x - frameBounds.minX) / frameBounds.width) * frameRect.width,
        clientY:
          frameRect.top +
          ((point.y - frameBounds.minY) / frameBounds.height) *
            frameRect.height,
        worldX: point.x,
        worldY: point.y,
      });

      return {
        dense: dense.map(toClientPoint),
        measured: measured.map(toClientPoint),
        start: toClientPoint(start),
      };
    },
    { edgeExcursion, frameId: FRAME_ID }
  );

const sendTrustedPath = async (page: Page, client, path) => {
  for (let index = 0; index < path.length; index += INPUT_BURST_SIZE) {
    await Promise.all(
      path.slice(index, index + INPUT_BURST_SIZE).map((point) =>
        client.send("Input.dispatchMouseEvent", {
          button: "left",
          buttons: 1,
          pointerType: "mouse",
          type: "mouseMoved",
          x: point.clientX,
          y: point.clientY,
        })
      )
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    );
  }
};

const waitForPaintFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );

const waitForVisibilityProbe = (page: Page) =>
  page.evaluate(async (probeKey) => {
    for (let frame = 0; frame < 180; frame += 1) {
      const probe = Reflect.get(window, probeKey);

      if (!probe || probe.pendingVisibilityCount() === 0) {
        return;
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
    }
  }, PROBE_KEY);

const getActivePreviewBounds = (page: Page) =>
  page.evaluate(() => {
    const raster = window.__PUNCHPRESS_EDITOR__?.nodes.find(
      (node) => node.type === "image" && node.parentId === "edge-input-frame"
    );

    return raster?.type === "image"
      ? { height: raster.height, width: raster.width }
      : null;
  });

const installInputProbe = async (
  page: Page,
  edgeExcursion: boolean,
  startPoint
) => {
  await page.evaluate(
    ({ edgeExcursion: shouldCrossEdge, frameId, probeKey, startPoint }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const brush = editor?.tools.get("brush");
      const frameBounds = editor?.getNodeRenderFrame(frameId)?.bounds;
      const frameElement = document.querySelector(
        `[data-artboard-body="${frameId}"]`
      );

      if (
        !(editor && brush && frameBounds && frameElement instanceof HTMLElement)
      ) {
        throw new Error("Expected the Frame edge input probe state");
      }

      const frameRect = frameElement.getBoundingClientRect();
      const eventToFrameMs: number[] = [];
      const pendingVisibility: Array<{
        point: { x: number; y: number };
        startedAt: number;
      }> = [];
      const reentryPoints: Array<{ x: number; y: number }> = [];
      const spans: Record<string, number[]> = {};
      const counters: Record<string, number> = {};
      const visibleToPaintMs: number[] = [];
      let expiredVisibilityCount = 0;
      let inBoundsEventCount = 0;
      let pointerId = 1;
      let deferredVisibilitySample: {
        point: { x: number; y: number };
        startedAt: number;
      } | null = null;
      let previousWorldPoint = {
        x: startPoint.worldX,
        y: startPoint.worldY,
      };
      let visibilityFrameId = 0;

      const readWorkingAlpha = (worldPoint) => {
        const activeRasterId = Reflect.get(window, probeKey)?.rasterId;
        const presentation =
          editor.rasterSurface?.getPresentation?.(activeRasterId);
        const raster = editor.getNode(activeRasterId);

        if (!(presentation && raster?.type === "image")) {
          return 0;
        }

        const delegate = brush.activeSession?.delegate;
        const localPoint = delegate?.getLocalPoint?.(worldPoint) || {
          x: worldPoint.x - raster.transform.x,
          y: worldPoint.y - raster.transform.y,
        };
        const sampleCanvas = (canvas, x, y) => {
          const context = canvas.getContext("2d");

          if (
            !context ||
            x < 0 ||
            y < 0 ||
            x >= canvas.width ||
            y >= canvas.height
          ) {
            return 0;
          }

          return context.getImageData(Math.floor(x), Math.floor(y), 1, 1)
            .data[3];
        };

        let alpha = 0;

        for (const offsetX of [-50, -25, 0, 25, 50]) {
          for (const offsetY of [-50, -25, 0, 25, 50]) {
            const point = {
              x: localPoint.x + offsetX,
              y: localPoint.y + offsetY,
            };

            alpha = Math.max(
              alpha,
              sampleCanvas(
                presentation.canvas,
                ((point.x - presentation.x) / presentation.width) *
                  presentation.canvas.width,
                ((point.y - presentation.y) / presentation.height) *
                  presentation.canvas.height
              )
            );
          }
        }

        return alpha;
      };
      const flushVisibility = () => {
        visibilityFrameId = 0;
        const now = performance.now();

        for (let index = pendingVisibility.length - 1; index >= 0; index -= 1) {
          const pending = pendingVisibility[index];

          if (readWorkingAlpha(pending.point) > 200) {
            visibleToPaintMs.push(now - pending.startedAt);
            pendingVisibility.splice(index, 1);
          } else if (now - pending.startedAt > 1000) {
            expiredVisibilityCount += 1;
            pendingVisibility.splice(index, 1);
          }
        }

        if (pendingVisibility.length > 0) {
          visibilityFrameId = requestAnimationFrame(flushVisibility);
        }
      };
      const handlePointerMove = (event: PointerEvent) => {
        const startedAt = performance.now();
        const worldPoint = {
          x:
            frameBounds.minX +
            ((event.clientX - frameRect.left) / frameRect.width) *
              frameBounds.width,
          y:
            frameBounds.minY +
            ((event.clientY - frameRect.top) / frameRect.height) *
              frameBounds.height,
        };

        pointerId = event.pointerId;
        if (
          shouldCrossEdge &&
          previousWorldPoint.x < frameBounds.minX &&
          worldPoint.x >= frameBounds.minX
        ) {
          const progress =
            (frameBounds.minX - previousWorldPoint.x) /
            (worldPoint.x - previousWorldPoint.x);

          reentryPoints.push({
            x: frameBounds.minX,
            y:
              previousWorldPoint.y +
              (worldPoint.y - previousWorldPoint.y) * progress,
          });
        }
        previousWorldPoint = worldPoint;
        if (deferredVisibilitySample) {
          inBoundsEventCount += 1;
          pendingVisibility.push(deferredVisibilitySample);
          deferredVisibilitySample = null;

          if (!visibilityFrameId) {
            visibilityFrameId = requestAnimationFrame(flushVisibility);
          }
        }
        if (
          worldPoint.x >= frameBounds.minX &&
          worldPoint.x <= frameBounds.maxX &&
          worldPoint.y >= frameBounds.minY &&
          worldPoint.y <= frameBounds.maxY
        ) {
          deferredVisibilitySample = { point: worldPoint, startedAt };
        }
        queueMicrotask(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              eventToFrameMs.push(performance.now() - startedAt);
            });
          });
        });
      };
      const reset = () => {
        for (const key of Object.keys(counters)) {
          delete counters[key];
        }
        for (const key of Object.keys(spans)) {
          delete spans[key];
        }
        eventToFrameMs.length = 0;
        pendingVisibility.length = 0;
        reentryPoints.length = 0;
        visibleToPaintMs.length = 0;
        deferredVisibilitySample = null;
        expiredVisibilityCount = 0;
        inBoundsEventCount = 0;
      };

      window.__PUNCHPRESS_PERF_SINK__ = {
        incrementCounter(name, amount = 1) {
          counters[name] = (counters[name] || 0) + amount;
        },
        recordDuration(label, durationMs) {
          spans[label] ||= [];
          spans[label].push(durationMs);
        },
      };
      window.addEventListener("pointermove", handlePointerMove, true);
      Reflect.set(window, probeKey, {
        brush,
        counters,
        editor,
        eventToFrameMs,
        expiredVisibilityCount: () => expiredVisibilityCount,
        handlePointerMove,
        inBoundsEventCount: () => inBoundsEventCount,
        pendingVisibilityCount: () => pendingVisibility.length,
        pointerId: () => pointerId,
        rasterId: null,
        readWorkingAlpha,
        reentryPoints,
        reset,
        spans,
        visibleToPaintMs,
      });
    },
    {
      edgeExcursion,
      frameId: FRAME_ID,
      probeKey: PROBE_KEY,
      startPoint,
    }
  );
};

const readProbeResult = async (
  page: Page,
  {
    denseBounds,
    expandedBounds,
    measuredSampleCount,
  }: {
    denseBounds: { height: number; width: number } | null;
    expandedBounds: { height: number; width: number } | null;
    measuredSampleCount: number;
  }
) =>
  page.evaluate(
    ({ denseBounds, expandedBounds, measuredSampleCount, probeKey }) => {
      const probe = Reflect.get(window, probeKey);

      if (!probe) {
        throw new Error("Expected completed Frame edge input probe");
      }

      const summarize = (values: number[]) => {
        const sorted = [...values].sort((left, right) => left - right);
        const percentile = (ratio: number) =>
          sorted[
            Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))
          ] || 0;

        return {
          maxMs: sorted.at(-1) || 0,
          meanMs:
            values.length > 0
              ? values.reduce((total, value) => total + value, 0) /
                values.length
              : 0,
          p50Ms: percentile(0.5),
          p95Ms: percentile(0.95),
        };
      };
      return {
        appliedSegmentCount:
          (probe.counters["brush.nativeStroke.segment"] || 0) +
          (probe.counters["brush.tile.nativeStroke.segment"] || 0),
        denseBounds,
        eventToFrame: summarize(probe.eventToFrameMs),
        expandedBounds,
        expiredVisibilityCount: probe.expiredVisibilityCount(),
        inBoundsEventCount: probe.inBoundsEventCount(),
        measuredSampleCount,
        pendingVisibilityCount: probe.pendingVisibilityCount(),
        reentryAlpha: probe.reentryPoints.map(probe.readWorkingAlpha),
        reentryCount: probe.reentryPoints.length,
        spanSummary: Object.fromEntries(
          Object.entries(probe.spans).map(([label, durations]) => [
            label,
            summarize(durations as number[]),
          ])
        ),
        visibleSampleCount: probe.visibleToPaintMs.length,
        visibleToPaint: summarize(probe.visibleToPaintMs),
      };
    },
    {
      denseBounds,
      expandedBounds,
      measuredSampleCount,
      probeKey: PROBE_KEY,
    }
  );
