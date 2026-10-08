import type { Effect } from "@punchpress/engine";
import { createContext, useContext } from "react";

interface EffectsContextValue {
  effects: readonly Effect[];
}

export const EffectsContext = createContext<EffectsContextValue | null>(null);

export const useEffects = () => {
  const value = useContext(EffectsContext);

  if (!value) {
    throw new Error("Effects parts must render inside Effects.Root.");
  }

  return value.effects;
};

// Controls hold effect ids; commands address effects by index. The id resolves
// to its current index at dispatch so reorder and undo never retarget a control.
export const useEffectSlot = (effectId: string) => {
  const effects = useEffects();
  const index = effects.findIndex((effect) => effect.id === effectId);

  return index < 0 ? null : { effect: effects[index], index };
};
