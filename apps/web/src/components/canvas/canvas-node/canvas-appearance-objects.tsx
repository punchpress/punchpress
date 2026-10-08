import {
  type AppearanceObject,
  buildAppearanceElements,
} from "@punchpress/engine";
import { memo } from "react";
import { renderSvgElement } from "./svg-element";

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

  return elements.map(renderSvgElement);
});

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
