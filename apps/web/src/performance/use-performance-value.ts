import { useSyncExternalStore } from "react";
import type { PerformanceState } from "./performance-controller";
import { usePerformanceController } from "./use-performance-controller";

export const usePerformanceValue = <Value>(
  selector: (state: PerformanceState) => Value
) => {
  const controller = usePerformanceController();

  return useSyncExternalStore(
    controller.subscribe,
    () => selector(controller.getSnapshot()),
    () => selector(controller.getSnapshot())
  );
};
