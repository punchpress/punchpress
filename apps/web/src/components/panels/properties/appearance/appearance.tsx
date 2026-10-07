import { AppearanceItem } from "./appearance-item";
import { AppearanceListSection } from "./appearance-list";
import { AppearanceOpacityField } from "./appearance-opacity-field";
import { AppearanceRoot } from "./appearance-root";
import { AppearanceStrokeFields } from "./appearance-stroke-fields";

// Compound family for the selection's appearance stack:
// <Appearance.Root>
//   <Appearance.List list="fills">{(id) => <Appearance.Item layerId={id} />}</Appearance.List>
//   <Appearance.List list="strokes">
//     {(id) => (
//       <Appearance.Item layerId={id}><Appearance.StrokeFields layerId={id} /></Appearance.Item>
//     )}
//   </Appearance.List>
// </Appearance.Root>
const Appearance = {
  Item: AppearanceItem,
  List: AppearanceListSection,
  Opacity: AppearanceOpacityField,
  Root: AppearanceRoot,
  StrokeFields: AppearanceStrokeFields,
};

export const AppearancePanel = () => {
  return (
    <>
      <Appearance.Opacity />
      <Appearance.Root>
        <Appearance.List list="fills">
          {(layerId) => <Appearance.Item key={layerId} layerId={layerId} />}
        </Appearance.List>
        <Appearance.List list="strokes">
          {(layerId) => (
            <Appearance.Item key={layerId} layerId={layerId}>
              <Appearance.StrokeFields layerId={layerId} />
            </Appearance.Item>
          )}
        </Appearance.List>
      </Appearance.Root>
    </>
  );
};
