import { incrementPerfCounter } from "@punchpress/engine";
import { useLayoutEffect } from "react";

export const usePerformanceRenderCounter = (counterName: string) => {
  useLayoutEffect(() => {
    incrementPerfCounter(counterName);
  });
};
