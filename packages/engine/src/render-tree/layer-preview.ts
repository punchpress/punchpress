import type { Bounds } from "../appearance/appearance-types";
import type { EffectPresentation } from "../effects/effect-filter";
import { getNodeEffects } from "../effects/effect-model";
import { scaleEffects } from "../effects/effect-transform";
import { unionBounds } from "./output-ink";

// How a render layer's effects and clip present during a transform preview,
// decided by the gesture's presentation plan:
// - a layer carried by a moving presentation root keeps its base effects
//   and ink, since its input is unchanged in its own coordinate space
// - a stationary layer holding moving content widens its filter ink (in
//   512-unit steps) to cover the preview, and a group resized as a whole
//   previews its scaled shadows
// - any other layer keeps its base effects
// Equal results keep their identity, so a layer re-renders only when its
// presentation actually changes.

export const getLayerPreviewEffects = (
  editor,
  layerId: string,
  layerEffects: EffectPresentation | null
): EffectPresentation | null => {
  const effects = withSelectionColorPreview(editor, layerId, layerEffects);
  const preview = editor.selectionDragPreview;

  if (
    !(
      effects &&
      preview &&
      editor.getPreviewPresentationPlan(preview).affectedLayerIds.has(layerId)
    )
  ) {
    return effects;
  }

  const moved = getPreviewedBounds(preview, effects.ink);
  const scale = preview.resize?.scale;
  // A group resized as a whole scales its shadows at commit; preview the same.
  const scaled =
    Number.isFinite(scale) && preview.nodeIdSet?.has(layerId)
      ? scaleEffects(effects.effects, scale)
      : effects.effects;

  return keepIdentity(editor, layerId, {
    effects: scaled,
    ink: moved ? widenInSteps(effects.ink, moved) : effects.ink,
  });
};

// An artboard whose content falls back to per-shell previews (it is dragged
// but not carried by its own moving layer) moves its clip with the drag.
export const getLayerPreviewClip = (
  editor,
  layerId: string,
  clip: Bounds | null
): Bounds | null => {
  const preview = editor.selectionDragPreview;

  if (
    !(clip && preview?.delta && preview.nodeIdSet?.has(layerId)) ||
    editor.getPreviewPresentationPlan(preview).carriedLayerIds.has(layerId)
  ) {
    return clip;
  }

  return translate(clip, preview.delta.x || 0, preview.delta.y || 0);
};

// A live selection-color edit recolors the layer's shadows; colors never
// change the filter region, so the ink stays.
const withSelectionColorPreview = (
  editor,
  layerId: string,
  effects: EffectPresentation | null
): EffectPresentation | null => {
  if (!(effects && editor.selectionColorPreviewState)) {
    return effects;
  }

  const node = editor.getNode(layerId);
  const paintNode = editor.getPaintNode(layerId);

  if (!node || paintNode === node) {
    return effects;
  }

  const previewById = new Map(
    getNodeEffects(paintNode).map((effect) => [effect.id, effect])
  );

  return {
    ...effects,
    effects: effects.effects.map((effect) => {
      const previewEffect = previewById.get(effect.id);

      return previewEffect
        ? {
            ...effect,
            color: previewEffect.color,
            opacity: previewEffect.opacity,
          }
        : effect;
    }),
  };
};

const lastPreviewByEditor = new WeakMap<
  object,
  Map<string, EffectPresentation>
>();

// Widened ink only changes when content crosses a step, so most preview
// frames produce a value equal to the last one; return that object instead.
const keepIdentity = (
  editor,
  layerId: string,
  next: EffectPresentation
): EffectPresentation => {
  let lastByLayer = lastPreviewByEditor.get(editor);

  if (!lastByLayer) {
    lastByLayer = new Map();
    lastPreviewByEditor.set(editor, lastByLayer);
  }

  const last = lastByLayer.get(layerId);

  if (
    last &&
    haveSameBounds(last.ink, next.ink) &&
    (last.effects === next.effects ||
      JSON.stringify(last.effects) === JSON.stringify(next.effects))
  ) {
    return last;
  }

  lastByLayer.set(layerId, next);

  return next;
};

const haveSameBounds = (left: Bounds, right: Bounds) => {
  return (
    left.minX === right.minX &&
    left.minY === right.minY &&
    left.maxX === right.maxX &&
    left.maxY === right.maxY
  );
};

// Where the layer's ink could be during this preview: moved by a drag delta,
// scaled about a resize anchor, or covering a resize frame.
const getPreviewedBounds = (preview, ink: Bounds): Bounds | null => {
  if (preview.delta) {
    return translate(ink, preview.delta.x || 0, preview.delta.y || 0);
  }

  const resize = preview.resize;

  if (resize?.anchorCanvas && Number.isFinite(resize.scale)) {
    const { x, y } = resize.anchorCanvas;
    const scale = Math.abs(resize.scale);

    return {
      height: ink.height * scale,
      maxX: x + (ink.maxX - x) * scale,
      maxY: y + (ink.maxY - y) * scale,
      minX: x + (ink.minX - x) * scale,
      minY: y + (ink.minY - y) * scale,
      width: ink.width * scale,
    };
  }

  return resize?.frame?.bounds ?? null;
};

const translate = (bounds: Bounds, dx: number, dy: number): Bounds => ({
  ...bounds,
  maxX: bounds.maxX + dx,
  maxY: bounds.maxY + dy,
  minX: bounds.minX + dx,
  minY: bounds.minY + dy,
});

// Widens in coarse steps so a drag rebuilds the filter only when content
// crosses a step, not on every frame.
const PREVIEW_INK_STEP = 512;

const widenInSteps = (ink: Bounds, moved: Bounds): Bounds => {
  const union = unionBounds([ink, moved]) ?? ink;
  const grow = (from: number, to: number, direction: 1 | -1) => {
    const distance = Math.abs(to - from);

    return (
      from +
      direction * Math.ceil(distance / PREVIEW_INK_STEP) * PREVIEW_INK_STEP
    );
  };
  const minX = grow(ink.minX, union.minX, -1);
  const minY = grow(ink.minY, union.minY, -1);
  const maxX = grow(ink.maxX, union.maxX, 1);
  const maxY = grow(ink.maxY, union.maxY, 1);

  return { height: maxY - minY, maxX, maxY, minX, minY, width: maxX - minX };
};
