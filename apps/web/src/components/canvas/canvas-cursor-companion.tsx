import { useCallback, useEffect, useRef } from "react";
import { useEditorSurfaceValue } from "../../editor-react/use-editor-surface-value";
import { getCanvasCursorCompanion } from "./canvas-cursor-state";

const HIDDEN_CURSOR_COMPANION_TRANSFORM = "translate(-9999px, -9999px)";

const getCursorCompanionTransform = (point, companion) => {
  const offsetX = companion.offsetX || 0;
  const offsetY = companion.offsetY || 0;

  return `translate(${Math.round(point.x + offsetX)}px, ${Math.round(point.y + offsetY)}px)`;
};

export const CanvasCursorCompanion = ({ hostElement }) => {
  const companion = useEditorSurfaceValue(getCanvasCursorCompanion);
  const companionRef = useRef(companion);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const companionKey = companion
    ? `${companion.kind}:${companion.text}:${companion.offsetX || 0}:${companion.offsetY || 0}`
    : null;

  companionRef.current = companion;

  const syncPosition = useCallback((point = pointerRef.current) => {
    const element = elementRef.current;
    const currentCompanion = companionRef.current;

    if (!element) {
      return;
    }

    element.style.transform =
      point && currentCompanion
        ? getCursorCompanionTransform(point, currentCompanion)
        : HIDDEN_CURSOR_COMPANION_TRANSFORM;
  }, []);

  useEffect(() => {
    if (!companionKey) {
      syncPosition();
      return;
    }

    syncPosition();
  }, [companionKey, syncPosition]);

  useEffect(() => {
    if (!hostElement) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = hostElement.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      pointerRef.current = point;
      syncPosition(point);
    };

    const handlePointerLeave = () => {
      pointerRef.current = null;
      syncPosition(null);
    };

    hostElement.addEventListener("pointermove", handlePointerMove);
    hostElement.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      hostElement.removeEventListener("pointermove", handlePointerMove);
      hostElement.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [hostElement, syncPosition]);

  if (!companion) {
    return null;
  }

  return (
    <div
      className="canvas-cursor-companion pointer-events-none absolute top-0 left-0 z-40"
      data-testid="canvas-pen-hover-tooltip"
      ref={elementRef}
      style={{
        transform: HIDDEN_CURSOR_COMPANION_TRANSFORM,
        willChange: "transform",
      }}
    >
      {companion.kind === "label" ? (
        <div className="canvas-cursor-companion-label rounded-[5px] bg-neutral-800 px-[7px] py-[3px] font-medium text-[10.5px] text-white leading-tight tracking-[0.01em] shadow-[0_1px_3px_rgba(0,0,0,0.2),0_0_0_0.5px_rgba(0,0,0,0.12)]">
          {companion.text}
        </div>
      ) : null}
    </div>
  );
};
