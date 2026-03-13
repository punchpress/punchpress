import { estimateBounds } from "../../../editor/shapes/warp-text/warp-layout";
import {
  getResizePointer,
  getResizeSession,
  updateGroupResize,
  updateSingleNodeResize,
} from "./canvas-overlay-resize";

export const getCanvasResizeHandlers = ({
  editor,
  hostElement,
  queueRefresh,
  restoreHover,
  selectedGeometry,
  selectedNode,
  suppressHover,
  visibleSelectedNodeIds,
}) => {
  return {
    onResize: (event) => {
      updateSingleNodeResize(editor, selectedNode, event);
    },
    onResizeEnd: () => {
      restoreHover();
      editor.endHistoryTransaction();
      queueRefresh();
    },
    onResizeGroup: (event) => {
      updateGroupResize(editor, visibleSelectedNodeIds, event);
    },
    onResizeGroupEnd: () => {
      restoreHover();
      editor.endHistoryTransaction();
      queueRefresh();
    },
    onResizeGroupStart: (event) => {
      const pointer = getResizePointer(event);
      const resizeSession = getResizeSession(
        editor,
        hostElement,
        event.direction,
        pointer
      );

      if (!resizeSession) {
        return;
      }

      editor.beginHistoryTransaction();
      suppressHover();
      const baseNodes = new Map();

      for (const nodeId of visibleSelectedNodeIds) {
        const node = editor.getNode(nodeId);
        if (!node) {
          continue;
        }

        baseNodes.set(nodeId, { ...node });
      }

      event.datas.anchorCanvas = resizeSession.anchorCanvas;
      event.datas.anchorClient = resizeSession.anchorClient;
      event.datas.baseNodes = baseNodes;
      event.datas.startDistance = resizeSession.startDistance;
    },
    onResizeStart: (event) => {
      if (!selectedNode) {
        return;
      }

      const bbox = selectedGeometry?.bbox || estimateBounds(selectedNode);
      const pointer = getResizePointer(event);
      const resizeSession = getResizeSession(
        editor,
        hostElement,
        event.direction,
        pointer
      );

      if (!resizeSession) {
        return;
      }

      editor.beginHistoryTransaction();
      suppressHover();
      event.datas.baseBBox = bbox;
      event.datas.anchorCanvas = resizeSession.anchorCanvas;
      event.datas.anchorClient = resizeSession.anchorClient;
      event.datas.baseNode = { ...selectedNode };
      event.datas.direction = event.direction;
      event.datas.startDistance = resizeSession.startDistance;
    },
  };
};
