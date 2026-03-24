import { useEffect } from "react";
import { usePerformanceController } from "./use-performance-controller";

export const usePerformanceLiveCapture = (enabled = true) => {
  const controller = usePerformanceController();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    return controller.retainLiveCapture();
  }, [controller, enabled]);
};
