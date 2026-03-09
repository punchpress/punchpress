import { useEffect, useRef } from "react";
import { useEditor } from "../../editor/use-editor";
import { useEditorValue } from "../../editor/use-editor-value";

const getEditorFrame = (geometry, metrics, node, text) => {
  if (geometry?.bbox) {
    const { maxX, maxY, minX, minY } = geometry.bbox;

    return {
      height: Math.max(24, maxY - minY),
      width: Math.max(24, maxX - minX),
      x: node.x + (minX + maxX) / 2,
      y: node.y + (minY + maxY) / 2,
    };
  }

  if (metrics) {
    return {
      height: Math.max(24, metrics.height),
      width: Math.max(24, metrics.width),
      x: node.x + (metrics.minX + metrics.maxX) / 2,
      y: node.y + (metrics.minY + metrics.maxY) / 2,
    };
  }

  return {
    height: Math.max(48, node.fontSize * 1.25),
    width: Math.max(120, node.fontSize * Math.max(1.4, text.length * 0.58)),
    x: node.x,
    y: node.y,
  };
};

const hexToRgb = (hex) => {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length !== 6) {
    return null;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) {
    return null;
  }

  return { b, g, r };
};

const getEditorBackground = (fill) => {
  const rgb = hexToRgb(fill);
  if (!rgb) {
    return "rgba(18, 18, 18, 0.32)";
  }

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.68
    ? "rgba(10, 10, 10, 0.28)"
    : "rgba(255, 255, 255, 0.16)";
};

export const CanvasTextEditor = () => {
  const editor = useEditor();
  const editingNode = useEditorValue((editor) => editor.editingNode);
  const editingText = useEditorValue((_, state) => state.editingText);
  const fontFamily = useEditorValue((editor) => editor.editingFontFamily);
  const geometry = useEditorValue((editor) => editor.editingGeometry);
  const metrics = useEditorValue((editor) => editor.editingMetrics);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.focus();
    inputRef.current.select();
  }, []);

  if (!editingNode) {
    return null;
  }

  const frame = getEditorFrame(geometry, metrics, editingNode, editingText);

  return (
    <div
      className="pointer-events-auto absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{
        height: `${frame.height}px`,
        left: `${frame.x}px`,
        top: `${frame.y}px`,
        width: `${frame.width}px`,
      }}
    >
      <input
        className="block h-full w-full min-w-0 rounded-lg border-[1.5px] px-0 py-0 text-center font-normal leading-[1.05] shadow-[0_4px_16px_rgba(0,0,0,0.1)] focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--editor-accent)_20%,transparent),0_4px_16px_rgba(0,0,0,0.1)] focus:outline-none"
        key={editingNode.id}
        onBlur={() => editor.finalizeEditing()}
        onChange={(event) => editor.setEditingText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            editor.finalizeEditing();
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            editor.cancelEditing();
            editor.setActiveTool("pointer");
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        ref={inputRef}
        spellCheck={false}
        style={{
          background: getEditorBackground(editingNode.fill),
          borderColor: "color-mix(in srgb, var(--editor-accent) 60%, black)",
          caretColor: editingNode.fill,
          color: editingNode.fill,
          fontFamily,
          fontSize: `${editingNode.fontSize}px`,
          letterSpacing: `${editingNode.tracking}px`,
        }}
        type="text"
        value={editingText}
      />
    </div>
  );
};
