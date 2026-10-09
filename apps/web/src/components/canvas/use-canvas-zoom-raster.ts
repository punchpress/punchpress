import { incrementPerfCounter, PERF_COUNTERS } from "@punchpress/engine";
import { useLayoutEffect } from "react";
import { useEditor } from "../../editor-react/use-editor";
import { getPresentationElement } from "./placement/presentation-elements";
import { getPlacementElements } from "./placement/shell-state";

interface HintedRoot {
  element: HTMLElement;
  previousWillChange: string;
}

// Raster reuse during a continuous zoom. While the engine reports one,
// each top-level art root (artboard and top-level group presentation
// wrappers, and loose top-level shells) carries `will-change: transform`, so
// Chromium keeps its existing raster scale and scales those pixels with the
// camera instead of re-rastering art and filters every frame. Grids, labels,
// overlays, and text input sit outside these roots and stay exact. When the
// zoom ends or is interrupted, the hints come off in the same task, which
// asks Chromium for one exact raster at the final camera, and exact-raster
// consumers re-measure.
export const useCanvasZoomRaster = (hostElement: HTMLElement | null) => {
  const editor = useEditor();

  useLayoutEffect(() => {
    let hinted: HintedRoot[] = [];
    // Tracked apart from the roots: a zoom over an empty document hints
    // nothing but still marks the host and must clear it.
    let active = false;

    const release = () => {
      if (!active) {
        return;
      }

      active = false;

      for (const { element, previousWillChange } of hinted) {
        element.style.willChange = previousWillChange;
      }

      hinted = [];
      delete hostElement?.dataset.zoomRasterMode;
      editor.notifyPlacementSurfaceApplied();
    };

    const sync = () => {
      if (!editor.continuousZoom) {
        release();
        return;
      }

      if (active) {
        return;
      }

      active = true;
      hinted = getArtRoots(editor).map((element) => {
        const previousWillChange = element.style.willChange;

        element.style.willChange = "transform";

        return { element, previousWillChange };
      });

      if (hostElement) {
        hostElement.dataset.zoomRasterMode = "reuse";
      }

      incrementPerfCounter(PERF_COUNTERS.renderZoomReuseRoots, hinted.length);
    };

    const interrupt = (reason) => () => {
      editor.interruptContinuousZoom(reason);
    };
    const interruptOnBlur = interrupt("blur");
    const interruptOnPointerDown = interrupt("pointer-down");
    const interruptWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        editor.interruptContinuousZoom("hidden");
      }
    };
    const unsubscribe = editor.subscribeContinuousZoom(sync);

    sync();
    window.addEventListener("blur", interruptOnBlur);
    window.addEventListener("pointerdown", interruptOnPointerDown, true);
    document.addEventListener("visibilitychange", interruptWhenHidden);

    return () => {
      unsubscribe();
      window.removeEventListener("blur", interruptOnBlur);
      window.removeEventListener("pointerdown", interruptOnPointerDown, true);
      document.removeEventListener("visibilitychange", interruptWhenHidden);
      editor.interruptContinuousZoom("unmount");
      release();
    };
  }, [editor, hostElement]);
};

// One root per top-level render item, read from the engine render tree.
const getArtRoots = (editor): HTMLElement[] => {
  return editor.getRenderTree().items.flatMap((item) => {
    const element =
      item.kind === "layer"
        ? getPresentationElement(editor, item.nodeId)
        : getPlacementElements(editor, item.nodeId)?.shellElement;

    return element ? [element] : [];
  });
};
