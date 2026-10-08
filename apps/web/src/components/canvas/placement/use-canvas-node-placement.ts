import { measurePerf, PERF_SPANS } from "@punchpress/engine";
import { useLayoutEffect, useRef } from "react";
import { useEditor } from "../../../editor-react/use-editor";
import {
  createPlacementState,
  invalidateNodeShells,
  syncDurableNodeShells,
} from "./durable-placement";
import {
  applyPreviewSession,
  beginPreviewSession,
  endPreviewSession,
  type PreviewSession,
} from "./preview-presentation";

// Places shells durably after store writes, and moves a gesture's resolved
// presentation roots during transform previews. A gesture keeps its last
// preview until a pre-paint handoff applies committed (or restored) durable
// placement and clears the moving roots in one step.
export const useCanvasNodePlacement = (placedNodeIds: readonly string[]) => {
  const editor = useEditor();
  const placedNodeIdsRef = useRef(placedNodeIds);
  const placementStateRef = useRef(createPlacementState());
  const sessionRef = useRef<PreviewSession | null>(null);

  placedNodeIdsRef.current = placedNodeIds;

  useLayoutEffect(() => {
    let durableFrameId = 0;
    let handoffFrameId = 0;
    let isDisposed = false;

    const syncDurablePlacement = () => {
      durableFrameId = 0;

      if (isDisposed) {
        return;
      }

      measurePerf(PERF_SPANS.renderPlacementDurable, () => {
        syncDurableNodeShells(
          editor,
          placedNodeIdsRef.current,
          placementStateRef.current,
          sessionRef.current
        );
      });
      editor.notifyPlacementSurfaceApplied();
    };

    const handOff = () => {
      window.cancelAnimationFrame(handoffFrameId);
      handoffFrameId = 0;

      const session = sessionRef.current;

      if (!session || isDisposed) {
        return;
      }

      sessionRef.current = null;
      measurePerf(PERF_SPANS.renderPlacementHandoff, () => {
        invalidateNodeShells(
          session.shells.map((entry) => entry.nodeId),
          placementStateRef.current
        );
        syncDurableNodeShells(
          editor,
          placedNodeIdsRef.current,
          placementStateRef.current,
          null
        );
        endPreviewSession(session);
      });
      editor.notifyPlacementSurfaceApplied();
    };

    const syncPreviewPlacement = () => {
      if (isDisposed) {
        return;
      }

      const preview = editor.selectionDragPreview;
      const plan = hasTransform(preview)
        ? editor.getPreviewPresentationPlan(preview)
        : null;

      if (!plan?.targets.length) {
        // Commit writes the store after clearing the preview, so the last
        // preview stays up until the next frame's handoff.
        if (sessionRef.current) {
          handoffFrameId ||= window.requestAnimationFrame(handOff);
        } else {
          syncDurablePlacement();
        }

        return;
      }

      // A new gesture (or a changed membership) retires the previous roots
      // first, including one still waiting for its handoff frame.
      if (
        handoffFrameId ||
        (sessionRef.current && sessionRef.current.plan !== plan)
      ) {
        handOff();
      }

      sessionRef.current ??= beginPreviewSession(plan);

      const session = sessionRef.current;
      const didApply = measurePerf(PERF_SPANS.renderPlacementPreview, () =>
        applyPreviewSession(editor, session, preview, placementStateRef.current)
      );

      if (didApply) {
        // Exact raster measures its screen matrix after roots move.
        editor.notifyPlacementSurfaceApplied();
      }
    };

    const scheduleDurableSync = () => {
      if (!(isDisposed || durableFrameId)) {
        durableFrameId = window.requestAnimationFrame(syncDurablePlacement);
      }
    };

    syncDurablePlacement();
    syncPreviewPlacement();

    // Shells sit in world space, so a camera-only store write moves none.
    const unsubscribeStore = editor.store.subscribe((state, previousState) => {
      if (!isCameraOnlyChange(state, previousState)) {
        scheduleDurableSync();
      }
    });
    const unsubscribePreview =
      editor.subscribeSelectionDragPreview(syncPreviewPlacement);

    return () => {
      handOff();
      isDisposed = true;
      window.cancelAnimationFrame(durableFrameId);
      unsubscribePreview();
      unsubscribeStore();
    };
  }, [editor]);

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      measurePerf(PERF_SPANS.renderPlacementDurable, () => {
        syncDurableNodeShells(
          editor,
          placedNodeIds,
          placementStateRef.current,
          sessionRef.current
        );
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [editor, placedNodeIds]);
};

const hasTransform = (preview) => {
  return Boolean(
    preview?.nodeIds?.length &&
      (preview.delta || preview.resize || preview.rotate)
  );
};

const isCameraOnlyChange = (state, previousState) => {
  for (const key in state) {
    if (key !== "viewport" && state[key] !== previousState[key]) {
      return false;
    }
  }

  return true;
};
