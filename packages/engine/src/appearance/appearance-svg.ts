import { format } from "../primitives/math";
import type {
  AppearanceObject,
  AppearancePass,
  AppearancePath,
} from "./appearance-types";

// Serializes painted objects as SVG 1.1 markup: one opacity group per object,
// one concrete <path> per geometry path per paint pass (no <use>), and alpha in
// fill-/stroke-opacity attributes rather than rgba(). Fills paint open
// contours with SVG's implicit closure.
export const serializeAppearanceObjects = (
  objects: readonly AppearanceObject[]
) => {
  return objects.map(serializeObject).join("");
};

export const wrapSvgOpacity = (markup: string, opacity: number) => {
  if (!markup || opacity >= 1) {
    return markup;
  }

  return `<g opacity="${format(opacity)}">${markup}</g>`;
};

const serializeObject = (object: AppearanceObject) => {
  const elementCount = object.passes.length * object.paths.length;

  // A single element takes the object opacity itself; it composites the same
  // as a one-element group.
  if (elementCount === 1) {
    return serializePath(
      object.paths[0],
      getPassAttributes(object.passes[0]),
      object.opacity
    );
  }

  const markup = object.passes
    .flatMap((pass) => {
      const paint = getPassAttributes(pass);

      return object.paths.map((path) => serializePath(path, paint, 1));
    })
    .join("");

  return wrapSvgOpacity(markup, object.opacity);
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

const getPassAttributes = ({ fill, stroke }: AppearancePass) => {
  const fillAttributes = fill
    ? ` fill="${fill.color}"${getOpacityAttribute("fill-opacity", fill.opacity)}`
    : ' fill="none"';

  if (!stroke) {
    return `${fillAttributes} stroke="none"`;
  }

  return `${fillAttributes} stroke="${stroke.color}"${getOpacityAttribute(
    "stroke-opacity",
    stroke.opacity
  )} stroke-width="${format(stroke.width)}" stroke-linejoin="${stroke.join}" stroke-linecap="${stroke.cap}" stroke-miterlimit="${format(stroke.miterLimit)}"${fill ? ' paint-order="fill stroke"' : ""}`;
};

const getOpacityAttribute = (name: string, value: number) => {
  return value >= 1 ? "" : ` ${name}="${format(value)}"`;
};
