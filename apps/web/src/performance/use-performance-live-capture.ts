import { useEffect } from "react";
import { usePerformance } from "./use-performance";

export const usePerformanceLiveCapture = (enabled = true) => {
  const { controller } = usePerformance();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    return controller.retainLiveCapture();
  }, [controller, enabled]);
};
