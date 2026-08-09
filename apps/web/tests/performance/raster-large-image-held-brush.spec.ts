import { expect, type Page, test } from "@playwright/test";
import { gotoEditor, loadDocument, setViewport } from "../e2e/helpers/editor";

const IMAGE_EDGE = 5000;
const FRAME_HEIGHT = 5400;
const FRAME_WIDTH = 4500;
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
  const sessionKey = "__PUNCHPRESS_SUSTAINED_RASTER_SESSION__";

  await page.evaluate(
    async ({ imageEdge, sessionKey, strokeUpdates }) => {
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

      const state = {
        applyDabsMs: 0,
        currentDabCount: 0,
        session: null as ReturnType<typeof brush.beginStroke>,
        totalDabCount: 0,
      };

      window.__PUNCHPRESS_PERF_SINK__ = {
        incrementCounter: (name, amount = 1) => {
          if (name === "raster.stroke.dabs") {
            state.currentDabCount += amount;
            state.totalDabCount += amount;
          }
        },
        recordDuration: (label, durationMs) => {
          if (label === "raster.stroke.applyDabs") {
            state.applyDabsMs += durationMs;
          }
        },
      };
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

      state.session = session;
      Reflect.set(window, sessionKey, state);
      await session.delegate?.ready;
    },
    { imageEdge: IMAGE_EDGE, sessionKey, strokeUpdates: STROKE_UPDATES }
  );
  const updateSamples: {
    applyDabsMs: number;
    dabCount: number;
    index: number;
    updateMs: number;
  }[] = [];
  const updatesPerFrame = 24;
  let totalDabCount = 0;

  try {
    for (
      let firstIndex = 1;
      firstIndex <= STROKE_UPDATES;
      firstIndex += updatesPerFrame
    ) {
      const chunk = await page.evaluate(
        async ({
          firstIndex,
          imageEdge,
          sessionKey,
          strokeUpdates,
          updatesPerFrame,
        }) => {
          const state = Reflect.get(window, sessionKey) as {
            applyDabsMs: number;
            currentDabCount: number;
            session: {
              update: (input: { point: { x: number; y: number } }) => void;
            };
          };
          const center = imageEdge / 2;
          const samples: {
            applyDabsMs: number;
            dabCount: number;
            index: number;
            updateMs: number;
          }[] = [];
          const lastIndex = Math.min(
            strokeUpdates,
            firstIndex + updatesPerFrame - 1
          );

          for (let index = firstIndex; index <= lastIndex; index += 1) {
            const progress = index / strokeUpdates;
            const radius = 80 + progress * (imageEdge * 0.42);
            const angle = progress * Math.PI * 28;
            const point = {
              x: center + Math.cos(angle) * radius,
              y: center + Math.sin(angle) * radius,
            };

            state.applyDabsMs = 0;
            state.currentDabCount = 0;
            const startedAt = performance.now();

            state.session.update({ point });
            samples.push({
              applyDabsMs: state.applyDabsMs,
              dabCount: state.currentDabCount,
              index,
              updateMs: performance.now() - startedAt,
            });
          }

          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve())
          );
          return samples;
        },
        {
          firstIndex,
          imageEdge: IMAGE_EDGE,
          sessionKey,
          strokeUpdates: STROKE_UPDATES,
          updatesPerFrame,
        }
      );

      updateSamples.push(...chunk);
    }
  } finally {
    totalDabCount = await page.evaluate((activeSessionKey) => {
      const state = Reflect.get(window, activeSessionKey) as
        | { session: { cancel: () => void }; totalDabCount: number }
        | undefined;

      state?.session.cancel();
      window.__PUNCHPRESS_PERF_SINK__ = undefined;
      Reflect.deleteProperty(window, activeSessionKey);
      return state?.totalDabCount ?? 0;
    }, sessionKey);
  }
  const sorted = [...updateSamples].sort(
    (left, right) => left.updateMs - right.updateMs
  );
  const percentile = (value: number) => {
    const index = Math.min(
      sorted.length - 1,
      Math.floor((sorted.length - 1) * value)
    );

    return sorted[index]?.updateMs ?? 0;
  };
  const windowSize = 60;
  const windowMeans = Array.from(
    { length: updateSamples.length / windowSize },
    (_, windowIndex) => {
      const samples = updateSamples.slice(
        windowIndex * windowSize,
        (windowIndex + 1) * windowSize
      );

      return (
        samples.reduce((total, sample) => total + sample.updateMs, 0) /
        samples.length
      );
    }
  );
  const result = {
    dabCount: totalDabCount,
    maxUpdateMs: sorted.at(-1)?.updateMs ?? 0,
    p50UpdateMs: percentile(0.5),
    p95UpdateMs: percentile(0.95),
    slowestUpdates: sorted.slice(-20).reverse(),
    windowMeans,
  };

  await testInfo.attach("large-raster-held-brush-timing", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  console.log(`large-raster-held-brush ${JSON.stringify(result)}`);

  expect(updateSamples).toHaveLength(STROKE_UPDATES);
  expect(result.dabCount, JSON.stringify(result)).toBeGreaterThanOrEqual(
    99_000
  );
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
        const presentation =
          editor.rasterSurface?.getPresentation?.("large-raster");
        const center = imageEdge / 2;
        const context = presentation?.canvas.getContext("2d");
        const centerRed = presentation
          ? context?.getImageData(
              Math.floor(
                ((center - presentation.x) / presentation.width) *
                  presentation.canvas.width
              ),
              Math.floor(
                ((center - presentation.y) / presentation.height) *
                  presentation.canvas.height
              ),
              1,
              1
            ).data[0] || 0
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
    EDGE_TRANSITION_BUDGET_MS
  );
  expect(result.centerRed, JSON.stringify(result)).toBeGreaterThan(200);
});

