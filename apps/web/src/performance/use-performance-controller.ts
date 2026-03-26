import { useContext } from "react";
import { PerformanceContext } from "./performance-context";

export const usePerformanceController = () => {
  const controller = useContext(PerformanceContext);

  if (!controller) {
    throw new Error(
      "usePerformanceController must be used within PerformanceProvider"
    );
  }

  return controller;
};
