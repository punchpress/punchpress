import { buildEffectFilter, type EffectPresentation } from "@punchpress/engine";
import { memo, type ReactNode } from "react";
import { renderSvgElement } from "./svg-element";

// Composites an owner's artwork through its effect filter: the definition,
// then one group that applies it. Opacity stays on the caller's outer group,
// so the shadow fades with the content. Ids are unique per mount and owner.
export const CanvasEffectOwner = memo(function CanvasEffectOwner({
  children,
  effects,
  idPrefix,
}: {
  children: ReactNode;
  effects: EffectPresentation | null;
  idPrefix: string;
}) {
  if (!effects) {
    return children;
  }

  const id = `${idPrefix}fx`;

  return (
    <>
      <defs>{renderSvgElement(buildEffectFilter(effects, id))}</defs>
      <g filter={`url(#${id})`}>{children}</g>
    </>
  );
});
