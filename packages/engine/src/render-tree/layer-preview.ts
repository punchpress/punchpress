import type { Bounds } from "../appearance/appearance-types";
import type { EffectPresentation } from "../effects/effect-filter";
import { getNodeEffects } from "../effects/effect-model";
import { scaleEffects } from "../effects/effect-transform";
import { unionBounds } from "./output-ink";

// Group and artboard layers never move during previews (previews move leaf
// shells), so their stage-space filter regions and clips would cut off
// previewed content. These widen a layer's filter ink to cover the preview,
// and move an artboard's clip with its own drag.

export const getLayerPreviewEffects = (
  editor,
  layerId: string,
  layerEffects: EffectPresentation | null
): EffectPresentation | null => {
  const effects = withSelectionColorPreview(editor, layerId, layerEffects);
  const preview = editor.selectionDragPreview;

  if (!(effects && preview && previewTouches(editor, preview, layerId))) {
    return effects;
  }

  const moved = getPreviewedBounds(preview, effects.ink);
  const scale = preview.resize?.scale;
  // A group resized as a whole scales its shadows at commit; preview the same.
  const scaled =
    Number.isFinite(scale) && preview.nodeIdSet?.has(layerId)
      ? scaleEffects(effects.effects, scale)
      : effects.effects;

  return {
    effects: scaled,
    ink: moved ? widenInSteps(effects.ink, moved) : effects.ink,
  };
};

export const getLayerPreviewClip = (
  editor,
  layerId: string,
  clip: Bounds | null
): Bounds | null => {
  const preview = editor.selectionDragPreview;

  if (!(clip && preview?.delta && preview.nodeIdSet?.has(layerId))) {
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
        ? { ...effect, color: previewEffect.color, opacity: previewEffect.opacity }
        : effect;
    }),
  };
};

const previewTouches = (editor, preview, layerId: string) => {
  const ids: Iterable<string> = preview.nodeIdSet ?? preview.nodeIds ?? [];

  for (const nodeId of ids) {
    if (nodeId === layerId || editor.isDescendantOf(nodeId, layerId)) {
      return true;
    }
  }

  return false;
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
