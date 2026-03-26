import { createContext } from "react";
import type { PerformanceController } from "./performance-controller";

export const PerformanceContext = createContext<PerformanceController | null>(
  null
);
