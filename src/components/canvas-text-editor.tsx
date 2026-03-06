import { useEffect, useRef } from "react";

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

  return { r, g, b };
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

export const CanvasTextEditor = ({
  editingText,
  fontFamily,
  geometry,
  metrics,
  node,
  onCancel,
  onChange,
  onCommit,
  onFinalize,
}) => {
  const inputRef = useRef(null);
  const frame = getEditorFrame(geometry, metrics, node, editingText);

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.focus();
    inputRef.current.select();
  }, []);

  return (
    <div
      className="pointer-events-auto absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${frame.x}px`,
        top: `${frame.y}px`,
        width: `${frame.width}px`,
        height: `${frame.height}px`,
      }}
    >
      <input
        className="block h-full w-full min-w-0 rounded-lg border-[1.5px] px-0 py-0 text-center font-normal leading-[1.05] shadow-[0_4px_16px_rgba(0,0,0,0.1)] focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--editor-accent)_20%,transparent),0_4px_16px_rgba(0,0,0,0.1)] focus:outline-none"
        onBlur={onFinalize || onCommit}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            (onFinalize || onCommit)();
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
          background: getEditorBackground(node.fill),
          borderColor: "color-mix(in srgb, var(--editor-accent) 60%, black)",
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
