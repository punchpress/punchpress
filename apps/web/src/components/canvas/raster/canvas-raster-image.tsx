import { getRasterSampling } from "@punchpress/engine";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import { getCanvas2dRasterDisplay } from "../../../platform/raster/canvas2d-raster-runtime";
import {
  CanvasExactRaster,
  useExactRasterPresentation,
} from "./canvas-exact-raster";
import { CanvasNativeRasterImage } from "./canvas-native-raster-image";
import { CanvasRasterPixelGrid } from "./canvas-raster-pixel-grid";
import { getRasterPresentationFootprint } from "./canvas-raster-presentation";

export const CanvasRasterImage = (props) => {
  const editor = useEditor();
  const activeClipId = useId();
  const residentSurface = useResidentRasterSurface(props);
  const zoom = useEditorSurfaceValue((_, state) => state.viewport.zoom);
  const activePresentationViewport = useEditorSurfaceValue((activeEditor) =>
    activeEditor.rasterStrokeRuntime.getActivePresentationViewport(props.nodeId)
  );
  const committedVisibleBounds = {
    height: props.height,
    width: props.width,
    x: 0,
    y: 0,
  };
  const visibleViewport =
    activePresentationViewport?.bounds ?? committedVisibleBounds;
  const visibleClipBounds = activePresentationViewport?.clipBounds ?? [
    committedVisibleBounds,
  ];
  const sourceBounds = {
    height: props.baseHeight ?? props.height,
    width: props.baseWidth ?? props.width,
    x: props.baseX ?? 0,
    y: props.baseY ?? 0,
  };
  const display = residentSurface
    ? getCanvas2dRasterDisplay(residentSurface, sourceBounds)
    : sourceBounds;
  const sampleHeight =
    residentSurface?.canvas.height ?? Math.max(1, Math.round(display.height));
  const sampleWidth =
    residentSurface?.canvas.width ?? Math.max(1, Math.round(display.width));
  const sampling = getRasterSampling(
    getRasterPresentationFootprint(editor, {
      displayedHeight: display.height,
      displayedWidth: display.width,
      nodeId: props.nodeId,
      renderRootNodeId: props.renderRootNodeId ?? props.nodeId,
      sampleHeight,
      sampleWidth,
      zoom,
    })
  );
  const pixelGridProps = {
    baseHeight: props.baseHeight,
    baseWidth: props.baseWidth,
    baseX: props.baseX,
    baseY: props.baseY,
    height: props.height,
    nodeId: props.nodeId,
    renderRootNodeId: props.renderRootNodeId ?? props.nodeId,
    surface: props.pixelGridSurface,
    width: props.width,
  };
  const subscribeToResidentSource = useCallback(
    (listener: () => void) =>
      editor.rasterSurface?.subscribePresentation?.(props.nodeId, listener) ??
      (() => undefined),
    [editor, props.nodeId]
  );

  return (
    <g
      data-raster-node-id={props.nodeId}
      transform={props.transform || undefined}
    >
      {residentSurface ? (
        <svg
          aria-hidden="true"
          data-raster-visible-viewport="true"
          height={visibleViewport.height}
          overflow="hidden"
          viewBox={`${visibleViewport.x} ${visibleViewport.y} ${visibleViewport.width} ${visibleViewport.height}`}
          width={visibleViewport.width}
          x={visibleViewport.x}
          y={visibleViewport.y}
        >
          <defs>
            <clipPath id={activeClipId}>
              {visibleClipBounds.map((bounds) => (
                <rect
                  height={bounds.height}
                  key={`${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`}
                  width={bounds.width}
                  x={bounds.x}
                  y={bounds.y}
                />
              ))}
            </clipPath>
          </defs>
          <g
            clipPath={`url(#${activeClipId})`}
            data-raster-resident-surface="canvas2d"
            data-raster-sampling={sampling}
          >
            <RasterCanvas
              artworkOpacity={props.opacity ?? 1}
              canvas={residentSurface.canvas}
              height={display.height}
              pixelGridProps={pixelGridProps}
              sampling={sampling}
              subscribeToSource={subscribeToResidentSource}
              testId="raster-resident-canvas"
              width={display.width}
              x={display.x}
              y={display.y}
            />
          </g>
        </svg>
      ) : (
        <CanvasNativeRasterImage
          {...props}
          artworkOpacity={props.opacity ?? 1}
          pixelGridProps={pixelGridProps}
          renderRootNodeId={props.renderRootNodeId ?? props.nodeId}
          sampling={sampling}
        />
      )}
    </g>
  );
};

