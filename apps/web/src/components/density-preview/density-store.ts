import { useSyncExternalStore } from "react";
import { DENSITY_DIRECTIONS, type DensityId } from "./density-directions";

const STORAGE_KEY = "punchpress.density-preview";
const listeners = new Set<() => void>();

const isDensityId = (value: unknown): value is DensityId => {
  return DENSITY_DIRECTIONS.some((direction) => direction.id === value);
};

const readStoredDensity = (): DensityId => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    return isDensityId(stored) ? stored : "current";
  } catch {
    return "current";
  }
};

let currentDensity: DensityId =
  typeof window === "undefined" ? "current" : readStoredDensity();

// Tokens follow the attribute, so every `size="field"` control restyles
// without a React render.
const applyDensityAttribute = (density: DensityId) => {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.density = density;
  }
};

applyDensityAttribute(currentDensity);

export const setDensity = (density: DensityId) => {
  currentDensity = density;
  applyDensityAttribute(density);

  try {
    window.localStorage.setItem(STORAGE_KEY, density);
  } catch {
    // Private windows can refuse storage; the choice still applies.
  }

  for (const listener of listeners) {
    listener();
  }
};

export const cycleDensity = (step: 1 | -1) => {
  const index = DENSITY_DIRECTIONS.findIndex(
    (direction) => direction.id === currentDensity
  );
  const count = DENSITY_DIRECTIONS.length;

  setDensity(DENSITY_DIRECTIONS[(index + step + count) % count].id);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const getDensity = () => currentDensity;

export const useDensity = () => {
  return useSyncExternalStore(subscribe, getDensity, getDensity);
};

export const useDensityLayout = () => {
  const density = useDensity();

  return (
    DENSITY_DIRECTIONS.find((direction) => direction.id === density) ??
    DENSITY_DIRECTIONS[0]
  ).layout;
};
