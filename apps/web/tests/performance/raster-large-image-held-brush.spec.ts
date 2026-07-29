import { expect, type Page, test } from "@playwright/test";
import { gotoEditor, loadDocument, setViewport } from "../e2e/helpers/editor";

const IMAGE_EDGE = 5000;
const STROKE_UPDATES = 360;
const UPDATE_BUDGET_MS = 8;
const EDGE_TRANSITION_BUDGET_MS = 32;

const loadLargeRaster = async (page: Page) => {
  await gotoEditor(page);
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = 1;
    canvas.height = 1;
    context?.fillRect(0, 0, 1, 1);

    return canvas.toDataURL("image/png");
  });

  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          assetId: "large-raster-asset",
          height: IMAGE_EDGE,
          id: "large-raster",
          mimeType: "image/png",
          name: "Large Raster",
          opacity: 1,
          parentId: "root",
          src,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 0,
            y: 0,
          },
          type: "image",
          visible: true,
          width: IMAGE_EDGE,
        },
      ],
      version: "1.8",
    })
  );
  await setViewport(page, {
    x: 0,
    y: 0,
    zoom: 0.15,
  });
};

test("a sustained Hard Round stroke stays responsive on a 5000px Raster", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await loadLargeRaster(page);

  const result = await page.evaluate(
    async ({ imageEdge, strokeUpdates }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const brush = editor?.tools.get("brush");

      if (!(editor && brush)) {
        throw new Error("Expected the browser Editor brush");
      }

      editor.select("large-raster");
      editor.setActiveTool("brush");
      editor.setBrushSettings(
        {
          hardness: 1,
          opacity: 1,
          size: 106,
          smoothing: 0.1,
          spacing: 0,
        },
        "brush"
      );

      const center = imageEdge / 2;
      const getPoint = (index: number) => {
        const progress = index / strokeUpdates;
        const radius = 80 + progress * (imageEdge * 0.42);
        const angle = progress * Math.PI * 28;

        return {
          x: center + Math.cos(angle) * radius,
          y: center + Math.sin(angle) * radius,
        };
      };
      const session = brush.beginStroke({ point: getPoint(0) });

      if (!session) {
        throw new Error("Expected a large Raster brush session");
      }

      await session.delegate?.ready;
      const updateDurations: number[] = [];

      try {
        for (let index = 1; index <= strokeUpdates; index += 1) {
          const startedAt = performance.now();

          session.update({ point: getPoint(index) });
          updateDurations.push(performance.now() - startedAt);
        }
      } finally {
        session.cancel();
      }

      const sorted = [...updateDurations].sort((left, right) => left - right);
      const percentile = (value: number) => {
        const index = Math.min(
          sorted.length - 1,
          Math.floor((sorted.length - 1) * value)
        );

        return sorted[index] || 0;
      };
      const windowSize = 60;
      const windowMeans = Array.from(
        { length: updateDurations.length / windowSize },
        (_, windowIndex) => {
          const durations = updateDurations.slice(
            windowIndex * windowSize,
            (windowIndex + 1) * windowSize
          );

          return (
            durations.reduce((total, duration) => total + duration, 0) /
            durations.length
          );
        }
      );

      return {
        maxUpdateMs: sorted.at(-1) || 0,
        p50UpdateMs: percentile(0.5),
        p95UpdateMs: percentile(0.95),
        windowMeans,
      };
    },
    {
      imageEdge: IMAGE_EDGE,
      strokeUpdates: STROKE_UPDATES,
    }
  );

  await testInfo.attach("large-raster-held-brush-timing", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  console.log(`large-raster-held-brush ${JSON.stringify(result)}`);

  expect(result.p95UpdateMs, JSON.stringify(result)).toBeLessThanOrEqual(
    UPDATE_BUDGET_MS
  );
  expect(result.windowMeans.at(-1), JSON.stringify(result)).toBeLessThanOrEqual(
    UPDATE_BUDGET_MS
  );
});

test("touching the Raster edge does not permanently slow the held stroke", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await loadLargeRaster(page);

  const result = await page.evaluate(
    async ({ imageEdge }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const brush = editor?.tools.get("brush");

      if (!(editor && brush)) {
        throw new Error("Expected the browser Editor brush");
      }

      editor.select("large-raster");
      editor.setActiveTool("brush");
      editor.setBrushSettings(
        {
          hardness: 1,
          opacity: 1,
          size: 106,
          smoothing: 0.1,
          spacing: 0,
        },
        "brush"
      );

      const center = imageEdge / 2;
      const session = brush.beginStroke({
        point: { x: center - 400, y: center },
      });

      if (!session) {
        throw new Error("Expected a large Raster brush session");
      }

      await session.delegate?.ready;

      try {
        for (let index = 1; index <= 20; index += 1) {
          session.update({
            point: {
              x: center - 400 + index * 40,
              y: center + Math.sin(index / 2) * 300,
            },
          });
        }

        const edgeStartedAt = performance.now();

        session.update({ point: { x: -200, y: center } });
        const edgeUpdateMs = performance.now() - edgeStartedAt;
        const reentryStartedAt = performance.now();

        session.update({ point: { x: center, y: center } });
        const reentryUpdateMs = performance.now() - reentryStartedAt;

        const updateDurations: number[] = [];
        const updates = 120;

        for (let index = 1; index <= updates; index += 1) {
          const angle = (index / updates) * Math.PI * 10;
          const startedAt = performance.now();

          session.update({
            point: {
              x: center + Math.cos(angle) * 900,
              y: center + Math.sin(angle) * 900,
            },
          });
          updateDurations.push(performance.now() - startedAt);
        }

        const sorted = [...updateDurations].sort((left, right) => left - right);
        const p95Index = Math.floor((sorted.length - 1) * 0.95);

        return {
          edgeUpdateMs,
          maxUpdateMs: sorted.at(-1) || 0,
          meanUpdateMs:
            updateDurations.reduce((total, duration) => total + duration, 0) /
            updateDurations.length,
          p95UpdateMs: sorted[p95Index] || 0,
          reentryUpdateMs,
        };
      } finally {
        session.cancel();
      }
    },
    { imageEdge: IMAGE_EDGE }
  );

  await testInfo.attach("large-raster-edge-reentry-timing", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  console.log(`large-raster-edge-reentry ${JSON.stringify(result)}`);

  expect(result.p95UpdateMs, JSON.stringify(result)).toBeLessThanOrEqual(
    UPDATE_BUDGET_MS
  );
  expect(result.meanUpdateMs, JSON.stringify(result)).toBeLessThanOrEqual(
    UPDATE_BUDGET_MS
  );
  expect(result.edgeUpdateMs, JSON.stringify(result)).toBeLessThanOrEqual(
    EDGE_TRANSITION_BUDGET_MS
  );
  expect(result.reentryUpdateMs, JSON.stringify(result)).toBeLessThanOrEqual(
    EDGE_TRANSITION_BUDGET_MS
  );
});

