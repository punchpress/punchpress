import type {
  Appearance,
  AppearanceList,
  FillLayer,
  StrokeLayer,
} from "@punchpress/engine";
import { createContext, useContext } from "react";

interface AppearanceContextValue {
  appearance: Appearance;
}

interface AppearanceListContextValue {
  list: AppearanceList;
}

export const AppearanceContext = createContext<AppearanceContextValue | null>(
  null
);
export const AppearanceListContext =
  createContext<AppearanceListContextValue | null>(null);

export const useAppearance = () => {
  const value = useContext(AppearanceContext);

  if (!value) {
    throw new Error("Appearance parts must render inside Appearance.Root.");
  }

  return value.appearance;
};

export const useAppearanceList = () => {
  const value = useContext(AppearanceListContext);

  if (!value) {
    throw new Error("Appearance.Item must render inside Appearance.List.");
  }

  return value.list;
};

// Controls hold layer ids; commands address layers by index. The id resolves to
// its current index at dispatch so reorder and undo never retarget a control.
export const useAppearanceLayer = (layerId: string) => {
  const appearance = useAppearance();
  const list = useAppearanceList();
  const index = appearance[list].findIndex((layer) => layer.id === layerId);

  return index < 0
    ? null
    : {
        layer: appearance[list][index] as FillLayer | StrokeLayer,
        slot: { index, list },
      };
};
