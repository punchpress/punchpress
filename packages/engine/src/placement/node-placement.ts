import { finishEditingIfNeeded } from "../editing/editing-actions";
import { getNodePlacementCapabilities } from "../nodes/node-placement";
import { round } from "../primitives/math";
import { getArtboardParentPatch } from "./artboard-parent";
import { getErgonomicShapePatch } from "./ergonomic-starter-size";
import {
  fitFirstAddedNode,
  shouldFitFirstAddedNode,
} from "./first-add-fit";

const PLACEMENT_DRAG_THRESHOLD_PX = 3;

const getBoxPlacementBounds = (
  originPoint,
  currentPoint,
  { preserveAspectRatio = false } = {}
) => {
  const deltaX = currentPoint.x - originPoint.x;
  const deltaY = currentPoint.y - originPoint.y;
  let width = Math.max(1, Math.abs(deltaX));
  let height = Math.max(1, Math.abs(deltaY));

  if (preserveAspectRatio) {
    const size = Math.max(width, height);
    width = size;
    height = size;
  }

  const minX = deltaX >= 0 ? originPoint.x : originPoint.x - width;
  const minY = deltaY >= 0 ? originPoint.y : originPoint.y - height;

  return {
    centerX: round(minX + width / 2, 2),
    centerY: round(minY + height / 2, 2),
    height: round(height, 2),
    width: round(width, 2),
  };
};

const beginShapePlacement = (editor, { point, shape }) => {
  finishEditingIfNeeded(editor);

  const historyMark = editor.markHistoryStep("add shape");
  if (!historyMark) {
    return null;
  }

  let hasDragged = false;
  let nodeId: string | null = null;
  const shouldFit = shouldFitFirstAddedNode(editor);

  const createShapeNode = (centerPoint, patch = null) => {
    const nextNodeId = editor.getState().addShapeNode(centerPoint, shape, {
      activatePointer: false,
      patch: mergePlacementPatches(
        getArtboardParentPatch(editor, centerPoint),
        patch
      ),
    });

    if (!nextNodeId) {
      editor.revertToMark(historyMark);
      return null;
    }

    nodeId = nextNodeId;
    return nodeId;
  };

  const applyPlacementPoint = (
    nextPoint,
    { dragDistancePx = 0, preserveAspectRatio = false } = {}
  ) => {
    if (!hasDragged && dragDistancePx < PLACEMENT_DRAG_THRESHOLD_PX) {
      return false;
    }

    if (!nextPoint) {
      return false;
    }

    const nextBounds = getBoxPlacementBounds(point, nextPoint, {
      preserveAspectRatio,
    });
    hasDragged = true;

    if (!nodeId) {
      return Boolean(
        createShapeNode(
          { x: nextBounds.centerX, y: nextBounds.centerY },
          {
            height: nextBounds.height,
            width: nextBounds.width,
          }
        )
      );
    }

    if (!editor.getNode(nodeId)) {
      return false;
    }

    editor.updateNode(nodeId, {
      height: nextBounds.height,
      transform: {
        x: nextBounds.centerX,
        y: nextBounds.centerY,
      },
      width: nextBounds.width,
    });
    return true;
  };

  return {
    cancel: () => {
      editor.setActiveTool("pointer");
      return editor.revertToMark(historyMark);
    },
    complete: ({
      dragDistancePx = 0,
      point: nextPoint,
      preserveAspectRatio = false,
    } = {}) => {
      const placementApplied = applyPlacementPoint(nextPoint, {
        dragDistancePx,
        preserveAspectRatio,
      });

      if (!(placementApplied || nodeId)) {
        createShapeNode(point, getErgonomicShapePatch(editor, point, shape));
      }

      editor.setActiveTool("pointer");
      const didCommit = editor.commitHistoryStep(historyMark);

      if (shouldFit && nodeId) {
        fitFirstAddedNode(editor, nodeId);
      }

      return didCommit;
    },
    update: ({
      dragDistancePx = 0,
      point: nextPoint,
      preserveAspectRatio = false,
    } = {}) => {
      return applyPlacementPoint(nextPoint, {
        dragDistancePx,
        preserveAspectRatio,
      });
    },
  };
};

const beginVectorPlacement = (editor, { point }) => {
  finishEditingIfNeeded(editor);

  const historyMark = editor.markHistoryStep("add vector");
  if (!historyMark) {
    return null;
  }
  const shouldFit = shouldFitFirstAddedNode(editor);

  return {
    cancel: () => {
      editor.setActiveTool("pointer");
      return editor.revertToMark(historyMark);
    },
    complete: () => {
      const nodeId = editor.getState().addVectorNode(point, {
        activatePointer: false,
        patch: getArtboardParentPatch(editor, point),
      });

      if (!nodeId) {
        editor.revertToMark(historyMark);
        editor.setActiveTool("pointer");
        return false;
      }

      editor.setActiveTool("pointer");
      const didCommit = editor.commitHistoryStep(historyMark);

      if (shouldFit) {
        fitFirstAddedNode(editor, nodeId);
      }

      return didCommit;
    },
    update: () => false,
  };
};

const beginArtboardPlacement = (editor, { point }) => {
  finishEditingIfNeeded(editor);

  const historyMark = editor.markHistoryStep("add artboard");
  if (!historyMark) {
    return null;
  }
  const shouldFit = shouldFitFirstAddedNode(editor);

  return {
    cancel: () => {
      editor.setActiveTool("pointer");
      return editor.revertToMark(historyMark);
    },
    complete: () => {
      const nodeId = editor.getState().addArtboardNode(point, {
        activatePointer: false,
      });

      if (!nodeId) {
        editor.revertToMark(historyMark);
        editor.setActiveTool("pointer");
        return false;
      }

      editor.setActiveTool("pointer");
      const didCommit = editor.commitHistoryStep(historyMark);

      if (shouldFit) {
        fitFirstAddedNode(editor, nodeId);
      }

      return didCommit;
    },
    update: () => false,
  };
};

export const beginNodePlacement = (editor, { point, shape, type } = {}) => {
  const placementCapabilities = getNodePlacementCapabilities(type);

  if (!(placementCapabilities && point)) {
    return null;
  }

  if (type === "shape" && placementCapabilities.mode === "box-drag") {
    return beginShapePlacement(editor, {
      point,
      shape: shape || editor.nextShapeKind,
    });
  }

  if (type === "vector" && placementCapabilities.mode === "click") {
    return beginVectorPlacement(editor, { point });
  }

  if (type === "artboard" && placementCapabilities.mode === "click") {
    return beginArtboardPlacement(editor, { point });
  }

  return null;
};

const mergePlacementPatches = (...patches) => {
  const mergedPatch = Object.assign({}, ...patches.filter(Boolean));

  return Object.keys(mergedPatch).length > 0 ? mergedPatch : null;
};
