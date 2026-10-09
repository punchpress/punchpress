import { EffectsItem } from "./effects-item";
import { EffectsList } from "./effects-list";
import { EffectsRoot } from "./effects-root";
import { EffectsShadowFields } from "./effects-shadow-fields";

// Compound family for the selection's effects stack:
// <Effects.Root>
//   <Effects.List>
//     {(id) => (
//       <Effects.Item details={<Effects.ShadowFields effectId={id} />} effectId={id} />
//     )}
//   </Effects.List>
// </Effects.Root>
const Effects = {
  Item: EffectsItem,
  List: EffectsList,
  Root: EffectsRoot,
  ShadowFields: EffectsShadowFields,
};

export const EffectsPanel = () => {
  return (
    <Effects.Root>
      <Effects.List>
        {(effectId) => (
          <Effects.Item
            details={<Effects.ShadowFields effectId={effectId} />}
            effectId={effectId}
            key={effectId}
          />
        )}
      </Effects.List>
    </Effects.Root>
  );
};
