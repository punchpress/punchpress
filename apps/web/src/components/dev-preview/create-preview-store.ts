import { useSyncExternalStore } from "react";

// Dev-only A/B switches for UI explorations. Each preview writes its choice
// to a `data-*` attribute on <html> so CSS token blocks restyle the app
// without a React render, and remembers it in localStorage. Production builds
// always use the first option.
export interface PreviewOption {
  description: string;
  id: string;
  label: string;
}

export interface PreviewStore {
  attribute: string;
  cycle: (step: 1 | -1) => void;
  options: readonly PreviewOption[];
  set: (id: string) => void;
  useValue: () => string;
}

export const createPreviewStore = ({
  attribute,
  options,
  storageKey,
}: {
  attribute: string;
  options: readonly PreviewOption[];
  storageKey: string;
}): PreviewStore => {
  const fallback = options[0].id;
  const listeners = new Set<() => void>();
  const isOption = (value: unknown) => {
    return options.some((option) => option.id === value);
  };
  const readStored = () => {
    if (!import.meta.env.DEV) {
      return fallback;
    }

    try {
      const stored = window.localStorage.getItem(storageKey);

      return isOption(stored) ? (stored as string) : fallback;
    } catch {
      return fallback;
    }
  };
  const apply = (id: string) => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute(`data-${attribute}`, id);
    }
  };

  let current = typeof window === "undefined" ? fallback : readStored();

  apply(current);

  const set = (id: string) => {
    if (!isOption(id)) {
      return;
    }

    current = id;
    apply(id);

    try {
      window.localStorage.setItem(storageKey, id);
    } catch {
      // Private windows can refuse storage; the choice still applies.
    }

    for (const listener of listeners) {
      listener();
    }
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };
  const getValue = () => current;

  return {
    attribute,
    cycle: (step) => {
      const index = options.findIndex((option) => option.id === current);
      const count = options.length;

      set(options[(index + step + count) % count].id);
    },
    options,
    set,
    useValue: () => useSyncExternalStore(subscribe, getValue, getValue),
  };
};
