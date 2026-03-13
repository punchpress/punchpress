import { estimateBounds } from "../../../editor/shapes/warp-text/warp-layout";
import {
  applyGroupDragUpdate,
  applySingleDragUpdate,
} from "./canvas-overlay-drag";
import { setMoveableMuted } from "./canvas-overlay-interactions";

export const getCanvasDragHandlers = ({
  editor,
  hostElement,
  queueRefresh,
  restoreHover,
  selectedNode,
  suppressHover,
  visibleSelectedNodeIds,
}) => {
  return {
    onDrag: (event) => {
      if (!selectedNode) {
        return;
      }

      setMoveableMuted(hostElement, true);
      applySingleDragUpdate(editor, selectedNode.id, event);
    },
    onDragEnd: (event) => {
      if (selectedNode && event.lastEvent) {
        applySingleDragUpdate(editor, selectedNode.id, event.lastEvent);
      }

      restoreHover();
      setMoveableMuted(hostElement, false);
      editor.endHistoryTransaction();
      queueRefresh();
    },
    onDragGroup: (event) => {
      if (visibleSelectedNodeIds.length === 0) {
        return;
      }

      setMoveableMuted(hostElement, true);
      applyGroupDragUpdate(editor, visibleSelectedNodeIds, event.events);
    },
    onDragGroupEnd: (event) => {
      const lastEvents = event.events
        .map((groupEvent) => groupEvent.lastEvent)
        .filter(Boolean);

      if (lastEvents.length > 0) {
        applyGroupDragUpdate(editor, visibleSelectedNodeIds, lastEvents);
      }

      restoreHover();
      setMoveableMuted(hostElement, false);
      editor.endHistoryTransaction();
      queueRefresh();
    },
    onDragGroupStart: (event) => {
      editor.beginHistoryTransaction();
      suppressHover();

      for (const groupEvent of event.events) {
        const nodeId = groupEvent.target?.dataset.nodeId;
        const node = editor.getNode(nodeId);

        groupEvent.datas.bbox =
          node &&
          (editor.getNodeGeometry(nodeId)?.bbox || estimateBounds(node));
      }
    },
    onDragStart: () => {
      editor.beginHistoryTransaction();
      suppressHover();
    },
  };
};
