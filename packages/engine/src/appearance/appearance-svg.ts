import { format } from "../primitives/math";
import type { SvgElement } from "./appearance-elements";

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

// Serializes the engine element tree (the same tree the canvas renders) as
// SVG 1.1 markup: concrete <path>s (no <use>), alpha in opacity attributes
// rather than rgba(), and gradients, clips, masks, and filters as
// userSpaceOnUse definitions inside their owner's group.
export const serializeSvgElements = (elements: readonly SvgElement[]) => {
  return elements.map(serializeElement).join("");
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
