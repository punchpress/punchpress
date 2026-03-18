import { isNodeVisible } from "@punchpress/engine";
import { useEffect, useRef, useState } from "react";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";

const measurementCanvas =
  typeof document === "undefined" ? null : document.createElement("canvas");
const measurementContext = measurementCanvas?.getContext("2d");

const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

const measureTextWidth = (input, text, tracking) => {
  if (!measurementContext) {
    return 0;
  }

  measurementContext.font = window.getComputedStyle(input).font;

  const width = measurementContext.measureText(text).width;
  const trackingWidth = Math.max(text.length - 1, 0) * tracking;

  return width + trackingWidth;
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
  const [caretRevision, setCaretRevision] = useState(0);
  const [selectionRange, setSelectionRange] = useState({ end: 0, start: 0 });
  const [isCaretSettling, setIsCaretSettling] = useState(true);

  const updateSelectionRange = (input) => {
    setSelectionRange({
      end: input.selectionEnd ?? input.value.length,
      start: input.selectionStart ?? input.value.length,
    });
    setCaretRevision((value) => value + 1);
  };

  const syncSelectionRange = () => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    window.requestAnimationFrame(() => {
      updateSelectionRange(input);
    });
  };

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
    setSelectionRange({
      end: caretPosition,
      start: caretPosition,
    });
    setCaretRevision((value) => value + 1);

    const timeoutId = window.setTimeout(() => {
      ignoreInitialBlurRef.current = false;
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      ignoreInitialBlurRef.current = false;
    };
  }, [editingNode]);

  useEffect(() => {
    setIsCaretSettling(true);

    const timeoutId = window.setTimeout(() => {
      if (caretRevision < 0) {
        return;
      }

      setIsCaretSettling(false);
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [caretRevision]);

  if (!(editingNode && editingFrame)) {
    return null;
  }

  const frame = editingFrame.bounds;
  const previewBounds = editingPreviewGeometry?.bbox;
  const input = inputRef.current;
  const hasCollapsedSelection = selectionRange.start === selectionRange.end;
  const caretIndex = hasCollapsedSelection ? selectionRange.end : null;
  const caretOffset =
    input && caretIndex !== null
      ? measureTextWidth(
          input,
          editingText.slice(0, caretIndex),
          editingNode.tracking
        )
      : 0;
  const totalTextWidth = input
    ? measureTextWidth(input, editingText, editingNode.tracking)
    : 0;
  const caretLeft =
    caretIndex !== null
      ? clamp(
          (frame.width - totalTextWidth) / 2 + caretOffset,
          2,
          frame.width - 2
        )
      : null;
  const caretHeight = Math.min(frame.height, editingNode.fontSize * 1.05);

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

      {caretLeft !== null ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 w-0.5 -translate-x-1/2 -translate-y-1/2"
          data-testid="canvas-text-caret"
          style={{
            animation: isCaretSettling
              ? "none"
              : "canvas-caret-blink 1.1s steps(1, end) infinite",
            backgroundColor: "#ffffff",
            height: `${caretHeight}px`,
            left: `${caretLeft}px`,
            mixBlendMode: "difference",
          }}
        />
      ) : null}

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
        onChange={(event) => {
          editor.setEditingText(event.target.value);
          updateSelectionRange(event.currentTarget);
        }}
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
        onKeyUp={syncSelectionRange}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={syncSelectionRange}
        onSelect={(event) => updateSelectionRange(event.currentTarget)}
        ref={inputRef}
        spellCheck={false}
        style={{
          caretColor: "transparent",
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
