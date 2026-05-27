import { hasPointerMovedAtLeast, round } from "@punchpress/engine";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../editor-react/use-editor-surface-value";

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

const selectArtboards = (editor, state) => {
  const zoom = Math.max(state.viewport.zoom, MIN_LABEL_ZOOM);

  return {
    artboards: editor.nodes
      .filter((node) => node.type === "artboard")
      .filter((node) => editor.isNodeEffectivelyVisible(node.id))
      .map((node) => {
        const frame = editor.getNodeRenderFrame(node.id);
        const previewDelta = editor.selectionDragPreview?.nodeIds?.includes(
          node.id
        )
          ? editor.selectionDragPreview.delta
          : { x: 0, y: 0 };

        return {
          frame: frame
            ? {
                ...frame,
                bounds: {
                  ...frame.bounds,
                  maxX: frame.bounds.maxX + previewDelta.x,
                  maxY: frame.bounds.maxY + previewDelta.y,
                  minX: frame.bounds.minX + previewDelta.x,
                  minY: frame.bounds.minY + previewDelta.y,
                },
              }
            : null,
          id: node.id,
          name: node.name,
          background: node.background,
          selected: editor.isSelected(node.id),
        };
      })
      .filter((entry) => entry.frame?.bounds),
    labelScale: 1 / zoom,
    labelYOffset: ARTBOARD_LABEL_GAP_PX / zoom,
  };
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
  const editor = useEditor();
  const { artboards, labelScale, labelYOffset } =
    useEditorSurfaceValue(selectArtboards);

  return (
    <>
      <div className="pointer-events-none absolute inset-0">
        {artboards.map((artboard) => {
          const bounds = artboard.frame.bounds;

          return (
            <div
              className="pointer-events-auto absolute border border-[var(--designer-border)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
              data-artboard-body={artboard.id}
              key={artboard.id}
              style={{
                backgroundColor: artboard.background || "transparent",
                height: `${bounds.height}px`,
                left: `${bounds.minX}px`,
                top: `${bounds.minY}px`,
                width: `${bounds.width}px`,
              }}
            />
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        {artboards.map((artboard) => {
          const bounds = artboard.frame.bounds;
          const sizeLabel = formatArtboardSize(bounds);

          return (
            <button
              className="canvas-node canvas-cursor-grab group pointer-events-auto absolute flex h-6 max-w-96 appearance-none items-center gap-2 rounded-[3px] bg-transparent px-1 py-0 text-left font-medium text-[12px] text-foreground/64 leading-none outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[selected=true]:text-foreground"
              data-node-id={artboard.id}
              data-selected={artboard.selected ? "true" : "false"}
              key={artboard.id}
              onPointerDown={(event) =>
                startArtboardLabelDrag({
                  editor,
                  event,
                  nodeId: artboard.id,
                })
              }
              style={{
                left: `${bounds.minX}px`,
                top: `${bounds.minY - labelYOffset}px`,
                transform: `scale(${labelScale})`,
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
        })}
      </div>
    </>
  );
};
