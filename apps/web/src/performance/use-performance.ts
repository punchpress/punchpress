import { useContext, useSyncExternalStore } from "react";
import { PerformanceContext } from "./performance-provider";

export const usePerformance = () => {
  const controller = useContext(PerformanceContext);

  if (!controller) {
    throw new Error("usePerformance must be used within PerformanceProvider");
  }

  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  return {
    controller,
    state,
  };
};
