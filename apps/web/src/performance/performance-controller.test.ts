import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { PerformanceController } from "./performance-controller";

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
});
