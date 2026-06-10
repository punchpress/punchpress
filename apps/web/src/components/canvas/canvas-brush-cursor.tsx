import { useEffect, useState } from "react";
import { useEditorValue } from "../../editor-react/use-editor-value";

interface BrushCursorPosition {
  x: number;
  y: number;
}

const isRasterTool = (toolId: string) => {
  return toolId === "brush" || toolId === "eraser";
};

const isBrushCursorTarget = (target: EventTarget | null) => {
  return Boolean(
    target instanceof Element &&
      target.closest(
        [".canvas-surface", ".canvas-node", ".canvas-vector-paper"].join(",")
      )
  );
};

export const CanvasBrushCursor = ({
  hostElement,
}: {
  hostElement: HTMLDivElement | null;
}) => {
  const { activeTool, settings, zoom } = useEditorValue((editor, state) => {
    return {
      activeTool: state.activeTool,
      settings: editor.getBrushToolSettings(state.activeTool),
      zoom: state.viewport.zoom,
    };
  });
  const [position, setPosition] = useState<BrushCursorPosition | null>(null);

  useEffect(() => {
    if (!hostElement) {
      setPosition(null);
      return;
    }

    let frameId = 0;
    let pendingPosition: BrushCursorPosition | null = null;

    const flushPosition = () => {
      frameId = 0;
      setPosition(pendingPosition);
    };

    const schedulePosition = (nextPosition: BrushCursorPosition | null) => {
      pendingPosition = nextPosition;

      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(flushPosition);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isBrushCursorTarget(event.target)) {
        schedulePosition(null);
        return;
      }

      const rect = hostElement.getBoundingClientRect();
      schedulePosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    const handlePointerLeave = () => {
      schedulePosition(null);
    };

    hostElement.addEventListener("pointermove", handlePointerMove, true);
    hostElement.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      hostElement.removeEventListener("pointermove", handlePointerMove, true);
      hostElement.removeEventListener("pointerleave", handlePointerLeave);

      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [hostElement]);

  if (!(position && settings && isRasterTool(activeTool))) {
    return null;
  }

  const size = Math.max(2, settings.size * zoom);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-40 rounded-full border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.75),0_0_3px_rgba(0,0,0,0.35)]"
      data-testid="brush-cursor"
      style={{
        height: size,
        transform: `translate(${position.x}px, ${position.y}px) translate(-50%, -50%)`,
        width: size,
      }}
    />
  );
};
