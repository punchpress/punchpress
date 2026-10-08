import { hasPointerMovedAtLeast, round } from "@punchpress/engine";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorSelectionDragSurfaceValue } from "../../editor-react/use-editor-selection-drag-surface-value";

const ARTBOARD_LABEL_GAP_PX = 28;
const MIN_LABEL_ZOOM = 0.01;

const formatArtboardSize = (bounds) => {
  return `${Math.round(bounds.width)} x ${Math.round(bounds.height)}px`;
};

const getCanvasPoint = (editor, clientX, clientY) => {
  const viewer = editor.viewerRef;
  const host = editor.hostRef;

  if (!(viewer && host)) {
    return { x: 0, y: 0 };
  }

  const rect = host.getBoundingClientRect();

  return {
    x: viewer.getScrollLeft() + (clientX - rect.left) / editor.zoom,
    y: viewer.getScrollTop() + (clientY - rect.top) / editor.zoom,
  };
};

// Primitive per-artboard values keep unrelated document edits from
// re-rendering artboard chrome.
const selectArtboardIds = (editor) => {
  return editor.nodes
    .filter((node) => node.type === "artboard")
    .filter((node) => editor.isNodeEffectivelyVisible(node.id))
    .map((node) => node.id);
};

const selectArtboard = (editor, state, nodeId) => {
  const node = editor.getNode(nodeId);
  const bounds = editor.getNodeRenderFrame(nodeId)?.bounds;

  if (!(node && bounds)) {
    return null;
  }

  const zoom = Math.max(state.viewport.zoom, MIN_LABEL_ZOOM);
  const previewDelta = editor.selectionDragPreview?.nodeIds?.includes(nodeId)
    ? editor.selectionDragPreview.delta
    : { x: 0, y: 0 };

  return {
    background: node.background,
    height: bounds.height,
    labelScale: 1 / zoom,
    labelYOffset: ARTBOARD_LABEL_GAP_PX / zoom,
    minX: bounds.minX + previewDelta.x,
    minY: bounds.minY + previewDelta.y,
    name: node.name,
    selected: editor.isSelected(nodeId),
    width: bounds.width,
  };
};

const useArtboard = (nodeId) => {
  return useEditorSelectionDragSurfaceValue((editor, state) =>
    selectArtboard(editor, state, nodeId)
  );
};

const startArtboardLabelDrag = ({ editor, event, nodeId }) => {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const wasSelected = editor.isSelected(nodeId);
  const isAdditiveSelection = event.shiftKey;
  const shouldDuplicate = event.altKey;

  if (!isAdditiveSelection) {
    editor.ensureSelected(nodeId);
  }

  const startClientPoint = {
    x: event.clientX,
    y: event.clientY,
  };
  let previousCanvasPoint = getCanvasPoint(
    editor,
    event.clientX,
    event.clientY
  );
  let dragSession: ReturnType<typeof editor.beginSelectionDrag> = null;

  const handlePointerMove = (moveEvent) => {
    if (isAdditiveSelection) {
      return;
    }

    if (
      !(
        dragSession ||
        hasPointerMovedAtLeast(
          startClientPoint,
          { x: moveEvent.clientX, y: moveEvent.clientY },
          "pointerDrag"
        )
      )
    ) {
      return;
    }

    if (!dragSession) {
      dragSession = editor.beginSelectionDrag({
        duplicate: shouldDuplicate,
        nodeId,
      });
    }

    if (!dragSession) {
      return;
    }

    const nextCanvasPoint = getCanvasPoint(
      editor,
      moveEvent.clientX,
      moveEvent.clientY
    );

    editor.updateSelectionDrag(dragSession, {
      delta: {
        x: round(nextCanvasPoint.x - previousCanvasPoint.x, 2),
        y: round(nextCanvasPoint.y - previousCanvasPoint.y, 2),
      },
      queueRefresh: true,
    });

    previousCanvasPoint = nextCanvasPoint;
  };

  const handlePointerEnd = () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointercancel", handlePointerEnd);
    window.removeEventListener("pointerup", handlePointerEnd);

    if (dragSession) {
      editor.endSelectionDrag(dragSession);
      return;
    }

    if (isAdditiveSelection) {
      editor.toggleSelection(nodeId);
      return;
    }

    if (!wasSelected) {
      editor.select(nodeId);
    }
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointercancel", handlePointerEnd);
  window.addEventListener("pointerup", handlePointerEnd);
};

export const CanvasArtboards = () => {
  const artboardIds = useEditorSelectionDragSurfaceValue(selectArtboardIds);

  return (
    <>
      <div className="pointer-events-none absolute inset-0">
        {artboardIds.map((nodeId) => (
          <CanvasArtboardBody key={nodeId} nodeId={nodeId} />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        {artboardIds.map((nodeId) => (
          <CanvasArtboardLabel key={nodeId} nodeId={nodeId} />
        ))}
      </div>
    </>
  );
};

const CanvasArtboardBody = ({ nodeId }) => {
  const artboard = useArtboard(nodeId);

  if (!artboard) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto absolute border border-[var(--designer-border)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
      data-artboard-body={nodeId}
      style={{
        backgroundColor: artboard.background || "transparent",
        height: `${artboard.height}px`,
        left: `${artboard.minX}px`,
        top: `${artboard.minY}px`,
        width: `${artboard.width}px`,
      }}
    />
  );
};

const CanvasArtboardLabel = ({ nodeId }) => {
  const editor = useEditor();
  const artboard = useArtboard(nodeId);

  if (!artboard) {
    return null;
  }

  const sizeLabel = formatArtboardSize(artboard);

  return (
    <button
      className="canvas-node canvas-cursor-grab group pointer-events-auto absolute flex h-6 max-w-96 appearance-none items-center gap-2 rounded-[3px] bg-transparent px-1 py-0 text-left font-medium text-[12px] text-foreground/64 leading-none outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[selected=true]:text-foreground"
      data-node-id={nodeId}
      data-selected={artboard.selected ? "true" : "false"}
      onPointerDown={(event) =>
        startArtboardLabelDrag({
          editor,
          event,
          nodeId,
        })
      }
      style={{
        left: `${artboard.minX}px`,
        top: `${artboard.minY - artboard.labelYOffset}px`,
        transform: `scale(${artboard.labelScale})`,
        transformOrigin: "top left",
      }}
      title={`${artboard.name} - ${sizeLabel}`}
      type="button"
    >
      <span className="truncate">{artboard.name}</span>
      <span className="shrink-0 font-normal text-foreground/38 group-data-[selected=true]:text-foreground/52">
        {sizeLabel}
      </span>
    </button>
  );
};
