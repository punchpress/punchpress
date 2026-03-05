import { useEffect, useRef } from "react";

const getEditorDimensions = (metrics, node, text) => {
  if (metrics) {
    return {
      width: Math.max(120, metrics.width + node.fontSize * 0.35),
      height: Math.max(
        node.fontSize * 1.2,
        metrics.height + node.fontSize * 0.35
      ),
    };
  }

  return {
    width: Math.max(120, node.fontSize * Math.max(1.4, text.length * 0.58)),
    height: Math.max(48, node.fontSize * 1.25),
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

  return { r, g, b };
};

const getEditorBackground = (fill) => {
  const rgb = hexToRgb(fill);
  if (!rgb) {
    return "rgba(13, 13, 13, 0.68)";
  }

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.68
    ? "rgba(10, 10, 10, 0.7)"
    : "rgba(255, 255, 255, 0.22)";
};

export const CanvasTextEditor = ({
  editingText,
  fontFamily,
  metrics,
  node,
  onCancel,
  onChange,
  onCommit,
}) => {
  const inputRef = useRef(null);
  const dimensions = getEditorDimensions(metrics, node, editingText);
  const strokeWidth = Math.min(
    node.strokeWidth,
    Math.max(1, node.fontSize * 0.06)
  );

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.focus();
    inputRef.current.select();
  }, []);

  return (
    <div
      className="canvas-text-editor"
      style={{
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: `${dimensions.width}px`,
        minHeight: `${dimensions.height}px`,
      }}
    >
      <input
        className="canvas-text-input"
        onBlur={onCommit}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit();
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        ref={inputRef}
        spellCheck={false}
        style={{
          WebkitTextStrokeColor: node.stroke,
          WebkitTextStrokeWidth: `${strokeWidth}px`,
          background: getEditorBackground(node.fill),
          caretColor: node.fill,
          color: node.fill,
          fontFamily,
          fontSize: `${node.fontSize}px`,
          letterSpacing: `${node.tracking}px`,
        }}
        type="text"
        value={editingText}
      />
    </div>
  );
};
