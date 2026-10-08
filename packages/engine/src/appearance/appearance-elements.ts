import { format } from "../primitives/math";
import {
  formatPaintNumber,
  type GradientDef,
  resolveDrawPaint,
} from "./appearance-paint-servers";
import type {
  AppearanceObject,
  AppearancePass,
  AppearancePath,
  AppearanceStrokeDraw,
  Bounds,
} from "./appearance-types";

// A renderer-neutral SVG element. Canvas renders it as React elements and
// export serializes it to markup, so both paint the same tree. Attribute
// names are SVG markup names; values are preformatted strings.
export interface SvgElement {
  attributes: Readonly<Record<string, string>>;
  children?: readonly SvgElement[];
  key: string;
  tag:
    | "clipPath"
    | "defs"
    | "g"
    | "linearGradient"
    | "mask"
    | "path"
    | "rect"
    | "stop";
}

type MakeId = (key: string) => string;

// Paints appearance objects in plan order: one opacity group per object, one
// <path> per geometry path per pass, and the object's definitions first.
// Inside strokes are 2w center strokes clipped to the path's own fill region;
// outside strokes are 2w center strokes masked to everything outside it. The
// clip or mask sits on the element that carries the path transform, so its
// geometry is in path-local coordinates.
export const buildAppearanceElements = (
  objects: readonly AppearanceObject[],
  makeId: MakeId,
  { hidden = false }: { hidden?: boolean } = {}
): SvgElement[] => {
  return objects.map((object) => buildObject(object, makeId, hidden));
};

const buildObject = (
  object: AppearanceObject,
  makeId: MakeId,
  hidden: boolean
): SvgElement => {
  const defs = new Map<string, SvgElement>();
  const elements = object.passes.flatMap((pass) => {
    return object.paths.map((path) => {
      return buildPassPath(object, pass, path, makeId, defs);
    });
  });
  const opacity = hidden ? 0 : object.opacity;
  const children = [
    ...(defs.size > 0
      ? [
          {
            attributes: {},
            children: [...defs.values()],
            key: "defs",
            tag: "defs" as const,
          },
        ]
      : []),
  ];

  // A single element takes the object opacity itself; it composites the same
  // as a one-element group.
  if (elements.length === 1) {
    const [element] = elements;

    return {
      attributes: {},
      children: [...children, withOpacity(element, opacity)],
      key: object.key,
      tag: "g",
    };
  }

  return {
    attributes: opacityAttributes("opacity", opacity),
    children: [...children, ...elements],
    key: object.key,
    tag: "g",
  };
};

const buildPassPath = (
  object: AppearanceObject,
  pass: AppearancePass,
  path: AppearancePath,
  makeId: MakeId,
  defs: Map<string, SvgElement>
): SvgElement => {
  const { fill, stroke } = pass;
  const resolve = (draw) => {
    const resolved = resolveDrawPaint(object, draw, path, makeId);

    if (resolved.def) {
      defs.set(resolved.def.id, buildGradient(resolved.def));
    }

    return resolved;
  };
  const attributes: Record<string, string> = {
    d: path.d,
    ...(path.transform ? { transform: path.transform } : {}),
    ...(path.fillRule ? { "fill-rule": path.fillRule } : {}),
  };
  const fillPaint = fill ? resolve(fill) : null;

  attributes.fill = fillPaint ? fillPaint.value : "none";
  Object.assign(
    attributes,
    opacityAttributes("fill-opacity", fillPaint?.opacity ?? 1)
  );

  if (stroke) {
    const strokePaint = resolve(stroke);
    const aligned = stroke.align !== "center";

    Object.assign(attributes, {
      stroke: strokePaint.value,
      ...opacityAttributes("stroke-opacity", strokePaint.opacity),
      "stroke-width": format(aligned ? stroke.width * 2 : stroke.width),
      "stroke-linejoin": stroke.join,
      "stroke-linecap": stroke.cap,
      "stroke-miterlimit": format(stroke.miterLimit),
      ...(fill ? { "paint-order": "fill stroke" } : {}),
    });

    if (stroke.align === "inside") {
      attributes["clip-path"] = `url(#${addClip(path, makeId, object, defs)})`;
    } else if (stroke.align === "outside") {
      attributes.mask = `url(#${addMask(path, makeId, object, defs)})`;
    }
  } else {
    attributes.stroke = "none";
  }

  return {
    attributes,
    key: `${pass.key}:${path.key}`,
    tag: "path",
  };
};

