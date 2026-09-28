import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorPreviewValue } from "../../editor-react/use-editor-preview-value";
import {
  getPixelGridPaths,
  getVisiblePixelGridBounds,
} from "./canvas-pixel-grid-path";

interface PixelGridBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface PixelGridPlane {
  cellHeight: number;
  cellWidth: number;
  originX: number;
  originY: number;
}

interface PixelGridStrokeWidths {
  horizontal: number;
  vertical: number;
}

interface CanvasPixelGridLinesProps {
  bounds: PixelGridBounds;
  kind: "frame" | "raster";
  layer?: number;
  nodeId: string;
  plane: PixelGridPlane;
  sourceNodeId: string;
  strokeWidths: PixelGridStrokeWidths;
}

export const CanvasPixelGridLines = ({
  bounds,
  kind,
  layer = 5,
  nodeId,
  plane,
  sourceNodeId,
  strokeWidths,
}: CanvasPixelGridLinesProps) => {
  const editor = useEditor();
  const viewportInteracting = useEditorPreviewValue(
    (currentEditor) => currentEditor.viewportInteracting
  );
  const sourceRef = useRef<SVGGElement | null>(null);
  const [screenProjection, setScreenProjection] =
    useState<ScreenProjection | null>(null);
  const {
    height: boundsHeight,
    width: boundsWidth,
    x: boundsX,
    y: boundsY,
  } = bounds;
  const { cellHeight, cellWidth, originX, originY } = plane;
  const visibleBounds = useMemo(
    () =>
      screenProjection
        ? getVisiblePixelGridBounds(
            {
              height: boundsHeight,
              width: boundsWidth,
              x: boundsX,
              y: boundsY,
            },
            { cellHeight, cellWidth, originX, originY },
            screenProjection
          )
        : null,
    [
      boundsHeight,
      boundsWidth,
      boundsX,
      boundsY,
      cellHeight,
      cellWidth,
      originX,
      originY,
      screenProjection,
    ]
  );
  const paths = useMemo(
    () =>
      visibleBounds
        ? getPixelGridPaths(visibleBounds, {
            cellHeight,
            cellWidth,
            originX,
            originY,
          })
        : { horizontal: "", vertical: "" },
    [cellHeight, cellWidth, originX, originY, visibleBounds]
  );
  const syncScreenMatrix = useCallback(() => {
    const host = editor.hostRef;
    const matrix = sourceRef.current?.getScreenCTM();

    if (!(host && matrix)) {
      setScreenProjection(null);
      return;
    }

    const hostBounds = host.getBoundingClientRect();
    const nextProjection = {
      a: matrix.a,
      b: matrix.b,
      c: matrix.c,
      d: matrix.d,
      e: matrix.e - hostBounds.left,
      f: matrix.f - hostBounds.top,
      viewportHeight: hostBounds.height,
      viewportWidth: hostBounds.width,
    };

    setScreenProjection((current) =>
      isSameProjection(current, nextProjection) ? current : nextProjection
    );
  }, [editor]);

  useLayoutEffect(syncScreenMatrix);
  useEffect(() => {
    if (!viewportInteracting) {
      return;
    }

    let frameId = 0;
    const syncDuringViewportInteraction = () => {
      syncScreenMatrix();
      frameId = window.requestAnimationFrame(syncDuringViewportInteraction);
    };

    frameId = window.requestAnimationFrame(syncDuringViewportInteraction);
    return () => window.cancelAnimationFrame(frameId);
  }, [syncScreenMatrix, viewportInteracting]);
  useEffect(() => {
    window.addEventListener("resize", syncScreenMatrix);
    return () => window.removeEventListener("resize", syncScreenMatrix);
  }, [syncScreenMatrix]);

  return (
    <>
      <g data-pixel-grid-transform-source={nodeId} ref={sourceRef} />
      {screenProjection && editor.hostRef
        ? createPortal(
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 size-full overflow-hidden"
              style={{ zIndex: layer }}
            >
              <g
                data-pixel-grid-cell-height={cellHeight}
                data-pixel-grid-cell-width={cellWidth}
                data-pixel-grid-kind={kind}
                data-pixel-grid-node-id={nodeId}
                data-pixel-grid-origin-x={originX}
                data-pixel-grid-origin-y={originY}
                data-pixel-grid-source-node-id={sourceNodeId}
                pointerEvents="none"
                transform={`matrix(${screenProjection.a} ${screenProjection.b} ${screenProjection.c} ${screenProjection.d} ${screenProjection.e} ${screenProjection.f})`}
              >
                <rect
                  data-testid="pixel-grid-plane"
                  fill="transparent"
                  height={boundsHeight}
                  width={boundsWidth}
                  x={boundsX}
                  y={boundsY}
                />
                <PixelGridPaths paths={paths} strokeWidths={strokeWidths} />
              </g>
            </svg>,
            editor.hostRef
          )
        : null}
    </>
  );
};

const PixelGridPaths = ({
  paths,
  strokeWidths,
}: {
  paths: { horizontal: string; vertical: string };
  strokeWidths: PixelGridStrokeWidths;
}) => (
  <>
    <path
      d={paths.vertical}
      data-pixel-grid-tone="dark"
      fill="none"
      stroke="#000"
      strokeOpacity="0.52"
      strokeWidth={strokeWidths.vertical * 2}
      vectorEffect="non-scaling-stroke"
    />
    <path
      d={paths.horizontal}
      data-pixel-grid-tone="dark"
      fill="none"
      stroke="#000"
      strokeOpacity="0.52"
      strokeWidth={strokeWidths.horizontal * 2}
      vectorEffect="non-scaling-stroke"
    />
    <path
      d={paths.vertical}
      data-pixel-grid-tone="light"
      fill="none"
      stroke="#fff"
      strokeOpacity="0.72"
      strokeWidth={strokeWidths.vertical}
      vectorEffect="non-scaling-stroke"
    />
    <path
      d={paths.horizontal}
      data-pixel-grid-tone="light"
      fill="none"
      stroke="#fff"
      strokeOpacity="0.72"
      strokeWidth={strokeWidths.horizontal}
      vectorEffect="non-scaling-stroke"
    />
  </>
);

interface ScreenProjection {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  viewportHeight: number;
  viewportWidth: number;
}

const isSameProjection = (
  current: ScreenProjection | null,
  next: ScreenProjection
) =>
  Boolean(
    current &&
      current.a === next.a &&
      current.b === next.b &&
      current.c === next.c &&
      current.d === next.d &&
      current.e === next.e &&
      current.f === next.f &&
      current.viewportHeight === next.viewportHeight &&
      current.viewportWidth === next.viewportWidth
  );
