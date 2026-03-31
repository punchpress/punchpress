import { VECTOR_ANCHOR_INTERACTION_RADIUS_PX } from "@punchpress/engine";

const HOVER_HALO_FILL_ALPHA = 0.2;

export const getVectorAnchorHoverHaloRadiusPx = () => {
  return VECTOR_ANCHOR_INTERACTION_RADIUS_PX;
};

export const getVectorHoverHaloStrokeWidthPx = () => {
  return 0;
};

export const getVectorHoverHaloFillAlpha = () => {
  return HOVER_HALO_FILL_ALPHA;
};
