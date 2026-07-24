export const PIXEL_GRID_ZOOM_THRESHOLD = 5;

export type RasterSampling = "exact" | "smooth";

export interface RasterPresentationPolicy {
  sampling: RasterSampling;
  showPixelGrid: boolean;
}

export const getRasterPresentationPolicy = (
  zoom: number
): RasterPresentationPolicy => {
  const showPixelGrid = zoom > PIXEL_GRID_ZOOM_THRESHOLD;

  return {
    sampling: showPixelGrid ? "exact" : "smooth",
    showPixelGrid,
  };
};
