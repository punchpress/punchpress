import type { AppearanceObject, AppearancePass } from "@punchpress/engine";
import { getCanvasPaintValue } from "./node-render-tree";

// Paints engine appearance objects: one <path> per geometry path per paint
// pass, in plan order, under one opacity group per object. A single-element
// object carries its opacity on the element. Mirrors the SVG export serializer.
export const CanvasAppearanceObjects = ({
  isEditing,
  objects,
}: {
  isEditing?: boolean;
  objects: readonly AppearanceObject[];
}) => {
  return objects.map((object) => {
    const opacity = isEditing ? 0 : object.opacity;

    if (object.passes.length * object.paths.length === 1) {
      return (
        <CanvasAppearancePath
          key={object.key}
          opacity={opacity}
          pass={object.passes[0]}
          path={object.paths[0]}
        />
      );
    }

    return (
      <g key={object.key} opacity={getOpacityAttribute(opacity)}>
        {object.passes.flatMap((pass) =>
          object.paths.map((path) => (
            <CanvasAppearancePath
              key={`${pass.key}:${path.key}`}
              opacity={1}
              pass={pass}
              path={path}
            />
          ))
        )}
      </g>
    );
  });
};

const CanvasAppearancePath = ({
  opacity,
  pass,
  path,
}: {
  opacity: number;
  pass: AppearancePass;
  path: AppearanceObject["paths"][number];
}) => {
  const { fill, stroke } = pass;

  return (
    <path
      d={path.d}
      fill={fill ? fill.color : "none"}
      fillOpacity={fill ? getOpacityAttribute(fill.opacity) : undefined}
      fillRule={path.fillRule}
      opacity={getOpacityAttribute(opacity)}
      paintOrder={fill && stroke ? "fill stroke" : undefined}
      pointerEvents="none"
      stroke={stroke ? stroke.color : "none"}
      strokeLinecap={stroke?.cap}
      strokeLinejoin={stroke?.join}
      strokeMiterlimit={stroke?.miterLimit}
      strokeOpacity={stroke ? getOpacityAttribute(stroke.opacity) : undefined}
      strokeWidth={stroke?.width}
      style={{
        fill: fill ? getCanvasPaintValue(fill.color) : undefined,
        stroke: stroke ? getCanvasPaintValue(stroke.color) : undefined,
      }}
      transform={path.transform || undefined}
    />
  );
};

const getOpacityAttribute = (opacity: number) => {
  return opacity >= 1 ? undefined : opacity;
};
