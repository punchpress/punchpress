import { getNodeRotation } from "../../../editor/shapes/warp-text/model";
import { estimateBounds } from "../../../editor/shapes/warp-text/warp-layout";
import { getSelectionCenter } from "./canvas-overlay-geometry";
import {
  setGroupRotationPreviewActive,
  setMoveableMuted,
} from "./canvas-overlay-interactions";
import {
  setRotateStartState,
  updateGroupRotation,
  updateSingleNodeRotation,
} from "./canvas-overlay-rotation";

export const getCanvasRotationHandlers = ({
  editor,
  hostElement,
  queueRefresh,
  restoreHover,
  selectedBounds,
  selectedGeometry,
  selectedNode,
  setIsGroupRotationPreviewVisible,
  suppressHover,
  visibleSelectedNodeIds,
}) => {
  return {
    onRotate: (event) => {
      updateSingleNodeRotation(editor, selectedNode, event);
    },
    onRotateEnd: () => {
      restoreHover();
      setMoveableMuted(hostElement, false);
      editor.endHistoryTransaction();
      queueRefresh();
    },
    onRotateGroup: (event) => {
      updateGroupRotation(editor, visibleSelectedNodeIds, event);
    },
    onRotateGroupEnd: () => {
      restoreHover();
      setMoveableMuted(hostElement, false);
      editor.endHistoryTransaction();
      queueRefresh();

      if (typeof window === "undefined") {
        setGroupRotationPreviewActive(hostElement, false);
        setIsGroupRotationPreviewVisible(false);
        return;
      }

      window.requestAnimationFrame(() => {
        setGroupRotationPreviewActive(hostElement, false);
        setIsGroupRotationPreviewVisible(false);
      });
    },
    onRotateGroupStart: (event) => {
      const selectionCenter = getSelectionCenter(selectedBounds);

      if (!selectionCenter) {
        return;
      }

      editor.beginHistoryTransaction();
      suppressHover();
      setMoveableMuted(hostElement, true);
      setGroupRotationPreviewActive(hostElement, true);
      setIsGroupRotationPreviewVisible(true);

      const baseNodes = new Map();

      for (const groupEvent of event.events) {
        const nodeId = groupEvent.target?.dataset.nodeId;
        const node = editor.getNode(nodeId);

        if (!node) {
          continue;
        }

        groupEvent.set(getNodeRotation(node) || 0);
        baseNodes.set(nodeId, {
          bbox: editor.getNodeGeometry(nodeId)?.bbox || estimateBounds(node),
          ...node,
        });
      }

      event.datas.baseNodes = baseNodes;
      event.datas.selectionCenter = selectionCenter;
    },
    onRotateStart: (event) => {
      if (!selectedNode) {
        return;
      }

      editor.beginHistoryTransaction();
      suppressHover();
      setMoveableMuted(hostElement, true);

      const bbox = selectedGeometry?.bbox || estimateBounds(selectedNode);
      setRotateStartState(event, selectedNode, bbox);
    },
  };
};