const RasterCanvas = ({
  artworkOpacity = 1,
  canvas,
  height,
  pixelGridProps,
  sampling,
  subscribeToSource,
  testId,
  width,
  x,
  y,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const display = useMemo(
    () => ({ height, width, x, y }),
    [height, width, x, y]
  );
  const sampleSize = useMemo(
    () => ({ height: canvas.height, width: canvas.width }),
    [canvas]
  );
  const { presentation, surfaceRef } = useExactRasterPresentation({
    display,
    enabled: sampling === "exact" && artworkOpacity > 0,
    sampleSize,
  });
  const showsExactPresentation = Boolean(
    sampling === "exact" && artworkOpacity > 0 && presentation
  );

  useLayoutEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    canvas.style.display = showsExactPresentation ? "none" : "block";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.width = "100%";
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("data-raster-source-canvas", "true");
    const previousParent = canvas.parentElement;
    const previousNextSibling = canvas.nextSibling;

    host.replaceChildren(canvas);

    return () => {
      if (canvas.parentElement === host) {
        host.removeChild(canvas);
      }

      if (previousParent?.isConnected) {
        previousParent.insertBefore(
          canvas,
          previousNextSibling?.parentNode === previousParent
            ? previousNextSibling
            : null
        );
      }
    };
  }, [canvas, showsExactPresentation]);

  const visibleBounds = presentation?.bounds ?? display;

  return (
    <g
      data-raster-canvas-host="true"
      data-testid={`${testId}-surface`}
      ref={surfaceRef}
    >
      <g transform={`translate(${visibleBounds.x} ${visibleBounds.y})`}>
        <foreignObject
          data-raster-working-canvas="true"
          data-testid={testId}
          height={visibleBounds.height}
          overflow="visible"
          pointerEvents="none"
          width={visibleBounds.width}
          x={0}
          y={0}
        >
          <div style={{ height: "100%", position: "relative", width: "100%" }}>
            <div
              ref={hostRef}
              style={{
                height: "100%",
                inset: 0,
                opacity: artworkOpacity,
                position: "absolute",
                width: "100%",
              }}
            />
            {showsExactPresentation && presentation ? (
              <CanvasExactRaster
                opacity={artworkOpacity}
                presentation={presentation}
                source={canvas}
                subscribeToSource={subscribeToSource}
              />
            ) : null}
          </div>
        </foreignObject>
      </g>
      <CanvasRasterPixelGrid
        {...pixelGridProps}
        displayPlane={display}
        sampleHeight={canvas.height}
        sampleWidth={canvas.width}
      />
    </g>
  );
};

const useResidentRasterSurface = ({
  baseHeight,
  baseWidth,
  baseX,
  baseY,
  height,
  nodeId,
  src,
  width,
}) => {
  const editor = useEditor();
  const runtime = editor.rasterSurface;
  const subscribe = useCallback(
    (listener) => runtime?.subscribe?.(listener) || (() => undefined),
    [runtime]
  );
  const getSnapshot = useCallback(
    () => runtime?.getPresentation?.(nodeId) || null,
    [nodeId, runtime]
  );
  const presentation = useSyncExternalStore(subscribe, getSnapshot, () => null);

  useEffect(() => {
    if (!(src && runtime?.ensureSurface && !presentation)) {
      return;
    }

    let active = true;

    const sourceBounds = {
      height: baseHeight ?? height,
      width: baseWidth ?? width,
      x: baseX ?? 0,
      y: baseY ?? 0,
    };
    const bounds = editor.getRasterSurfaceBounds(nodeId) ?? sourceBounds;
    const pixelSize = editor.getRasterSurfacePixelSize(nodeId) ?? {
      height: Math.max(1, Math.ceil(bounds.height)),
      width: Math.max(1, Math.ceil(bounds.width)),
    };

    runtime
      .ensureSurface({
        bounds,
        height: pixelSize.height,
        id: nodeId,
        sourceBounds,
        src,
        width: pixelSize.width,
      })
      .catch((error) => {
        if (active) {
          console.error("Failed to prepare Canvas2D Raster surface", error);
        }
      });

    return () => {
      active = false;
    };
  }, [
    baseHeight,
    baseWidth,
    baseX,
    baseY,
    editor,
    height,
    nodeId,
    presentation,
    runtime,
    src,
    width,
  ]);

  return presentation;
};