test("leaving a large Frame keeps its held Raster stroke responsive and stationary", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: FRAME_HEIGHT,
          id: "large-frame",
          locked: false,
          name: "Large Frame",
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
  await setViewport(page, {
    x: 0,
    y: 0,
    zoom: 0.12,
  });

  const result = await page.evaluate(
    async ({ frameHeight, frameWidth }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const brush = editor?.tools.get("brush");

      if (!(editor && brush)) {
        throw new Error("Expected the browser Editor brush");
      }

      editor.select("large-frame");
      editor.setActiveTool("brush");
      editor.setBrushSettings(
        {
          hardness: 1,
          opacity: 1,
          size: 151,
          smoothing: 0.1,
          spacing: 0,
        },
        "brush"
      );

      const center = { x: frameWidth / 2, y: frameHeight / 2 };
      const first = brush.beginStroke({ point: center });

      if (!first) {
        throw new Error("Expected the first Frame stroke");
      }

      for (let index = 1; index <= 80; index += 1) {
        const angle = (index / 80) * Math.PI * 10;

        first.update({
          point: {
            x: center.x + Math.cos(angle) * 700,
            y: center.y + Math.sin(angle) * 700,
          },
        });
      }
      const firstCommitStartedAt = performance.now();

      await first.complete({ point: center });
      const firstCommitMs = performance.now() - firstCommitStartedAt;

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const raster = editor.nodes.find(
        (node) => node.type === "image" && node.parentId === "large-frame"
      );

      if (raster?.type !== "image") {
        throw new Error("Expected the Frame Raster");
      }

      const frameElement = document.querySelector(
        '[data-artboard-body="large-frame"]'
      );
      const rasterElement = document.querySelector(
        `[data-node-id="${raster.id}"]`
      )?.parentElement;

      if (!(frameElement instanceof HTMLElement && rasterElement)) {
        throw new Error("Expected Frame and Raster presentation elements");
      }

      const readPresentation = () => {
        const frameRect = frameElement.getBoundingClientRect();
        const rasterRect = rasterElement.getBoundingClientRect();

        return {
          frameX: frameRect.x,
          frameY: frameRect.y,
          rasterHeight: rasterRect.height,
          rasterWidth: rasterRect.width,
          rasterX: rasterRect.x,
          rasterY: rasterRect.y,
        };
      };
      const before = readPresentation();
      const followupStartedAt = performance.now();
      const second = brush.beginStroke({
        point: { x: 700, y: center.y },
      });

      if (!second) {
        throw new Error("Expected the second Frame stroke");
      }

      await second.ready;
      const followupReadyMs = performance.now() - followupStartedAt;

      for (let index = 1; index <= 40; index += 1) {
        second.update({
          point: {
            x: 700 - index * 40,
            y: center.y + Math.sin(index / 3) * 500,
          },
        });
      }
      const edgeStartedAt = performance.now();

      second.update({ point: { x: -900, y: center.y } });
      const edgeUpdateMs = performance.now() - edgeStartedAt;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      const edgePaintMs = performance.now() - edgeStartedAt;
      const during = readPresentation();
      const updateDurations: number[] = [];

      for (let index = 1; index <= 120; index += 1) {
        const angle = (index / 120) * Math.PI * 8;
        const startedAt = performance.now();

        second.update({
          point: {
            x: center.x + Math.cos(angle) * 900,
            y: center.y + Math.sin(angle) * 900,
          },
        });
        updateDurations.push(performance.now() - startedAt);
      }

      second.cancel();
      const sorted = [...updateDurations].sort((left, right) => left - right);

      return {
        before,
        during,
        edgePaintMs,
        edgeUpdateMs,
        firstCommitMs,
        followupReadyMs,
        maxUpdateMs: sorted.at(-1) || 0,
        meanUpdateMs:
          updateDurations.reduce((total, duration) => total + duration, 0) /
          updateDurations.length,
        p95UpdateMs: sorted[Math.floor((sorted.length - 1) * 0.95)] || 0,
      };
    },
    { frameHeight: FRAME_HEIGHT, frameWidth: FRAME_WIDTH }
  );

  await testInfo.attach("large-frame-edge-excursion-timing", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  console.log(`large-frame-edge-excursion ${JSON.stringify(result)}`);

  expect(result.edgeUpdateMs, JSON.stringify(result)).toBeLessThanOrEqual(
    EDGE_TRANSITION_BUDGET_MS
  );
  expect(result.edgePaintMs, JSON.stringify(result)).toBeLessThanOrEqual(64);
  expect(result.firstCommitMs, JSON.stringify(result)).toBeLessThanOrEqual(96);
  expect(result.followupReadyMs, JSON.stringify(result)).toBeLessThanOrEqual(
    64
  );
  expect(result.p95UpdateMs, JSON.stringify(result)).toBeLessThanOrEqual(
    UPDATE_BUDGET_MS
  );
  expect(result.during, JSON.stringify(result)).toEqual(result.before);
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
