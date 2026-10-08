import type { RenderLayer } from "@punchpress/engine";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { useEditor } from "../../editor-react/use-editor";

type LayerComposite = Pick<RenderLayer, "clip" | "effects">;

const noSubscription = () => () => undefined;

// A layer's filter ink and clip as the current selection preview needs them.
// Only layers with effects or a clip subscribe to previews, and the value is
// cached per preview revision, so unrelated layers never re-render during a
// drag and affected ones re-render once per preview change.
export const useLayerComposite = (layer: RenderLayer): LayerComposite => {
  const editor = useEditor();
  const composited = Boolean(layer.effects || layer.clip);
  const cache = useRef<{
    key: unknown[];
    value: LayerComposite;
  } | null>(null);
  const subscribe = useCallback(
    (listener: () => void) => {
      return composited
        ? editor.subscribeSelectionDragPreview(listener)
        : noSubscription();
    },
    [composited, editor]
  );
  const getSnapshot = () => {
    const key = [
      composited ? editor.getSelectionDragPreviewRevision() : 0,
      layer.effects,
      layer.clip,
    ];
    const cached = cache.current;

    if (cached?.key.every((part, index) => part === key[index])) {
      return cached.value;
    }

    const effects = editor.getLayerPreviewEffects(layer.nodeId, layer.effects);
    const clip = editor.getLayerPreviewClip(layer.nodeId, layer.clip);
    const value =
      cached && cached.value.effects === effects && cached.value.clip === clip
        ? cached.value
        : { clip, effects };

    cache.current = { key, value };

    return value;
  };

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
