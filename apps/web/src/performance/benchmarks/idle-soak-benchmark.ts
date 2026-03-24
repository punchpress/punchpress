import type { PerformanceBenchmarkDefinition } from "../performance-benchmark-types";

export const IDLE_SOAK_2MIN_DURATION_MS = 120_000;

export const idleSoakBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 0,
    nodeCount: 0,
    stepX: 0,
    stepY: 0,
    warmupFrames: 0,
  },
  description:
    "Leaves the live editor idle with the performance HUD open for a 2-minute soak.",
  id: "idle-soak-2min",
  label: "Idle Soak (2min)",
  run: async ({ waitForFrame }) => {
    const startedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    while (true) {
      const now = await waitForFrame();

      if (now - startedAt >= IDLE_SOAK_2MIN_DURATION_MS) {
        return;
      }
    }
  },
  usesScratchDocument: false,
};
