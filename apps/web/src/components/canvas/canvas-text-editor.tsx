import { useEffect, useRef } from "react";
import {
  getNodeCssTransform,
  getNodeX,
  getNodeY,
  isNodeVisible,
} from "../../editor/shapes/warp-text/model";
import { useEditor } from "../../editor/use-editor";
import { useEditorValue } from "../../editor/use-editor-value";

const getEditorFrame = (geometry, metrics, node, text) => {
  if (geometry?.bbox) {
    const { maxX, maxY, minX, minY } = geometry.bbox;

    return {
      height: Math.max(24, maxY - minY),
      left: getNodeX(node) + minX,
      top: getNodeY(node) + minY,
      width: Math.max(24, maxX - minX),
    };
  }

  if (metrics) {
    return {
      height: Math.max(24, metrics.height),
      left: getNodeX(node) + metrics.minX,
      top: getNodeY(node) + metrics.minY,
      width: Math.max(24, metrics.width),
    };
  }

  const width = Math.max(
    120,
    node.fontSize * Math.max(1.4, text.length * 0.58)
  );
  const height = Math.max(48, node.fontSize * 1.25);

  return {
    height,
    left: getNodeX(node) - width / 2,
    top: getNodeY(node) - height / 2,
    width,
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
  const editingNode = useEditorValue((editor) => {
    return isNodeVisible(editor.editingNode) ? editor.editingNode : null;
  });
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
      className="pointer-events-auto absolute z-10"
      style={{
        height: `${frame.height}px`,
        left: `${frame.left}px`,
        top: `${frame.top}px`,
        transform: getNodeCssTransform(editingNode),
        transformOrigin: "center center",
        width: `${frame.width}px`,
      }}
    >
      <input
        aria-label="Edit text layer"
        className="block h-full w-full min-w-0 rounded-lg border-[1.5px] px-0 py-0 text-center font-normal leading-[1.05] shadow-[0_4px_16px_rgba(0,0,0,0.1)] focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--editor-accent)_20%,transparent),0_4px_16px_rgba(0,0,0,0.1)] focus:outline-none"
        data-testid="canvas-text-input"
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
