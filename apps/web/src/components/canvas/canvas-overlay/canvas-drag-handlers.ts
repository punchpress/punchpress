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
      if (!event.datas.dragSession) {
        return;
      }

      setMoveableMuted(hostElement, true);
      editor.updateNodeDragSession(event.datas.dragSession, {
        left: event.left,
        top: event.top,
      });
    },
    onDragEnd: (event) => {
      if (event.datas.dragSession && event.lastEvent) {
        editor.updateNodeDragSession(event.datas.dragSession, {
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
      const dragSession =
        event.datas.dragSession || event.events[0]?.datas?.dragSession;

      if (!dragSession) {
        return;
      }

      setMoveableMuted(hostElement, true);
      editor.updateGroupDragSession(dragSession, {
        dragEvents: event.events,
      });
    },
    onDragGroupEnd: (event) => {
      const dragSession =
        event.datas.dragSession || event.events[0]?.datas?.dragSession;
      const lastEvents = event.events
        .map((groupEvent) => groupEvent.lastEvent)
        .filter(Boolean);

      if (dragSession && lastEvents.length > 0) {
        editor.updateGroupDragSession(dragSession, {
          dragEvents: lastEvents,
        });
      }

      restoreHover();
      setMoveableMuted(hostElement, false);
      editor.endHistoryTransaction();
      queueRefresh();
    },
    onDragGroupStart: (event) => {
      const dragSession = editor.createGroupDragSession({
        nodeIds: visibleSelectedNodeIds,
      });

      if (!dragSession) {
        return;
      }

      editor.beginHistoryTransaction();
      suppressHover();
      event.datas.dragSession = dragSession;

      for (const groupEvent of event.events) {
        groupEvent.datas.dragSession = dragSession;
      }
    },
    onDragStart: (event) => {
      const dragSession = selectedNode
        ? editor.createNodeDragSession({ nodeId: selectedNode.id })
        : null;

      if (!dragSession) {
        return;
      }

      editor.beginHistoryTransaction();
      suppressHover();
      event.datas.dragSession = dragSession;
    },
  };
};
