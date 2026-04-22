// biome-ignore-all lint/performance/noBarrelFile: package root public API

export {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
} from "@punchpress/punch-schema";
export {
  ARTBOARD_HEIGHT,
  ARTBOARD_WIDTH,
  MAX_ZOOM,
  MIN_ZOOM,
  UI_ACCENT,
  WARP_TEXT_NODE_KIND,
} from "./constants";
export { offsetEditablePathPoints } from "./document/path/editable-path-actions";
export { setVectorPathComposition } from "./document/path/path-composition-actions";
export {
  canMakeCompoundPath,
  canReleaseCompoundPath,
  makeCompoundPath,
  releaseCompoundPath,
} from "./document/path/path-compound-actions";
export { Editor } from "./editor";
export {
  getNodePropertySupport,
  getSelectionProperties,
  getSelectionPropertiesKey,
  getSelectionPropertiesSnapshot,
  setSelectionColor,
  setSelectionProperty,
} from "./inspection/selection-properties";
export { createDefaultGroupNode } from "./nodes/group/model";
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
  isPathNode,
  isShapeNode,
  isTextNode,
  isVectorNode,
  rebuildTreeOrder,
} from "./nodes/node-tree";
export { createDefaultPathNode } from "./nodes/path/model";
export { createDefaultShapeNode } from "./nodes/shape/model";
export {
  ARCH_BEND_LIMIT,
  createDefaultNode,
  createId,
  DEFAULT_SLANT_RISE,
  getDefaultWarp,
  getNodeCssTransform,
  getNodeRotation,
  getNodeScaleX,
  getNodeScaleY,
  getNodeTransform,
  getNodeX,
  getNodeY,
  isNodeVisible,
  WAVE_CYCLES_MAX,
  WAVE_CYCLES_MIN,
  withNodeTransform,
} from "./nodes/text/model";
export {
  estimateBounds,
  inflateBounds,
  layoutGlyphs,
} from "./nodes/text/warp-layout";
export { VECTOR_ANCHOR_INTERACTION_RADIUS_PX } from "./nodes/vector/interaction-constants";
export { createDefaultVectorNode } from "./nodes/vector/model";
export {
  getVectorPathCursorMode,
  isVectorPathPointRole,
} from "./nodes/vector/path-edit-interaction";
export {
  setVectorPointHandlesFromAnchorDrag,
  setVectorPointType,
  updateVectorPointHandle,
} from "./nodes/vector/point-edit";
export { insertVectorPoint } from "./nodes/vector/point-insert";
export {
  getStableVectorCornerRadiusMax,
  getUniformVectorCornerRadius,
  getVectorPointCornerControl,
  setAllVectorPointCornerRadii,
  setVectorPointCornerRadius,
} from "./nodes/vector/vector-corner-controls";
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
  getPointerDistancePx,
  isPointerDistanceAtLeast,
  isPointerDistanceWithin,
} from "./primitives/pointer-distance";
export {
  getNodeLocalPoint,
  getNodeRotationCenter,
  getNodeWorldPoint,
} from "./primitives/rotation";
export {
  includesPathPoint,
  isSamePathPoint,
  normalizePathPoint,
  normalizePathPointSelection,
  toPathPointKey,
} from "./state/store/path/path-point-selection";
export type { PenHoverIntent, PenHoverState } from "./tools/pen-tool-types";
