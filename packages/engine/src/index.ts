/* biome-ignore lint/performance/noBarrelFile: package root public API */
export {
  ARTBOARD_HEIGHT,
  ARTBOARD_WIDTH,
  MAX_ZOOM,
  MIN_ZOOM,
  UI_ACCENT,
  WARP_TEXT_NODE_KIND,
} from "./constants";
export { getRenderNodeFrame } from "./editable-node-frame";
export { Editor } from "./editor";
export {
  getAncestorNodeIds,
  getChildNodeIds,
  getChildNodes,
  getDescendantLeafNodeIds,
  getEffectiveSelectionNodeIds,
  getSelectionTargetNodeId,
  getSubtreeNodeIds,
  getTreeScopeParentId,
  isContainerNode,
  isDescendantOf,
  isGroupNode,
  isTextNode,
  rebuildTreeOrder,
} from "./nodes/node-tree";
export {
  incrementPerfCounter,
  measurePerf,
  setPerfSink,
} from "./perf/perf-hooks";
export {
  isInputElement,
  shouldIgnoreGlobalShortcutTarget,
} from "./primitives/dom";
export { getResizeCorner } from "./primitives/group-resize";
export { clamp, format, round, toNumber, toSafeHex } from "./primitives/math";
export {
  getNodeLocalPoint,
  getNodeRotationCenter,
  getNodeWorldPoint,
} from "./primitives/rotation";
export { createDefaultGroupNode } from "./shapes/group/model";
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
