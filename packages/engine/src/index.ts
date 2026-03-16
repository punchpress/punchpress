/* biome-ignore lint/performance/noBarrelFile: package root public API */
export {
  ARTBOARD_HEIGHT,
  ARTBOARD_WIDTH,
  MAX_ZOOM,
  MIN_ZOOM,
  UI_ACCENT,
  WARP_TEXT_NODE_KIND,
} from "./constants";
export { Editor } from "./editor";
export {
  isInputElement,
  shouldIgnoreGlobalShortcutTarget,
} from "./primitives/dom";
export { getResizeCorner } from "./primitives/group-resize";
export { clamp, format, round, toNumber, toSafeHex } from "./primitives/math";
export {
  createDefaultNode,
  createId,
  getDefaultWarp,
  getNodeCssTransform,
  getNodeRotation,
  getNodeScaleX,
  getNodeScaleY,
  getNodeTransform,
  getNodeX,
  getNodeY,
  isNodeVisible,
  withNodeTransform,
} from "./shapes/warp-text/model";
export {
  estimateBounds,
  inflateBounds,
  layoutGlyphs,
} from "./shapes/warp-text/warp-layout";
