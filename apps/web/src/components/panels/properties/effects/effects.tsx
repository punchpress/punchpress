import { EffectsItem } from "./effects-item";
import { EffectsList } from "./effects-list";
import { EffectsRoot } from "./effects-root";
import { EffectsShadowFields } from "./effects-shadow-fields";

// Compound family for the selection's effects stack:
// <Effects.Root>
//   <Effects.List>
//     {(id) => (
//       <Effects.Item effectId={id}><Effects.ShadowFields effectId={id} /></Effects.Item>
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
          <Effects.Item effectId={effectId} key={effectId}>
            <Effects.ShadowFields effectId={effectId} />
          </Effects.Item>
        )}
      </Effects.List>
    </Effects.Root>
  );
};
