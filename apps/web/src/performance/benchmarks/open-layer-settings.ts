import type { PerformanceBenchmarkContext } from "../performance-benchmark-types";

// Secondary fill, stroke, and shadow fields render only inside a row's
// settings popover, so a benchmark that scrubs them opens it first, the way
// a user would. Setup runs before counters collect, so the mount is excluded.
export const openLayerSettings = async (
  title: "Fill" | "Shadow" | "Stroke",
  waitForFrames: PerformanceBenchmarkContext["waitForFrames"]
) => {
  const trigger = document.querySelector(
    `[data-properties-panel] button[aria-label="${title} settings"]`
  );

  if (!(trigger instanceof HTMLElement)) {
    throw new Error(`Unable to find the ${title} settings button`);
  }

  trigger.click();
  await waitForFrames(2);

  if (trigger.getAttribute("aria-expanded") !== "true") {
    throw new Error(`The ${title} settings popover did not open`);
  }
};
