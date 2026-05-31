import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { gotoEditor } from "../e2e/helpers/editor";

const artifactDirectory = path.join(process.cwd(), ".context", "performance");
const resultArtifactPath = path.join(
  artifactDirectory,
  "large-svg-held-drag-result.json"
);
const snapshotArtifactPath = path.join(
  artifactDirectory,
  "large-svg-held-drag-snapshot.json"
);

const dragDurationMs = 2400;
const dragSteps = 120;

const dragMouseOverTime = async (
  page,
  start: { x: number; y: number },
  end: { x: number; y: number },
  steps: number,
  durationMs: number
) => {
  const delayMs = durationMs / Math.max(1, steps);

  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;

    await page.mouse.move(
      start.x + (end.x - start.x) * progress,
      start.y + (end.y - start.y) * progress
    );
    await page.waitForTimeout(delayMs);
  }
};

const summarizeFrames = (durations: number[]) => {
  const sorted = [...durations].sort((left, right) => left - right);
  const percentile = (value: number) => {
    const index = Math.min(
      sorted.length - 1,
      Math.floor((sorted.length - 1) * value)
    );

    return sorted[index] || 0;
  };
  const total = sorted.reduce((sum, duration) => sum + duration, 0);
  const average = sorted.length > 0 ? total / sorted.length : 0;

  return {
    averageFrameMs: average,
    fps: average > 0 ? 1000 / average : 0,
    maxFrameMs: sorted.at(-1) || 0,
    p50FrameMs: percentile(0.5),
    p95FrameMs: percentile(0.95),
    slowFrameCount: sorted.filter((duration) => duration > 16.7).length,
  };
};

const summarizeSpanSamples = (
  samples: Record<string, number[] | undefined>
) => {
  return Object.entries(samples)
    .map(([label, durations = []]) => {
      const sorted = [...durations].sort((left, right) => left - right);
      const p95Index = Math.min(
        sorted.length - 1,
        Math.floor((sorted.length - 1) * 0.95)
      );

      return {
        count: sorted.length,
        label,
        maxMs: sorted.at(-1) || 0,
        p95Ms: sorted[p95Index] || 0,
        totalMs: sorted.reduce((sum, duration) => sum + duration, 0),
      };
    })
    .sort((left, right) => right.totalMs - left.totalMs);
};

const formatSummary = (summary: ReturnType<typeof summarizeFrames>) => {
  return [
    `fps=${Math.round(summary.fps)}`,
    `p50=${summary.p50FrameMs.toFixed(1)}ms`,
    `p95=${summary.p95FrameMs.toFixed(1)}ms`,
    `max=${summary.maxFrameMs.toFixed(1)}ms`,
    `slow=${summary.slowFrameCount}`,
  ].join(" ");
};

const loadLargeSvg = (page) => {
  return page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return null;
    }

    const response = await fetch("/performance/large-svg.svg");
    const svg = await response.text();
    const module = await import("/src/platform/svg-import-document.ts");
    const nodes = await module.importSvgToNodes(svg, {
      targetCenter: { x: 2250, y: 2700 },
    });

    editor.insertNodes(nodes);
    const rootId = nodes[0]?.id || null;
    const rootBounds = rootId
      ? editor.getNodeRenderFrame(rootId)?.bounds
      : null;
    const hostRect = editor.hostRef?.getBoundingClientRect?.();
    const zoom = 0.12;
    const viewport =
      rootBounds && hostRect
        ? {
            x:
              rootBounds.minX +
              rootBounds.width / 2 -
              (hostRect.width * 0.62) / zoom,
            y:
              rootBounds.minY +
              rootBounds.height / 2 -
              (hostRect.height * 0.48) / zoom,
            zoom,
          }
        : { x: 550, y: 1000, zoom };

    editor.setViewport(viewport);
    editor.viewerRef?.setTo?.(viewport);
    editor.onViewportChange?.();

    return {
      rootId,
      totalNodes: editor.nodes.length,
    };
  });
};

const getCanvasNodeDragPoint = (page, nodeId: string) => {
  return page.evaluate((targetNodeId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const host = editor?.hostRef;
    const rect = host?.getBoundingClientRect?.();

    if (!(editor && rect)) {
      return null;
    }

    const candidates = [
      { x: 0.5, y: 0.5 },
      { x: 0.58, y: 0.48 },
      { x: 0.62, y: 0.55 },
      { x: 0.7, y: 0.45 },
      { x: 0.45, y: 0.58 },
    ];

    for (const candidate of candidates) {
      const point = {
        x: rect.left + rect.width * candidate.x,
        y: rect.top + rect.height * candidate.y,
      };
      const element = document.elementFromPoint(point.x, point.y);
      const canvasNode = element?.closest?.(".canvas-node");

      if (canvasNode instanceof HTMLElement) {
        return point;
      }
    }

    const targetElements = [
      document.querySelector(`.canvas-node[data-node-id="${targetNodeId}"]`),
      ...document.querySelectorAll(".canvas-node"),
    ].filter((element): element is Element => Boolean(element));

    for (const targetElement of targetElements) {
      const targetRect = targetElement.getBoundingClientRect?.();

      if (!targetRect) {
        continue;
      }

      const safeBounds = {
        bottom: rect.bottom - 180,
        left: rect.left + 460,
        right: rect.right - 260,
        top: rect.top + 160,
      };
      const intersection = {
        bottom: Math.min(targetRect.bottom, safeBounds.bottom),
        left: Math.max(targetRect.left, safeBounds.left),
        right: Math.min(targetRect.right, safeBounds.right),
        top: Math.max(targetRect.top, safeBounds.top),
      };

      if (
        intersection.left <= intersection.right &&
        intersection.top <= intersection.bottom
      ) {
        return {
          x: (intersection.left + intersection.right) / 2,
          y: (intersection.top + intersection.bottom) / 2,
        };
      }
    }

    return {
      x: rect.left + rect.width * 0.64,
      y: rect.top + rect.height * 0.48,
    };
  }, nodeId);
};

