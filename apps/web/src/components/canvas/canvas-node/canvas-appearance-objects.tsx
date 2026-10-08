import {
  type AppearanceDraw,
  type AppearanceObject,
  type AppearancePass,
  type AppearancePath,
  formatPaintNumber,
  type GradientDef,
  resolveDrawPaint,
} from "@punchpress/engine";

// Paints engine appearance objects: one <path> per geometry path per paint
// pass, in plan order, under one opacity group per object, with gradient
// definitions kept in the owning SVG. A single-element object carries its
// opacity on the element. Mirrors the SVG export serializer.
export const CanvasAppearanceObjects = ({
  idPrefix,
  isEditing,
  objects,
}: {
  idPrefix: string;
  isEditing?: boolean;
  objects: readonly AppearanceObject[];
}) => {
  const makeId = createIdAllocator(idPrefix);

  return objects.map((object) => {
    const opacity = isEditing ? 0 : object.opacity;
    const defs = new Map<string, GradientDef>();
    const elements = object.passes.flatMap((pass) => {
      return object.paths.map((path) => ({
        path,
        props: getPassProps(object, pass, path, makeId, defs),
        key: `${pass.key}:${path.key}`,
      }));
    });
    const gradients =
      defs.size > 0 ? (
        <defs>
          {[...defs.values()].map((def) => (
            <CanvasLinearGradient def={def} key={def.id} />
          ))}
        </defs>
      ) : null;

    if (elements.length === 1) {
      const [{ path, props }] = elements;

      return (
        <g key={object.key}>
          {gradients}
          <CanvasAppearancePath opacity={opacity} path={path} props={props} />
        </g>
      );
    }

    return (
      <g key={object.key} opacity={getOpacityAttribute(opacity)}>
        {gradients}
        {elements.map(({ key, path, props }) => (
          <CanvasAppearancePath
            key={key}
            opacity={1}
            path={path}
            props={props}
          />
        ))}
      </g>
    );
  });
};

const CanvasAppearancePath = ({
  opacity,
  path,
  props,
}: {
  opacity: number;
  path: AppearancePath;
  props: ReturnType<typeof getPassProps>;
}) => {
  return (
    <path
      d={path.d}
      fillRule={path.fillRule}
      opacity={getOpacityAttribute(opacity)}
      pointerEvents="none"
      transform={path.transform || undefined}
      {...props}
    />
  );
};

const CanvasLinearGradient = ({ def }: { def: GradientDef }) => {
  return (
    <linearGradient
      gradientTransform={def.transform || undefined}
      gradientUnits="userSpaceOnUse"
      id={def.id}
      x1={formatPaintNumber(def.x1)}
      x2={formatPaintNumber(def.x2)}
      y1={formatPaintNumber(def.y1)}
      y2={formatPaintNumber(def.y2)}
    >
      {def.stops.map((stop, index) => (
        <stop
          // biome-ignore lint/suspicious/noArrayIndexKey: stops are positional
          key={index}
          offset={formatPaintNumber(stop.offset)}
          stopColor={stop.color}
          stopOpacity={getOpacityAttribute(stop.opacity)}
        />
      ))}
    </linearGradient>
  );
};

const getPassProps = (
  object: AppearanceObject,
  { fill, stroke }: AppearancePass,
  path: AppearancePath,
  makeId: (key: string) => string,
  defs: Map<string, GradientDef>
) => {
  const resolve = (draw: AppearanceDraw) => {
    const resolved = resolveDrawPaint(object, draw, path, makeId);

    if (resolved.def) {
      defs.set(resolved.def.id, resolved.def);
    }

    return resolved;
  };
  const fillPaint = fill ? resolve(fill) : null;
  const strokePaint = stroke ? resolve(stroke) : null;

  return {
    fill: fillPaint ? fillPaint.value : "none",
    fillOpacity: fillPaint ? getOpacityAttribute(fillPaint.opacity) : undefined,
    paintOrder: fill && stroke ? "fill stroke" : undefined,
    stroke: strokePaint ? strokePaint.value : "none",
    strokeLinecap: stroke?.cap,
    strokeLinejoin: stroke?.join,
    strokeMiterlimit: stroke?.miterLimit,
    strokeOpacity: strokePaint
      ? getOpacityAttribute(strokePaint.opacity)
      : undefined,
    strokeWidth: stroke?.width,
  };
};

// Collision-free ids for one render: each distinct paint key gets the next
// index under a prefix unique to the mount; defs and references re-render
// together, so the numbering only has to agree within one pass.
const createIdAllocator = (prefix: string) => {
  const ids = new Map<string, string>();

  return (key: string) => {
    let id = ids.get(key);

    if (!id) {
      id = `${prefix}${ids.size}`;
      ids.set(key, id);
    }

    return id;
  };
};

const getOpacityAttribute = (opacity: number) => {
  return opacity >= 1 ? undefined : opacity;
};
