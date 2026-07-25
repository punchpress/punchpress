import {
  getNodeLocalPoint,
  type RasterCropRect,
  round,
} from "@punchpress/engine";
import type { ImageNodeDocument } from "@punchpress/punch-schema";
import { type PointerEvent as ReactPointerEvent, useId } from "react";
import { Button } from "@/components/ui/button";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { CanvasRasterImage } from "../raster/canvas-raster-image";

type CropHandle = "move" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const getImageBounds = (node) => ({
  height: node.height,
  maxX: node.width,
  maxY: node.height,
  minX: 0,
  minY: 0,
  width: node.width,
});

const getCanvasPoint = (editor, clientX: number, clientY: number) => {
  const rect = editor.hostRef?.getBoundingClientRect();

  if (!(rect && editor.viewerRef)) {
    return { x: 0, y: 0 };
  }

  return {
    x: editor.viewerRef.getScrollLeft() + (clientX - rect.left) / editor.zoom,
    y: editor.viewerRef.getScrollTop() + (clientY - rect.top) / editor.zoom,
  };
};

const getCropRectForDrag = (
  rect: RasterCropRect,
  handle: CropHandle,
  delta: { x: number; y: number }
) => {
  if (handle === "move") {
    return {
      ...rect,
      x: rect.x + delta.x,
      y: rect.y + delta.y,
    };
  }

  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const changesLeft = handle.includes("w");
  const changesRight = handle.includes("e");
  const changesTop = handle.includes("n");
  const changesBottom = handle.includes("s");
  const x = changesLeft ? Math.min(rect.x + delta.x, right - 1) : rect.x;
  const y = changesTop ? Math.min(rect.y + delta.y, bottom - 1) : rect.y;
  const nextRight = changesRight
    ? Math.max(right + delta.x, rect.x + 1)
    : right;
  const nextBottom = changesBottom
    ? Math.max(bottom + delta.y, rect.y + 1)
    : bottom;

  return {
    height: nextBottom - y,
    width: nextRight - x,
    x,
    y,
  };
};

const startCropDrag = ({
  editor,
  event,
  handle,
  node,
  rect,
}: {
  editor: ReturnType<typeof useEditor>;
  event: ReactPointerEvent;
  handle: CropHandle;
  node: ImageNodeDocument;
  rect: RasterCropRect;
}) => {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const startWorld = getCanvasPoint(editor, event.clientX, event.clientY);
  const startLocal = getNodeLocalPoint(node, getImageBounds(node), startWorld);

  const handlePointerMove = (moveEvent: PointerEvent) => {
    const world = getCanvasPoint(editor, moveEvent.clientX, moveEvent.clientY);
    const local = getNodeLocalPoint(node, getImageBounds(node), world);

    editor.updateCrop(
      getCropRectForDrag(rect, handle, {
        x: round(local.x - startLocal.x, 0),
        y: round(local.y - startLocal.y, 0),
      })
    );
  };
  const cleanup = () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointercancel", cleanup);
    window.removeEventListener("pointerup", cleanup);
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointercancel", cleanup);
  window.addEventListener("pointerup", cleanup);
};

const HANDLE_POSITIONS: Array<{
  handle: Exclude<CropHandle, "move">;
  left: (rect: RasterCropRect) => number;
  top: (rect: RasterCropRect) => number;
}> = [
  { handle: "nw", left: (rect) => rect.x, top: (rect) => rect.y },
  {
    handle: "n",
    left: (rect) => rect.x + rect.width / 2,
    top: (rect) => rect.y,
  },
  {
    handle: "ne",
    left: (rect) => rect.x + rect.width,
    top: (rect) => rect.y,
  },
  {
    handle: "e",
    left: (rect) => rect.x + rect.width,
    top: (rect) => rect.y + rect.height / 2,
  },
  {
    handle: "se",
    left: (rect) => rect.x + rect.width,
    top: (rect) => rect.y + rect.height,
  },
  {
    handle: "s",
    left: (rect) => rect.x + rect.width / 2,
    top: (rect) => rect.y + rect.height,
  },
  {
    handle: "sw",
    left: (rect) => rect.x,
    top: (rect) => rect.y + rect.height,
  },
  {
    handle: "w",
    left: (rect) => rect.x,
    top: (rect) => rect.y + rect.height / 2,
  },
];