const getPointTargetInfo = (page, point: { x: number; y: number }) => {
  return page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);

    return {
      className:
        element instanceof HTMLElement ? element.className.toString() : "",
      nodeId:
        element instanceof HTMLElement ? element.dataset.nodeId || null : null,
      tagName: element?.tagName || null,
      text:
        element instanceof HTMLElement
          ? element.textContent?.trim().slice(0, 80) || ""
          : "",
    };
  }, point);
};

const startFrameCapture = async (page) => {
  await page.evaluate(async () => {
    window.__PUNCHPRESS_HELD_DRAG_CAPTURE__ = {
      counters: {},
      durations: [],
      frameId: 0,
      previousTimestamp: 0,
      running: true,
      spans: {},
      storeChanges: {},
      storeUnsubscribe: null,
    };
    const editor = window.__PUNCHPRESS_EDITOR__;
    const capture = window.__PUNCHPRESS_HELD_DRAG_CAPTURE__;

    if (editor?.store && capture) {
      capture.storeUnsubscribe = editor.store.subscribe((state, previous) => {
        for (const key of Object.keys(state)) {
          if (state[key] !== previous[key]) {
            capture.storeChanges[key] = (capture.storeChanges[key] || 0) + 1;
          }
        }
      });
    }
    window.__PUNCHPRESS_PERF_SINK__ = {
      incrementCounter: (name, amount = 1) => {
        const capture = window.__PUNCHPRESS_HELD_DRAG_CAPTURE__;

        if (!capture) {
          return;
        }

        capture.counters[name] = (capture.counters[name] || 0) + amount;
      },
      recordDuration: (label, durationMs) => {
        const capture = window.__PUNCHPRESS_HELD_DRAG_CAPTURE__;

        if (!capture) {
          return;
        }

        capture.spans[label] ||= [];
        capture.spans[label].push(durationMs);
      },
    };

    const captureFrame = (timestamp) => {
      const capture = window.__PUNCHPRESS_HELD_DRAG_CAPTURE__;

      if (!capture?.running) {
        return;
      }

      if (capture.previousTimestamp > 0) {
        capture.durations.push(timestamp - capture.previousTimestamp);
      }

      capture.previousTimestamp = timestamp;
      capture.frameId = window.requestAnimationFrame(captureFrame);
    };

    window.__PUNCHPRESS_HELD_DRAG_CAPTURE__.frameId =
      window.requestAnimationFrame(captureFrame);

    await new Promise((resolve) => {
      window.requestAnimationFrame(resolve);
    });
  });
};

const stopFrameCapture = (page) => {
  return page.evaluate(() => {
    const capture = window.__PUNCHPRESS_HELD_DRAG_CAPTURE__;

    if (!capture) {
      return {
        counters: {},
        durations: [],
        spans: {},
      };
    }

    capture.running = false;
    window.cancelAnimationFrame(capture.frameId);
    capture.storeUnsubscribe?.();
    window.__PUNCHPRESS_PERF_SINK__ = undefined;

    return {
      counters: capture.counters || {},
      durations: capture.durations,
      spans: capture.spans || {},
      storeChanges: capture.storeChanges || {},
    };
  });
};

test.describe.configure({ mode: "serial" });

test("large SVG held drag uses real mouse timing", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await gotoEditor(page);

  const loaded = await loadLargeSvg(page);

  expect(loaded?.rootId).toBeTruthy();

  await page.waitForTimeout(1000);

  const center = await getCanvasNodeDragPoint(page, loaded.rootId);

  expect(center).not.toBeNull();

  const targetInfo = await getPointTargetInfo(page, center);

  await startFrameCapture(page);
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await dragMouseOverTime(
    page,
    center,
    { x: center.x + 360, y: center.y + 180 },
    dragSteps,
    dragDurationMs
  );
  await page.mouse.up();

  const capture = await stopFrameCapture(page);
  const durations = capture.durations;
  const summary = summarizeFrames(durations);
  const spans = summarizeSpanSamples(capture.spans);
  const result = {
    benchmarkId: "large-svg-held-drag",
    counters: capture.counters,
    dragDurationMs,
    dragSteps,
    nodeStats: loaded,
    spans,
    storeChanges: capture.storeChanges,
    summary,
    targetInfo,
  };

  mkdirSync(artifactDirectory, { recursive: true });
  writeFileSync(resultArtifactPath, JSON.stringify(result, null, 2));
  writeFileSync(
    snapshotArtifactPath,
    JSON.stringify({ durations, result }, null, 2)
  );

  const summaryLine = `large-svg-held-drag: ${formatSummary(summary)} total=${loaded?.totalNodes || 0}`;
  console.log(summaryLine);

  await testInfo.attach("large-svg-held-drag-result", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("large-svg-held-drag-summary", {
    body: summaryLine,
    contentType: "text/plain",
  });
});
