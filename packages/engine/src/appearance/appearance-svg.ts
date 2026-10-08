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
} from "./appearance-types";

// Allocates export-unique gradient ids for one whole document export; the same
// key always maps to the same id.
export const createPaintIdAllocator = () => {
  const ids = new Map<string, string>();

  return (key: string) => {
    let id = ids.get(key);

    if (!id) {
      id = `pp-g${ids.size}`;
      ids.set(key, id);
    }

    return id;
  };
};

// Serializes painted objects as SVG 1.1 markup: one opacity group per object,
// one concrete <path> per geometry path per paint pass (no <use>), alpha in
// fill-/stroke-opacity attributes rather than rgba(), and gradients as
// userSpaceOnUse <linearGradient> definitions placed before their object.
// Fills paint open contours with SVG's implicit closure.
export const serializeAppearanceObjects = (
  objects: readonly AppearanceObject[],
  makeId: (key: string) => string
) => {
  return objects.map((object) => serializeObject(object, makeId)).join("");
};

export const wrapSvgOpacity = (markup: string, opacity: number) => {
  if (!markup || opacity >= 1) {
    return markup;
  }

  return `<g opacity="${format(opacity)}">${markup}</g>`;
};

const serializeObject = (
  object: AppearanceObject,
  makeId: (key: string) => string
) => {
  const defs = new Map<string, GradientDef>();
  const elements = object.passes.flatMap((pass) => {
    return object.paths.map((path) => {
      const paint = getPassAttributes(object, pass, path, makeId, defs);

      return { paint, path };
    });
  });
  const defsMarkup =
    defs.size > 0
      ? `<defs>${[...defs.values()].map(serializeGradient).join("")}</defs>`
      : "";

  // A single element takes the object opacity itself; it composites the same
  // as a one-element group.
  if (elements.length === 1) {
    const [{ paint, path }] = elements;

    return defsMarkup + serializePath(path, paint, object.opacity);
  }

  const markup = elements
    .map(({ paint, path }) => serializePath(path, paint, 1))
    .join("");

  return defsMarkup + wrapSvgOpacity(markup, object.opacity);
};

const serializePath = (
  path: AppearancePath,
  paint: string,
  opacity: number
) => {
  const transform = path.transform ? ` transform="${path.transform}"` : "";
  const fillRule = path.fillRule ? ` fill-rule="${path.fillRule}"` : "";

  return `<path d="${path.d}"${transform}${fillRule}${getOpacityAttribute("opacity", opacity)}${paint}/>`;
};

const getPassAttributes = (
  object: AppearanceObject,
  { fill, stroke }: AppearancePass,
  path: AppearancePath,
  makeId: (key: string) => string,
  defs: Map<string, GradientDef>
) => {
  const resolve = (draw) => {
    const resolved = resolveDrawPaint(object, draw, path, makeId);

    if (resolved.def) {
      defs.set(resolved.def.id, resolved.def);
    }

    return resolved;
  };
  const fillPaint = fill ? resolve(fill) : null;
  const fillAttributes = fillPaint
    ? ` fill="${fillPaint.value}"${getOpacityAttribute("fill-opacity", fillPaint.opacity)}`
    : ' fill="none"';

  if (!stroke) {
    return `${fillAttributes} stroke="none"`;
  }

  const strokePaint = resolve(stroke);

  return `${fillAttributes} stroke="${strokePaint.value}"${getOpacityAttribute(
    "stroke-opacity",
    strokePaint.opacity
  )} stroke-width="${format(stroke.width)}" stroke-linejoin="${stroke.join}" stroke-linecap="${stroke.cap}" stroke-miterlimit="${format(stroke.miterLimit)}"${fill ? ' paint-order="fill stroke"' : ""}`;
};

const serializeGradient = (def: GradientDef) => {
  const transform = def.transform
    ? ` gradientTransform="${def.transform}"`
    : "";
  const stops = def.stops
    .map((stop) => {
      return `<stop offset="${formatPaintNumber(stop.offset)}" stop-color="${stop.color}"${getOpacityAttribute("stop-opacity", stop.opacity)}/>`;
    })
    .join("");

  return `<linearGradient id="${def.id}" gradientUnits="userSpaceOnUse" x1="${formatPaintNumber(def.x1)}" y1="${formatPaintNumber(def.y1)}" x2="${formatPaintNumber(def.x2)}" y2="${formatPaintNumber(def.y2)}"${transform}>${stops}</linearGradient>`;
};

const getOpacityAttribute = (name: string, value: number) => {
  return value >= 1 ? "" : ` ${name}="${format(value)}"`;
};
