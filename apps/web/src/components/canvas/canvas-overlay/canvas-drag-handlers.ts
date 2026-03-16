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
      if (!event.datas.moveSession) {
        return;
      }

      setMoveableMuted(hostElement, true);
      editor.updateMoveSelection(event.datas.moveSession, {
        left: event.left,
        top: event.top,
      });
    },
    onDragEnd: (event) => {
      if (event.datas.moveSession && event.lastEvent) {
        editor.updateMoveSelection(event.datas.moveSession, {
          left: event.lastEvent.left,
          top: event.lastEvent.top,
        });
      }

      restoreHover();
      setMoveableMuted(hostElement, false);
      editor.endHistoryTransaction();
      queueRefresh();
    },
    onDragGroup: (event) => {
      const moveSession =
        event.datas.moveSession || event.events[0]?.datas?.moveSession;

      if (!moveSession) {
        return;
      }

      setMoveableMuted(hostElement, true);
      editor.updateMoveSelection(moveSession, {
        dragEvents: event.events,
      });
    },
    onDragGroupEnd: (event) => {
      const moveSession =
        event.datas.moveSession || event.events[0]?.datas?.moveSession;
      const lastEvents = event.events
        .map((groupEvent) => groupEvent.lastEvent)
        .filter(Boolean);

      if (moveSession && lastEvents.length > 0) {
        editor.updateMoveSelection(moveSession, {
          dragEvents: lastEvents,
        });
      }

      restoreHover();
      setMoveableMuted(hostElement, false);
      editor.endHistoryTransaction();
      queueRefresh();
    },
    onDragGroupStart: (event) => {
      const moveSession = editor.beginMoveSelection({
        nodeIds: visibleSelectedNodeIds,
      });

      if (!moveSession) {
        return;
      }

      editor.beginHistoryTransaction();
      suppressHover();
      event.datas.moveSession = moveSession;

      for (const groupEvent of event.events) {
        groupEvent.datas.moveSession = moveSession;
      }
    },
    onDragStart: (event) => {
      const moveSession = selectedNode
        ? editor.beginMoveSelection({ nodeId: selectedNode.id })
        : null;

      if (!moveSession) {
        return;
      }

      editor.beginHistoryTransaction();
      suppressHover();
      event.datas.moveSession = moveSession;
    },
  };
};
