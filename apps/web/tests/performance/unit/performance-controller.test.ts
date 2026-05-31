import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { PerformanceController } from "../../../src/performance/performance-controller";

const benchmark = {
  defaultOptions: {
    frames: 1,
    nodeCount: 0,
    stepX: 0,
    stepY: 0,
    warmupFrames: 0,
  },
  description: "Test benchmark",
  id: "test-benchmark",
  label: "Test Benchmark",
  run: async () => undefined,
};

const createWindowStub = () => {
  let nextAnimationFrameId = 1;

  return {
    cancelAnimationFrame: () => undefined,
    clearInterval,
    clearTimeout,
    devicePixelRatio: 1,
    requestAnimationFrame: () => nextAnimationFrameId++,
    setInterval,
    setTimeout,
  } as unknown as Window & typeof globalThis;
};

describe("PerformanceController", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalPerformanceObserver = globalThis.PerformanceObserver;

  beforeEach(() => {
    globalThis.window = createWindowStub();
    globalThis.document = {
      hasFocus: () => true,
      visibilityState: "visible",
    } as Document;
    globalThis.PerformanceObserver = undefined as typeof PerformanceObserver;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.PerformanceObserver = originalPerformanceObserver;
  });

  it("clears pending work before the next capture session starts", () => {
    const controller = new PerformanceController();

    controller.recordDuration("stale", 5);
    controller.incrementCounter("stale-counter", 2);
    controller.previousTimestamp = 100;

    controller.stop();
    controller.start();
    controller.handleAnimationFrame(200);
    controller.recordDuration("fresh", 3);
    controller.incrementCounter("fresh-counter", 1);
    controller.handleAnimationFrame(216.7);

    expect(controller.getLiveFramesSnapshot()).toEqual([
      {
        buckets: {
          fresh: 3,
        },
        counters: {
          "fresh-counter": 1,
        },
        durationMs: 16.699_999_999_999_99,
        id: 0,
        timestamp: 216.7,
      },
    ]);
  });

  it("stores flame spans on the next captured frame", () => {
    const controller = new PerformanceController();

    controller.retainFlameSpans = true;
    controller.previousTimestamp = 100;
    controller.recordSpan({
      depth: 0,
      durationMs: 4,
      endMs: 112,
      label: "selection.select.apply",
      startMs: 108,
    });
    controller.handleAnimationFrame(116);

    expect(controller.getLiveFramesSnapshot()).toMatchObject([
      {
        buckets: {
          "selection.select.apply": 4,
        },
        spans: [
          {
            depth: 0,
            durationMs: 4,
            frameId: 0,
            label: "selection.select.apply",
          },
        ],
      },
    ]);
  });

  it("clips collected flame spans into overlapping result frames", () => {
    const controller = new PerformanceController();

    controller.retainFlameSpans = true;
    controller.beginCollection(benchmark, benchmark.defaultOptions);
    controller.activeCollection?.frames.push(
      {
        buckets: {},
        counters: {},
        durationMs: 10,
        id: 1,
        timestamp: 110,
      },
      {
        buckets: {},
        counters: {},
        durationMs: 10,
        id: 2,
        timestamp: 120,
      }
    );
    controller.recordSpan({
      depth: 0,
      durationMs: 20,
      endMs: 125,
      label: "render.canvas.react",
      startMs: 105,
    });

    const result = controller.finishCollection();

    expect(result?.frames[0]?.spans).toEqual([
      {
        depth: 0,
        durationMs: 5,
        endMs: 110,
        frameId: 1,
        label: "render.canvas.react",
        startMs: 105,
      },
    ]);
    expect(result?.frames[1]?.spans).toEqual([
      {
        depth: 0,
        durationMs: 10,
        endMs: 120,
        frameId: 2,
        label: "render.canvas.react",
        startMs: 110,
      },
    ]);
  });
});
