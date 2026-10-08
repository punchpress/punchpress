import {
  buildEffectFilter,
  PERF_COUNTERS,
  type RenderItem,
  type RenderLayer,
} from "@punchpress/engine";
import { type CSSProperties, memo, type ReactNode, useId } from "react";
import { usePerformanceRenderCounter } from "../../performance/use-performance-render-counter";
import { CanvasNode } from "./canvas-node/canvas-node";
import { renderSvgElement } from "./canvas-node/svg-element";
import { getCssDropShadow } from "./css-drop-shadow";
import { usePresentationElementRef } from "./placement/presentation-elements";
import { useLayerComposite } from "./use-layer-composite";

// One render layer per group or artboard, in three stable parts, outermost
// first:
// - presentation: a zero-size, stage-origin wrapper that a whole-layer drag
//   translates as one compositing root (the only element a gesture moves)
// - clip (artboards only): a box at the artboard frame with `overflow: clip`,
//   so content and the shadows of its groups stop at the artboard edge while
//   children move beneath it
// - effect: opacity and the group's shadow filter, applied once to content
//   plus shadow (filter before opacity)
// Descendants keep stage coordinates throughout. The parts keep their shape
// whether or not a layer is composited, so toggling a shadow never remounts
// the subtree. No part carries node markers, so hit testing and selection
// never target them.
// The engine keeps an unchanged layer's object across rebuilds, so memoizing
// on `layer` skips its whole subtree when a structural edit lands elsewhere.
const CanvasRenderLayer = memo(function CanvasRenderLayer({
  layer,
}: {
  layer: RenderLayer;
}) {
  usePerformanceRenderCounter(PERF_COUNTERS.renderLayerComposite);
  const filterId = `pp${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-fx`;
  const presentationRef = usePresentationElementRef(layer.nodeId);
  const { clip, effects } = useLayerComposite(layer);
  const style: CSSProperties = {};

  if (layer.opacity < 1) {
    style.opacity = layer.opacity;
  }

  // One shadow is a CSS drop-shadow(); several need the branched SVG graph,
  // since chained drop-shadow() would shadow the earlier shadows.
  const cssShadow = effects ? getCssDropShadow(effects) : null;

  if (cssShadow) {
    style.filter = cssShadow;
  } else if (effects) {
    style.filter = `url(#${filterId})`;
  }

  const effectLayer = (
    <div
      className="pointer-events-none absolute top-0 left-0 h-0 w-0"
      data-render-layer={layer.nodeId}
      style={style}
    >
      <CanvasRenderItems items={layer.children} />
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

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 h-0 w-0 origin-top-left"
      data-presentation-node-id={layer.nodeId}
      ref={presentationRef}
    >
      {clip ? (
        <ArtboardClip clip={clip}>{effectLayer}</ArtboardClip>
      ) : (
        effectLayer
      )}
    </div>
  );
});

// `overflow: clip` is a plain rect clip the compositor applies natively, and
// unlike `overflow: hidden` it never makes the box scrollable.
const ArtboardClip = ({
  children,
  clip,
}: {
  children: ReactNode;
  clip: NonNullable<RenderLayer["clip"]>;
}) => {
  return (
    <div
      className="pointer-events-none absolute"
      data-render-clip={true}
      style={{
        height: clip.height,
        left: clip.minX,
        overflow: "clip",
        top: clip.minY,
        width: clip.width,
      }}
    >
      <div
        className="pointer-events-none absolute h-0 w-0"
        style={{ left: -clip.minX, top: -clip.minY }}
      >
        {children}
      </div>
    </div>
  );
};

export const CanvasRenderItems = ({ items }: { items: RenderItem[] }) => {
  return items.map((item) => {
    if (item.kind === "layer") {
      return <CanvasRenderLayer key={item.nodeId} layer={item} />;
    }

    return <CanvasNode key={item.nodeId} nodeId={item.nodeId} />;
  });
};
