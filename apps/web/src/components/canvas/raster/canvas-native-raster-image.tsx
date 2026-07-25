import { useLayoutEffect, useMemo, useState } from "react";
import {
  CanvasExactRaster,
  useExactRasterPresentation,
} from "./canvas-exact-raster";
import { CanvasRasterPixelGrid } from "./canvas-raster-pixel-grid";

export const CanvasNativeRasterImage = ({
  artworkOpacity = 1,
  baseHeight,
  baseWidth,
  baseX,
  baseY,
  height,
  nodeId,
  pixelGridProps,
  renderRootNodeId,
  sampling,
  src,
  width,
}) => {
  const loadedImage = useNativeImage(src);
  const display = useMemo(
    () => ({
      height: baseHeight ?? height,
      width: baseWidth ?? width,
      x: baseX ?? 0,
      y: baseY ?? 0,
    }),
    [baseHeight, baseWidth, baseX, baseY, height, width]
  );
  const sampleSize = useMemo(
    () =>
      loadedImage
        ? {
            height: loadedImage.image.naturalHeight,
            width: loadedImage.image.naturalWidth,
          }
        : null,
    [loadedImage]
  );
  const { presentation, surfaceRef } = useExactRasterPresentation({
    display,
    enabled: sampling === "exact" && artworkOpacity > 0,
    sampleSize,
  });
  const showsExactPresentation =
    artworkOpacity > 0 && loadedImage && presentation;

  return (
    <g
      data-raster-native-sample-height={sampleSize?.height}
      data-raster-native-sample-width={sampleSize?.width}
      data-raster-native-sampling={
        showsExactPresentation ? "nearest" : undefined
      }
      ref={surfaceRef}
    >
      {showsExactPresentation ? (
        // Keep foreignObject at (0,0); its x/y are quantized before SVG zoom.
        <g
          transform={`translate(${presentation.bounds.x} ${presentation.bounds.y})`}
        >
          <foreignObject
            data-raster-native-node-id={nodeId}
            data-testid="raster-native-image"
            height={presentation.bounds.height}
            overflow="hidden"
            pointerEvents="none"
            width={presentation.bounds.width}
            x={0}
            y={0}
          >
            <CanvasExactRaster
              opacity={artworkOpacity}
              presentation={presentation}
              source={loadedImage.image}
            />
          </foreignObject>
        </g>
      ) : (
        <image
          height={display.height}
          href={src}
          opacity={artworkOpacity}
          pointerEvents="none"
          preserveAspectRatio="none"
          width={display.width}
          x={display.x}
          y={display.y}
        />
      )}
      {sampleSize ? (
        <CanvasRasterPixelGrid
          {...pixelGridProps}
          nodeId={nodeId}
          renderRootNodeId={renderRootNodeId}
          sampleHeight={sampleSize.height}
          sampleWidth={sampleSize.width}
        />
      ) : null}
    </g>
  );
};

const useNativeImage = (src?: string) => {
  const [loadedImage, setLoadedImage] = useState<{
    image: HTMLImageElement;
    src: string;
  } | null>(null);

  useLayoutEffect(() => {
    if (!src) {
      return;
    }

    let active = true;
    const image = new Image();

    image.addEventListener("load", () => {
      if (active && image.naturalWidth > 0 && image.naturalHeight > 0) {
        setLoadedImage({ image, src });
      }
    });
    image.src = src;

    return () => {
      active = false;
    };
  }, [src]);

  return loadedImage?.src === src ? loadedImage : null;
};
