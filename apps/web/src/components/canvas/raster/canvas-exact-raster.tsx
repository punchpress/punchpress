import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorSelectionDragPreviewValue } from "../../../editor-react/use-editor-selection-drag-preview-value";
import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import {
  getExactRasterCanvasLayout,
  getNativeRasterViewportPresentation,
} from "./canvas-native-raster-presentation";

export const CanvasExactRaster = ({
  opacity = 1,
  presentation,
  source,
  subscribeToSource,
}: {
  opacity?: number;
  presentation: NonNullable<
    ReturnType<typeof getNativeRasterViewportPresentation>
  >;
  source: CanvasImageSource;
  subscribeToSource?: (listener: () => void) => () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    drawExactRaster(canvasRef.current, presentation, source);
  });
  useLayoutEffect(() => {
    if (!subscribeToSource) {
      return;
    }

    let frameId = 0;
    const redraw = () => {
      frameId = 0;
      drawExactRaster(canvasRef.current, presentation, source);
    };
    const unsubscribe = subscribeToSource(() => {
      if (!frameId) {
        frameId = requestAnimationFrame(redraw);
      }
    });

    return () => {
      unsubscribe();
      cancelAnimationFrame(frameId);
    };
  }, [presentation, source, subscribeToSource]);

  return (
    <canvas
      data-raster-exact-backing="true"
      data-raster-native-destination-height={presentation.destination.height}
      data-raster-native-destination-width={presentation.destination.width}
      data-raster-native-destination-x={presentation.destination.x}
      data-raster-native-destination-y={presentation.destination.y}
      data-raster-native-source-height={presentation.sourceHeight}
      data-raster-native-source-width={presentation.sourceWidth}
      data-raster-native-source-x={presentation.sourceX}
      data-raster-native-source-y={presentation.sourceY}
      height={presentation.backingHeight}
      ref={canvasRef}
      style={{
        display: "block",
        imageRendering: "auto",
        opacity,
        pointerEvents: "none",
        ...getExactRasterCanvasLayout(presentation),
      }}
      width={presentation.backingWidth}
    />
  );
};

const drawExactRaster = (
  canvas: HTMLCanvasElement | null,
  presentation: NonNullable<
    ReturnType<typeof getNativeRasterViewportPresentation>
  >,
  source: CanvasImageSource
) => {
  if (!canvas) {
    return;
  }

  if (canvas.height !== presentation.backingHeight) {
    canvas.height = presentation.backingHeight;
  }
  if (canvas.width !== presentation.backingWidth) {
    canvas.width = presentation.backingWidth;
  }
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.resetTransform();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(
    source,
    presentation.sourceX,
    presentation.sourceY,
    presentation.sourceWidth,
    presentation.sourceHeight,
    presentation.destination.x,
    presentation.destination.y,
    presentation.destination.width,
    presentation.destination.height
  );
};

export const useExactRasterPresentation = ({
  display,
  enabled,
  sampleSize,
}: {
  display: { height: number; width: number; x: number; y: number };
  enabled: boolean;
  sampleSize: { height: number; width: number } | null;
}) => {
  const editor = useEditor();
  const surfaceRef = useRef<SVGGElement | null>(null);
  const windowSize = useWindowSize();
  const [, setPlacementRevision] = useState(0);
  const [presentation, setPresentation] = useState<ReturnType<
    typeof getNativeRasterViewportPresentation
  > | null>(null);

  useEditorSurfaceValue((_, state) => ({
    nodes: state.nodes,
    viewport: state.viewport,
  }));
  useEditorSelectionDragPreviewValue((editor) => editor.selectionDragPreview);
  useSyncExternalStore(
    useCallback(
      (listener) =>
        enabled
          ? editor.subscribeViewportPresentation(listener)
          : () => undefined,
      [editor, enabled]
    ),
    useCallback(
      () => (enabled ? editor.getViewportPresentationRevision() : 0),
      [editor, enabled]
    ),
    () => 0
  );
  useLayoutEffect(() => {
    return editor.subscribePlacementSurface(() => {
      setPlacementRevision((revision) => revision + 1);
    });
  }, [editor]);
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const host = editor.hostRef;

    if (
      !(
        enabled &&
        host &&
        sampleSize &&
        surface &&
        windowSize.height > 0 &&
        windowSize.width > 0
      )
    ) {
      setPresentation(null);
      return;
    }

    const matrix = surface.getScreenCTM();

    if (!matrix) {
      setPresentation(null);
      return;
    }

    const inverse = matrix.inverse();
    const hostRect = host.getBoundingClientRect();
    const viewportPoints = [
      new DOMPoint(hostRect.left, hostRect.top),
      new DOMPoint(hostRect.right, hostRect.top),
      new DOMPoint(hostRect.right, hostRect.bottom),
      new DOMPoint(hostRect.left, hostRect.bottom),
    ].map((point) => point.matrixTransform(inverse));
    const backingLimit = Math.ceil(
      Math.hypot(hostRect.width, hostRect.height) * window.devicePixelRatio
    );

    const nextPresentation = getNativeRasterViewportPresentation({
      backingLimit: {
        height: backingLimit,
        width: backingLimit,
      },
      devicePixelRatio: window.devicePixelRatio,
      display,
      sampleSize,
      screenScale: {
        x: Math.hypot(matrix.a, matrix.b),
        y: Math.hypot(matrix.c, matrix.d),
      },
      visibleBounds: {
        maxX: Math.max(...viewportPoints.map((point) => point.x)),
        maxY: Math.max(...viewportPoints.map((point) => point.y)),
        minX: Math.min(...viewportPoints.map((point) => point.x)),
        minY: Math.min(...viewportPoints.map((point) => point.y)),
      },
    });

    setPresentation((current) =>
      getPresentationKey(current) === getPresentationKey(nextPresentation)
        ? current
        : nextPresentation
    );
  });

  return { presentation, surfaceRef };
};

const getPresentationKey = (
  presentation: ReturnType<typeof getNativeRasterViewportPresentation>
) => {
  if (!presentation) {
    return "none";
  }

  return [
    presentation.backingHeight,
    presentation.backingWidth,
    presentation.bounds.height,
    presentation.bounds.width,
    presentation.bounds.x,
    presentation.bounds.y,
    presentation.destination.height,
    presentation.destination.width,
    presentation.destination.x,
    presentation.destination.y,
    presentation.sourceHeight,
    presentation.sourceWidth,
    presentation.sourceX,
    presentation.sourceY,
  ].join(":");
};

const useWindowSize = () => {
  const [size, setSize] = useState(() => ({
    height: typeof window === "undefined" ? 0 : window.innerHeight,
    width: typeof window === "undefined" ? 0 : window.innerWidth,
  }));

  useLayoutEffect(() => {
    const update = () => {
      setSize({
        height: window.innerHeight,
        width: window.innerWidth,
      });
    };

    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("resize", update);
    };
  }, []);

  return size;
};
