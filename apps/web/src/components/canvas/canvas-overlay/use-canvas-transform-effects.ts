import { useEffect, useLayoutEffect } from "react";
import { getTargetClientBounds } from "./canvas-overlay-geometry";
import {
  queueMoveableRefresh,
  setGroupRotationPreviewActive,
  setMoveableMuted,
} from "./canvas-overlay-interactions";

export const useCanvasTransformEffects = ({
  activeTool,
  editingNodeId,
  hostElement,
  isGroupRotationPreviewVisible,
  moveableRef,
  selectedTarget,
  selectedTargets,
  selectionFrameKey,
  viewportRevision,
}) => {
  const moveable = moveableRef.current;

  useLayoutEffect(() => {
    if (!(selectedTargets.length > 0 && moveable && selectionFrameKey)) {
      return;
    }

    moveable.updateRect?.();
  }, [moveable, selectedTargets, selectionFrameKey]);

  useLayoutEffect(() => {
    if (!(moveable && viewportRevision >= 0)) {
      return;
    }

    moveable.updateRect?.();
  }, [moveable, viewportRevision]);

  useEffect(() => {
    if (!hostElement) {
      return;
    }

    const clientBounds =
      selectedTargets.length > 1
        ? getTargetClientBounds(selectedTargets)
        : selectedTarget?.getBoundingClientRect?.() || null;
    const minDimension = clientBounds
      ? Math.min(clientBounds.width, clientBounds.height)
      : 0;
    const offset = Math.min(36, Math.max(12, minDimension * 0.18));

    hostElement.style.setProperty("--canvas-rotation-offset", `${offset}px`);

    return () => {
      hostElement.style.removeProperty("--canvas-rotation-offset");
    };
  }, [hostElement, selectedTarget, selectedTargets]);

  useEffect(() => {
    if (!hostElement) {
      return;
    }

    if (
      selectedTargets.length === 0 ||
      editingNodeId ||
      activeTool !== "pointer"
    ) {
      setMoveableMuted(hostElement, false);
    }

    return () => {
      setMoveableMuted(hostElement, false);
    };
  }, [activeTool, editingNodeId, hostElement, selectedTargets.length]);

  useEffect(() => {
    if (!hostElement) {
      return;
    }

    if (!isGroupRotationPreviewVisible) {
      setGroupRotationPreviewActive(hostElement, false);
    }

    return () => {
      setGroupRotationPreviewActive(hostElement, false);
    };
  }, [hostElement, isGroupRotationPreviewVisible]);

  return {
    queueMoveableRefresh: () => queueMoveableRefresh(moveableRef),
  };
};
