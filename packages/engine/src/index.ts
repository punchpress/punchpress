// biome-ignore-all lint/performance/noBarrelFile: package root public API

export {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
} from "@punchpress/punch-schema";
export type {
  AppearanceList,
  AppearanceSlot,
} from "./appearance/appearance-commands";
export {
  buildAppearanceElements,
  type SvgElement,
} from "./appearance/appearance-elements";
export {
  areAppearancesEqual,
  createSolidAppearance,
} from "./appearance/appearance-layers";
export { resolveDrawPaint } from "./appearance/appearance-paint-servers";
export {
  buildAppearanceObjects,
  getAppearanceDraws,
  getAppearancePasses,
  getPrimaryPaint,
} from "./appearance/appearance-render-plan";
export type {
  Appearance,
  AppearanceDraw,
  AppearanceObject,
  AppearancePass,
  AppearancePath,
  Bounds,
  FillLayer,
  Paint,
  StrokeLayer,
} from "./appearance/appearance-types";
export { getNodeAppearance } from "./appearance/node-appearance";
export {
  convertPaint,
  getGradientAngle,
  insertGradientStop,
  removeGradientStop,
  rotateGradientTo,
  sampleGradient,
} from "./appearance/paint";
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
export {
  canJoinCurves,
  canMergeCurves,
  canSeparateCurves,
  hasMixedCurveStyles,
  joinCurves,
  mergeCurves,
  separateCurves,
} from "./document/path/path-curve-actions";
export {
  insertComponentNodes,
  recipeToComponentNodes,
} from "./document/recipe-component-nodes";
export { Editor } from "./editor";
export {
  getNodePropertySupport,
  getSelectionProperties,
  getSelectionPropertiesKey,
  getSelectionPropertiesSnapshot,
  setSelectionColor,
  setSelectionProperty,
} from "./inspection/selection-properties";
export { createDefaultArtboardNode } from "./nodes/artboard/model";
export { createDefaultEmptyNode } from "./nodes/empty/model";
export { createDefaultGroupNode } from "./nodes/group/model";
export { createDefaultImageNode } from "./nodes/image/model";
export { getNodeSourceKind } from "./nodes/node-capabilities";
export {
  getAncestorNodeIds,
  getChildNodeIds,
  getChildNodes,
  getDescendantLeafNodeIds,
  getSelectionTargetNodeId,
  getSubtreeNodeIds,
  getTreeScopeParentId,
  isArtboardNode,
  isContainerNode,
  isDescendantOf,
  isEmptyNode,
  isGroupNode,
  isImageNode,
  isPathNode,
  isShapeNode,
  isTextNode,
  isVectorNode,
  rebuildTreeOrder,
} from "./nodes/node-tree";
export { createDefaultPathNode } from "./nodes/path/model";
export {
  getPathNodeContour,
  getPathNodeContourCount,
  getPathNodeContours,
  getPathNodePrimaryContour,
  normalizePathNodeContours,
  withPathNodeContours,
} from "./nodes/path/path-contours";
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
export { resolveTrackingPx, TEXT_TRACKING_RANGE } from "./nodes/text/tracking";
export {
  estimateBounds,
  inflateBounds,
  layoutGlyphs,
} from "./nodes/text/warp-layout";
export { VECTOR_ANCHOR_INTERACTION_RADIUS_PX } from "./nodes/vector/interaction-constants";
export {
  createDefaultVectorContainerNode,
  createDefaultVectorNode,
} from "./nodes/vector/model";
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
export type { PerfSpanSample } from "./perf/perf-hooks";
export {
  incrementPerfCounter,
  measurePerf,
  recordPerfSpan,
  setPerfLogConfig,
  setPerfSink,
} from "./perf/perf-hooks";
export type { PerfCounterName, PerfSpanLabel } from "./perf/perf-labels";
export { PERF_COUNTERS, PERF_SPANS } from "./perf/perf-labels";
export {
  isInputElement,
  shouldIgnoreGlobalShortcutTarget,
} from "./primitives/dom";
export { getResizeCorner } from "./primitives/group-resize";
export { clamp, format, round, toNumber, toSafeHex } from "./primitives/math";
export type { GestureTolerance } from "./primitives/pointer-distance";
export {
  GESTURE_TOLERANCES_PX,
  getGestureTolerancePx,
  getGestureToleranceSquared,
  getPointerDistancePx,
  getPointerDistanceSquared,
  hasPointerMovedAtLeast,
  hasPointerMovedWithin,
  isPointerDistanceAtLeast,
  isPointerDistanceWithin,
} from "./primitives/pointer-distance";
export {
  getNodeLocalPoint,
  getNodeRotationCenter,
  getNodeWorldPoint,
} from "./primitives/rotation";
export type {
  RasterBrushPreset,
  RasterBrushPresetSettings,
} from "./raster/brush-preset";
export {
  defineRasterBrushPreset,
  getRasterBrushPreset,
  PUNCHPRESS_RASTER_BRUSH_PRESET_VERSION,
  RASTER_BRUSH_PRESETS,
} from "./raster/brush-preset";
export type { SampledBrushTipAsset } from "./raster/brush-tip-assets";
export { getSampledBrushTipAsset } from "./raster/brush-tip-assets";
export type {
  RasterBrushTip,
  RasterCommit,
  RasterDab,
  RasterDirtyRegion,
  RasterOperation,
  RasterPixelSize,
  RasterPoint,
  RasterRect,
  RasterStrokeContext,
  RasterStrokeSettings,
  RasterSurface,
  RasterSurfaceResolver,
  RasterSurfaceSession,
  RasterTarget,
} from "./raster/contracts";
export type { RasterCropRect } from "./raster/crop";
export {
  getCroppedImageNode,
  MAX_RASTER_CROP_AREA,
  MAX_RASTER_CROP_DIMENSION,
  normalizeRasterCropRect,
} from "./raster/crop";
export { createRasterDabGenerator } from "./raster/dab-generator";
export { getRasterDabSpacing } from "./raster/dab-spacing";
export type {
  RasterFidelityComparison,
  RasterFidelityFixture,
  RasterFidelityFixtureSuite,
} from "./raster/fidelity";
export {
  compareRasterDabsExact,
  compareRasterDabsTolerant,
  RASTER_FIDELITY_FIXTURE_VERSION,
} from "./raster/fidelity";
export type {
  RasterOperationRecorder,
  RecordedRasterCommit,
} from "./raster/operation-recorder";
export { createRasterOperationRecorder } from "./raster/operation-recorder";
export type {
  RasterPixelFootprint,
  RasterPixelFootprintOptions,
  RasterSampling,
} from "./raster/presentation";
export {
  getRasterPixelFootprint,
  getRasterSampling,
  PIXEL_GRID_SCREEN_PIXEL_THRESHOLD,
  RASTER_MAGNIFIED_SCREEN_PIXEL_THRESHOLD,
  shouldShowPixelGrid,
  shouldUseFullResolutionRasterSource,
} from "./raster/presentation";
export type { RasterStroke } from "./raster/stroke";
export { createRasterStroke } from "./raster/stroke";
export type {
  RenderItem,
  RenderLayer,
  RenderLeaf,
  RenderTree,
} from "./render-tree/render-tree";
export {
  includesPathPoint,
  isSamePathPoint,
  normalizePathPoint,
  normalizePathPointSelection,
  toPathPointKey,
} from "./state/store/path/path-point-selection";
export type { PenHoverIntent, PenHoverState } from "./tools/pen-tool-types";
export {
  getNodeLocalMatrix,
  getNodeLocalTransformBounds,
  invertMatrix,
  multiplyMatrix,
} from "./transform/node-transform-matrix";
export type { PixelGridTarget } from "./viewport/pixel-grid-target";
export { getPixelGridTarget } from "./viewport/pixel-grid-target";
