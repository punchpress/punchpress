import { useEffect, useRef } from "react";
import { toSafeHex } from "../../editor/primitives/math";
import { isNodeVisible } from "../../editor/shapes/warp-text/model";
import { useEditor } from "../../editor/use-editor";
import { useEditorValue } from "../../editor/use-editor-value";

const getCaretColor = (fill) => {
  const normalized = toSafeHex(fill).slice(1);
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  return luminance > 0.62 ? "#111111" : "#ffffff";
};

export const CanvasTextEditor = () => {
  const editor = useEditor();
  const editingNode = useEditorValue((editor) => {
    return isNodeVisible(editor.editingNode) ? editor.editingNode : null;
  });
  const editingFrame = useEditorValue((editor) => editor.editingFrame);
  const editingPreviewGeometry = useEditorValue(
    (editor) => editor.editingPreviewGeometry
  );
  const editingText = useEditorValue((_, state) => state.editingText);
  const fontFamily = useEditorValue((editor) => editor.editingFontFamily);
  const ignoreInitialBlurRef = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editingNode) {
      return;
    }

    const input = inputRef.current;
    if (!input) {
      return;
    }

    ignoreInitialBlurRef.current = true;
    input.focus();
    const caretPosition = input.value.length;
    input.setSelectionRange(caretPosition, caretPosition);

    const timeoutId = window.setTimeout(() => {
      ignoreInitialBlurRef.current = false;
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      ignoreInitialBlurRef.current = false;
    };
  }, [editingNode]);

  if (!(editingNode && editingFrame)) {
    return null;
  }

  const frame = editingFrame.bounds;
  const previewBounds = editingPreviewGeometry?.bbox;
  const caretColor = getCaretColor(editingNode.fill);

  return (
    <div
      className="pointer-events-auto absolute z-10"
      style={{
        height: `${frame.height}px`,
        left: `${frame.minX}px`,
        top: `${frame.minY}px`,
        transform: editingFrame.transform,
        transformOrigin: "center center",
        width: `${frame.width}px`,
      }}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block overflow-visible"
        height={frame.height}
        viewBox={`0 0 ${frame.width} ${frame.height}`}
        width={frame.width}
      >
        {previewBounds ? (
          <g
            transform={`translate(${-previewBounds.minX} ${-previewBounds.minY})`}
          >
            {(editingPreviewGeometry?.paths || []).map((path) => {
              return (
                <path
                  d={path.d}
                  fill={editingNode.fill}
                  key={path.key || `${path.transform || "shape"}-${path.d}`}
                  paintOrder="stroke fill"
                  pointerEvents="none"
                  stroke={editingNode.stroke}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={editingNode.strokeWidth}
                  transform={path.transform || undefined}
                />
              );
            })}
          </g>
        ) : null}
      </svg>

      <input
        aria-label="Edit text layer"
        className="block h-full w-full min-w-0 appearance-none border-0 bg-transparent px-0 py-0 text-center font-normal leading-[1.05] shadow-none focus:outline-none"
        data-testid="canvas-text-input"
        key={editingNode.id}
        onBlur={() => {
          if (ignoreInitialBlurRef.current) {
            return;
          }

          editor.finalizeEditing();
        }}
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
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        ref={inputRef}
        spellCheck={false}
        style={{
          caretColor,
          color: "transparent",
          fontFamily,
          fontSize: `${editingNode.fontSize}px`,
          letterSpacing: `${editingNode.tracking}px`,
          WebkitTextFillColor: "transparent",
          WebkitTextStroke: "0 transparent",
        }}
        type="text"
        value={editingText}
      />
    </div>
  );
};
