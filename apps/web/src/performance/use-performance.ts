import { usePerformanceController } from "./use-performance-controller";
import { usePerformanceValue } from "./use-performance-value";

export const usePerformance = () => {
  const controller = usePerformanceController();
  const state = usePerformanceValue((snapshot) => snapshot);

  return {
    controller,
    state,
  };
};
