import {
  type AppearanceObject,
  buildAppearanceElements,
  type SvgElement,
} from "@punchpress/engine";
import { createElement, memo } from "react";

// Paints engine appearance objects from the engine's element tree, the same
// tree SVG export serializes, so canvas and export cannot drift. Engine
// objects keep their identity until their paint or geometry changes, so
// memoizing on them lets dense surfaces re-render only the edited item.
export const CanvasAppearanceObjects = memo(function CanvasAppearanceObjects({
  idPrefix,
  isEditing,
  objects,
}: {
  idPrefix: string;
  isEditing?: boolean;
  objects: readonly AppearanceObject[];
}) {
  const elements = buildAppearanceElements(
    objects,
    createIdAllocator(idPrefix),
    { hidden: isEditing }
  );

  return elements.map(renderElement);
});

const renderElement = (element: SvgElement) => {
  const props: Record<string, unknown> = { key: element.key };

  for (const [name, value] of Object.entries(element.attributes)) {
    if (name === "mask-type") {
      props.style = { maskType: value };
    } else {
      props[toReactPropName(name)] = value;
    }
  }

  if (element.tag === "path") {
    props.pointerEvents = "none";
  }

  return createElement(
    element.tag,
    props,
    ...(element.children ?? []).map(renderElement)
  );
};

// SVG presentation attributes are kebab-case in markup and camelCase in React.
const toReactPropName = (name: string) => {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
};

// Collision-free ids for one render: each distinct definition key gets the
// next index under a prefix unique to the mount; definitions and references
// re-render together, so the numbering only has to agree within one pass.
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