const addClip = (
  path: AppearancePath,
  makeId: MakeId,
  object: AppearanceObject,
  defs: Map<string, SvgElement>
) => {
  // Keyed by outline, so repeated glyphs share one definition.
  const id = makeId(
    JSON.stringify(["clip", object.key, path.d, path.fillRule ?? ""])
  );

  defs.set(id, {
    attributes: { clipPathUnits: "userSpaceOnUse", id },
    children: [
      {
        attributes: {
          d: path.d,
          ...(path.fillRule ? { "clip-rule": path.fillRule } : {}),
        },
        key: "shape",
        tag: "path",
      },
    ],
    key: id,
    tag: "clipPath",
  });

  return id;
};

// Luminance mask: white everywhere the outside stroke can reach, black over
// the path's own fill region (honoring its fill rule).
const addMask = (
  path: AppearancePath,
  makeId: MakeId,
  object: AppearanceObject,
  defs: Map<string, SvgElement>
) => {
  // Keyed by outline: the same `d` has the same local bounds, and the reach
  // is per object, so repeated glyphs share one mask.
  const id = makeId(
    JSON.stringify(["mask", object.key, path.d, path.fillRule ?? ""])
  );
  const region = getMaskRegion(path, object);
  const regionAttributes = {
    height: format(region.height),
    width: format(region.width),
    x: format(region.minX),
    y: format(region.minY),
  };

  defs.set(id, {
    attributes: {
      "color-interpolation": "sRGB",
      id,
      maskContentUnits: "userSpaceOnUse",
      maskUnits: "userSpaceOnUse",
      "mask-type": "luminance",
      ...regionAttributes,
    },
    children: [
      {
        attributes: { ...regionAttributes, fill: "#ffffff", stroke: "none" },
        key: "reach",
        tag: "rect",
      },
      {
        attributes: {
          d: path.d,
          fill: "#000000",
          ...(path.fillRule ? { "fill-rule": path.fillRule } : {}),
          stroke: "none",
        },
        key: "shape",
        tag: "path",
      },
    ],
    key: id,
    tag: "mask",
  });

  return id;
};

// The path-local box an outside stroke can paint into: the path's own bounds
// grown by the farthest outside reach of the object's outside strokes (miters
// up to miterLimit × w, square caps on open contours √2 × w), plus slack for
// bounds computed from flattened curves.
const getMaskRegion = (path: AppearancePath, object: AppearanceObject) => {
  const box = getPathLocalBounds(path, object);
  const reach = object.draws.reduce((farthest, draw) => {
    return draw.kind === "stroke" && draw.align === "outside"
      ? Math.max(farthest, getOutsideReach(draw))
      : farthest;
  }, 0);
  const slack = 2 + 0.02 * Math.max(box.width, box.height);
  const grow = reach + slack;

  return {
    height: box.height + grow * 2,
    minX: box.minX - grow,
    minY: box.minY - grow,
    width: box.width + grow * 2,
  };
};

const getOutsideReach = (draw: AppearanceStrokeDraw) => {
  const joinFactor = draw.join === "miter" ? Math.max(1, draw.miterLimit) : 1;
  const capFactor = draw.cap === "square" ? Math.SQRT2 : 1;

  return draw.width * Math.max(joinFactor, capFactor);
};

const EMPTY_BOUNDS: Bounds = {
  height: 0,
  maxX: 0,
  maxY: 0,
  minX: 0,
  minY: 0,
  width: 0,
};

const getPathLocalBounds = (
  path: AppearancePath,
  object: AppearanceObject
): Bounds => {
  if (path.bounds) {
    return path.bounds;
  }

  if (path.paintBox) {
    return path.paintBox;
  }

  // Untransformed paths share the object's coordinates.
  return (!path.transform && object.paintBox) || EMPTY_BOUNDS;
};

const buildGradient = (def: GradientDef): SvgElement => {
  return {
    attributes: {
      gradientUnits: "userSpaceOnUse",
      id: def.id,
      ...(def.transform ? { gradientTransform: def.transform } : {}),
      x1: formatPaintNumber(def.x1),
      x2: formatPaintNumber(def.x2),
      y1: formatPaintNumber(def.y1),
      y2: formatPaintNumber(def.y2),
    },
    children: def.stops.map((stop, index) => ({
      attributes: {
        offset: formatPaintNumber(stop.offset),
        "stop-color": stop.color,
        ...opacityAttributes("stop-opacity", stop.opacity),
      },
      key: String(index),
      tag: "stop" as const,
    })),
    key: def.id,
    tag: "linearGradient",
  };
};

const withOpacity = (element: SvgElement, opacity: number): SvgElement => {
  return opacity >= 1
    ? element
    : {
        ...element,
        attributes: { ...element.attributes, opacity: format(opacity) },
      };
};

const opacityAttributes = (name: string, value: number) => {
  return value >= 1 ? {} : { [name]: format(value) };
};
