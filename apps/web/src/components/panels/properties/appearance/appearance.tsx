import { AppearanceItem } from "./appearance-item";
import { AppearanceListSection } from "./appearance-list";
import { AppearanceOpacityField } from "./appearance-opacity-field";
import { AppearancePaintFields } from "./appearance-paint-fields";
import { AppearanceRoot } from "./appearance-root";
import {
  AppearanceStrokeStyleFields,
  AppearanceStrokeWidthField,
} from "./appearance-stroke-fields";

// Compound family for the selection's appearance stack:
// <Appearance.Root>
//   <Appearance.List list="fills">
//     {(id) => <Appearance.Item details={<Appearance.PaintFields layerId={id} />} layerId={id} />}
//   </Appearance.List>
//   <Appearance.List list="strokes">
//     {(id) => (
//       <Appearance.Item details={<>paint and stroke style fields</>} layerId={id}>
//         <Appearance.StrokeWidth layerId={id} />
//       </Appearance.Item>
//     )}
//   </Appearance.List>
// </Appearance.Root>
const Appearance = {
  Item: AppearanceItem,
  List: AppearanceListSection,
  Opacity: AppearanceOpacityField,
  PaintFields: AppearancePaintFields,
  Root: AppearanceRoot,
  StrokeStyleFields: AppearanceStrokeStyleFields,
  StrokeWidth: AppearanceStrokeWidthField,
};

export const AppearancePanel = () => {
  return (
    <>
      <Appearance.Opacity />
      <Appearance.Root>
        <Appearance.List list="fills">
          {(layerId) => (
            <Appearance.Item
              details={<Appearance.PaintFields layerId={layerId} />}
              key={layerId}
              layerId={layerId}
            />
          )}
        </Appearance.List>
        <Appearance.List list="strokes">
          {(layerId) => (
            <Appearance.Item
              details={
                <>
                  <Appearance.PaintFields layerId={layerId} />
                  <Appearance.StrokeStyleFields layerId={layerId} />
                </>
              }
              key={layerId}
              layerId={layerId}
            >
              <Appearance.StrokeWidth layerId={layerId} />
            </Appearance.Item>
          )}
        </Appearance.List>
      </Appearance.Root>
    </>
  );
};
