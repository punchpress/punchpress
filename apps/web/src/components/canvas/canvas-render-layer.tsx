import {
  buildEffectFilter,
  type EffectPresentation,
  type RenderLayer,
} from "@punchpress/engine";
import { toRgb } from "@punchpress/punch-schema";
import { type CSSProperties, memo, type ReactNode, useId } from "react";
import { renderSvgElement } from "./canvas-node/svg-element";
import { useLayerComposite } from "./use-layer-composite";

// One compositing boundary per group or artboard: a zero-size div at the
// stage origin, so descendants keep stage coordinates. CSS opacity below 1
// isolates the subtree; a group's shadows composite through CSS
// filter: url() over a stage-space SVG filter (applied before opacity, so
// they fade with the group); an artboard holding shadowed groups clips with
// clip-path in stage coordinates. The element and its children keep the same
// shape whether or not a layer is composited, so toggling a shadow never
// remounts the subtree. It carries no node markers, so hit testing and
// selection never target it.
export const CanvasRenderLayer = memo(function CanvasRenderLayer({
  children,
  layer,
}: {
  children: ReactNode;
  layer: RenderLayer;
}) {
  const filterId = `pp${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-fx`;
  const { clip, effects } = useLayerComposite(layer);
  const style: CSSProperties = {};

  if (layer.opacity < 1) {
    style.opacity = layer.opacity;
  }

  // One shadow is exactly a CSS drop-shadow() (same blur-radius semantics),
  // which Chromium can composite without repainting the group's subtree;
  // several shadows need the branched SVG graph, since chained drop-shadow()
  // would shadow the earlier shadows.
  const cssShadow = effects ? getCssDropShadow(effects) : null;

  if (cssShadow) {
    style.filter = cssShadow;
  } else if (effects) {
    style.filter = `url(#${filterId})`;
  }

  if (clip) {
    style.clipPath = `path('M ${clip.minX} ${clip.minY} H ${clip.maxX} V ${clip.maxY} H ${clip.minX} Z')`;
  }

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 h-0 w-0"
      data-render-layer={layer.nodeId}
      style={style}
    >
      {children}
      {effects && !cssShadow ? (
        <svg
          aria-hidden="true"
          className="absolute overflow-visible"
          height={0}
          width={0}
        >
          <defs>{renderSvgElement(buildEffectFilter(effects, filterId))}</defs>
        </svg>
      ) : null}
    </div>
  );
});

const getCssDropShadow = ({ effects }: EffectPresentation) => {
  if (effects.length !== 1) {
    return null;
  }

  const [{ blur, color, opacity, x, y }] = effects;
  const { b, g, r } = toRgb(color);

  return `drop-shadow(${x}px ${y}px ${blur}px rgba(${r}, ${g}, ${b}, ${opacity}))`;
};