export const CanvasRasterCropOverlay = () => {
  const editor = useEditor();
  const state = useEditorValue((editor, store) => {
    const session = store.rasterCropSession;
    const node = session ? editor.getNode(session.nodeId) : null;
    const frame = node ? editor.getNodeRenderFrame(node.id) : null;

    return {
      frame,
      node: node?.type === "image" ? node : null,
      rect: session?.rect || null,
      zoom: store.viewport.zoom,
    };
  });
  const clipId = `raster-crop-${useId().replaceAll(":", "")}`;

  if (!(state.node && state.frame && state.rect)) {
    return null;
  }

  const { frame, node, rect, zoom } = state;
  const handleSize = 12 / zoom;
  const sideLength = 24 / zoom;
  const shellStyle = {
    height: frame.bounds.height,
    left: frame.bounds.minX,
    top: frame.bounds.minY,
    transform: frame.transform || undefined,
    transformOrigin: "center center",
    width: frame.bounds.width,
  };

  return (
    <div data-raster-crop-root="true">
      <div className="pointer-events-none absolute -inset-[80000px] z-40 bg-black/45" />
      <div
        className="absolute z-50 overflow-visible"
        data-testid="raster-crop-overlay"
        style={shellStyle}
      >
        <svg
          aria-label="Raster Crop preview"
          className="pointer-events-none absolute inset-0 overflow-visible"
          height={node.height}
          viewBox={`0 0 ${node.width} ${node.height}`}
          width={node.width}
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                height={rect.height}
                width={rect.width}
                x={rect.x}
                y={rect.y}
              />
            </clipPath>
            <pattern
              height="12"
              id={`${clipId}-checker`}
              patternUnits="userSpaceOnUse"
              width="12"
            >
              <rect fill="#fff" height="12" width="12" />
              <path d="M0 0h6v6H0zM6 6h6v6H6z" fill="#d9d9d9" />
            </pattern>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect
              fill={`url(#${clipId}-checker)`}
              height={rect.height}
              width={rect.width}
              x={rect.x}
              y={rect.y}
            />
            <RasterCropArtwork node={node} />
          </g>
          <rect
            fill="none"
            height={rect.height}
            stroke="var(--canvas-selected)"
            strokeWidth={2 / zoom}
            vectorEffect="non-scaling-stroke"
            width={rect.width}
            x={rect.x}
            y={rect.y}
          />
        </svg>
        <button
          aria-label="Move Crop bounds"
          className="absolute cursor-move bg-transparent"
          data-raster-crop-handle="move"
          data-raster-crop-overlay="true"
          onPointerDown={(event) =>
            startCropDrag({ editor, event, handle: "move", node, rect })
          }
          style={{
            height: rect.height,
            left: rect.x,
            top: rect.y,
            width: rect.width,
          }}
          type="button"
        />
        {HANDLE_POSITIONS.map(({ handle, left, top }) => {
          const isSide = handle.length === 1;
          const isHorizontalSide = handle === "n" || handle === "s";
          const isVerticalSide = handle === "e" || handle === "w";
          const height = isSide && isHorizontalSide ? handleSize : sideLength;
          const width = isSide && isVerticalSide ? handleSize : sideLength;

          return (
            <button
              aria-label={`Crop ${handle.toUpperCase()} handle`}
              className={
                isSide
                  ? "absolute rounded-sm border border-white bg-[var(--canvas-selected)] shadow-sm"
                  : "absolute border-[var(--canvas-selected)] border-t-2 border-l-2 bg-transparent"
              }
              data-raster-crop-handle={handle}
              data-raster-crop-overlay="true"
              key={handle}
              onPointerDown={(event) =>
                startCropDrag({ editor, event, handle, node, rect })
              }
              style={{
                height,
                left: left(rect),
                top: top(rect),
                transform: "translate(-50%, -50%)",
                width,
              }}
              type="button"
            />
          );
        })}
        <Button
          className="absolute"
          data-raster-crop-overlay="true"
          data-testid="raster-crop-done"
          onClick={() => editor.commitCrop()}
          size="sm"
          style={{
            left: rect.x + rect.width / 2,
            top: rect.y + rect.height + 16 / zoom,
            transform: `translate(-50%, 0) scale(${1 / zoom})`,
            transformOrigin: "top center",
          }}
          type="button"
        >
          Done
        </Button>
      </div>
    </div>
  );
};

const RasterCropArtwork = ({ node }: { node: ImageNodeDocument }) => (
  <CanvasRasterImage
    baseHeight={node.baseHeight}
    baseWidth={node.baseWidth}
    baseX={node.baseX}
    baseY={node.baseY}
    height={node.height}
    nodeId={node.id}
    pixelGridSurface="crop"
    src={node.src}
    tileSources={node.tileSources}
    width={node.width}
  />
);