test("a long edge-crossing update does bounded work on a 5000px Raster", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await loadLargeRaster(page);

  const result = await page.evaluate(
    async ({ imageEdge }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const brush = editor?.tools.get("brush");

      if (!(editor && brush)) {
        throw new Error("Expected the browser Editor brush");
      }

      editor.select("large-raster");
      editor.setActiveTool("brush");
      editor.setBrushSettings(
        {
          color: "#ff0000",
          hardness: 1,
          opacity: 1,
          size: 106,
          smoothing: 0.1,
          spacing: 0,
        },
        "brush"
      );

      const session = brush.beginStroke({
        point: { x: imageEdge - 200, y: imageEdge - 200 },
      });

      if (!session) {
        throw new Error("Expected a large Raster brush session");
      }

      await session.delegate?.ready;

      try {
        const spans: Record<string, number[]> = {};
        const counters: Record<string, number> = {};

        window.__PUNCHPRESS_PERF_SINK__ = {
          incrementCounter(name, amount = 1) {
            counters[name] = (counters[name] || 0) + amount;
          },
          recordDuration(label, durationMs) {
            spans[label] ||= [];
            spans[label].push(durationMs);
          },
        };
        const startedAt = performance.now();

        session.update({ point: { x: -1_000_000, y: -1_000_000 } });
        const workingSurface = session.delegate?.getWorkingSurfaceState?.();
        const center = imageEdge / 2;
        const centerRed =
          workingSurface?.type === "tiles"
            ? Math.max(
                0,
                ...workingSurface.tiles
                  .filter(
                    (tile) =>
                      center >= tile.x &&
                      center < tile.x + tile.width &&
                      center >= tile.y &&
                      center < tile.y + tile.height
                  )
                  .map((tile) => {
                    const context = tile.canvas.getContext("2d");

                    return (
                      context?.getImageData(
                        Math.floor(center - tile.x),
                        Math.floor(center - tile.y),
                        1,
                        1
                      ).data[0] || 0
                    );
                  })
              )
            : 0;

        return {
          centerRed,
          counters,
          edgeUpdateMs: performance.now() - startedAt,
          spans,
        };
      } finally {
        window.__PUNCHPRESS_PERF_SINK__ = undefined;
        session.cancel();
      }
    },
    { imageEdge: IMAGE_EDGE }
  );

  await testInfo.attach("large-raster-long-edge-crossing-timing", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  console.log(`large-raster-long-edge-crossing ${JSON.stringify(result)}`);

  expect(result.edgeUpdateMs, JSON.stringify(result)).toBeLessThanOrEqual(
    UPDATE_BUDGET_MS
  );
  expect(result.centerRed, JSON.stringify(result)).toBeGreaterThan(200);
});

test("the canvas placement boundary retains coalesced brush samples", async ({
  page,
}) => {
  await gotoEditor(page);

  const result = await page.evaluate(async () => {
    const { startCanvasToolPlacementSession } = await import(
      "/src/components/canvas/canvas-tool-placement-session.ts"
    );
    const target = document.createElement("div");
    const updates: Array<{ x: number; y: number }> = [];
    let completed = false;

    document.body.append(target);
    target.addEventListener(
      "mousedown",
      (event) => {
        startCanvasToolPlacementSession({
          editor: {
            getState: () => ({ spacePressed: false }),
            notifyPlacementSurfaceApplied: () => false,
          },
          event,
          getCanvasPoint: (x: number, y: number) => ({ x, y }),
          session: {
            cancel: () => false,
            complete: () => {
              completed = true;
            },
            preservePointerSamples: true,
            update: ({ point }) => updates.push(point),
          },
        });
      },
      { once: true }
    );
    target.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: 0,
        clientY: 0,
      })
    );

    const moveEvent = new MouseEvent("mousemove", {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 6,
      clientY: 8,
    });
    Object.defineProperty(moveEvent, "getCoalescedEvents", {
      value: () => [
        new MouseEvent("mousemove", { clientX: 1, clientY: 2 }),
        new MouseEvent("mousemove", { clientX: 3, clientY: 5 }),
        new MouseEvent("mousemove", { clientX: 6, clientY: 8 }),
      ],
    });
    window.dispatchEvent(moveEvent);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    window.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: 6,
        clientY: 8,
      })
    );
    target.remove();

    return { completed, updates };
  });

  expect(result).toEqual({
    completed: true,
    updates: [
      { x: 1, y: 2 },
      { x: 3, y: 5 },
      { x: 6, y: 8 },
    ],
  });
});
