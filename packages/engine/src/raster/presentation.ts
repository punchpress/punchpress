export const PIXEL_GRID_SCREEN_PIXEL_THRESHOLD = 5;
export const RASTER_MAGNIFIED_SCREEN_PIXEL_THRESHOLD = 2;

export type RasterSampling = "exact" | "smooth";

export interface RasterPixelFootprint {
  height: number;
  width: number;
}

export interface RasterPixelFootprintOptions {
  displayedHeight: number;
  displayedWidth: number;
  sampleHeight: number;
  sampleWidth: number;
  scaleX: number;
  scaleY: number;
  zoom: number;
}

export const getRasterPixelFootprint = ({
  displayedHeight,
  displayedWidth,
  sampleHeight,
  sampleWidth,
  scaleX,
  scaleY,
  zoom,
}: RasterPixelFootprintOptions): RasterPixelFootprint => ({
  height:
    (Math.abs(displayedHeight) / Math.max(1, Math.abs(sampleHeight))) *
    Math.abs(scaleY) *
    Math.abs(zoom),
  width:
    (Math.abs(displayedWidth) / Math.max(1, Math.abs(sampleWidth))) *
    Math.abs(scaleX) *
    Math.abs(zoom),
});

export const getRasterSampling = (
  footprint: RasterPixelFootprint
): RasterSampling =>
  isMeaningfullyMagnified(footprint) ? "exact" : "smooth";

export const shouldUseFullResolutionRasterSource = (
  footprint: RasterPixelFootprint
) => isMeaningfullyMagnified(footprint);

export const shouldShowPixelGrid = (footprint: RasterPixelFootprint) =>
  Math.min(footprint.height, footprint.width) >
  PIXEL_GRID_SCREEN_PIXEL_THRESHOLD;

const isMeaningfullyMagnified = (footprint: RasterPixelFootprint) =>
  Math.min(footprint.height, footprint.width) >=
  RASTER_MAGNIFIED_SCREEN_PIXEL_THRESHOLD;
