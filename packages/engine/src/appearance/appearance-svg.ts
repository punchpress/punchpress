import { format } from "../primitives/math";
import {
  buildAppearanceElements,
  type SvgElement,
} from "./appearance-elements";
import type { AppearanceObject } from "./appearance-types";

// Allocates export-unique definition ids for one whole document export; the
// same key always maps to the same id.
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

// Serializes painted objects as SVG 1.1 markup from the same element tree the
// canvas renders: concrete <path>s (no <use>), alpha in opacity attributes
// rather than rgba(), and gradients, clips and masks as userSpaceOnUse
// definitions inside each object's group.
export const serializeAppearanceObjects = (
  objects: readonly AppearanceObject[],
  makeId: (key: string) => string
) => {
  return buildAppearanceElements(objects, makeId)
    .map(serializeElement)
    .join("");
};

export const wrapSvgOpacity = (markup: string, opacity: number) => {
  if (!markup || opacity >= 1) {
    return markup;
  }

  return `<g opacity="${format(opacity)}">${markup}</g>`;
};

const serializeElement = (element: SvgElement): string => {
  const attributes = Object.entries(element.attributes)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join("");
  const children = element.children ?? [];

  if (children.length === 0) {
    return `<${element.tag}${attributes}/>`;
  }

  return `<${element.tag}${attributes}>${children.map(serializeElement).join("")}</${element.tag}>`;
};

const escapeAttribute = (value: string) => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
};
