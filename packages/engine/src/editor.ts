import {
  createLocalFontDescriptor,
  DEFAULT_LOCAL_FONT,
  ROOT_PARENT_ID,
} from "@punchpress/punch-schema";
import {
  copySelection as copyEditorSelection,
  pasteClipboardContent as pasteEditorClipboardContent,
  pasteText as pasteEditorText,
} from "./clipboard/clipboard-actions";
import { resetPasteSequence as resetEditorPasteSequence } from "./clipboard/clipboard-placement";
import { UI_ACCENT } from "./constants";
import { getEditorDebugDump } from "./debug-dump";
import {
  newDocument as createNewEditorDocument,
  exportDocument as exportEditorDocument,
  getDocument as getEditorDocument,
  loadDocument as loadEditorDocument,
  serializeDocument as serializeEditorDocument,
} from "./document/document-actions";
import {
  bringToFront as bringEditorToFront,
  deleteNode as deleteEditorNode,
  deleteSelected as deleteEditorSelected,
  duplicate as duplicateEditorNodes,
  groupSelected as groupEditorSelected,
  insertNodes as insertEditorNodes,
  moveNodeToParent as moveEditorNodeToParent,
  renameGroup as renameEditorGroup,
  sendToBack as sendEditorToBack,
  setNodeOrder as setEditorNodeOrder,
  toggleVisibility as toggleEditorVisibility,
  ungroup as ungroupEditorNodes,
  updateNode as updateEditorNode,
  updateNodes as updateEditorNodes,
  updateSelectedNode as updateEditorSelectedNode,
} from "./document/node-actions";
import {
  moveSelectedPathPointsBy as moveEditorSelectedPathPointsBy,
  updateEditablePath as updateEditorEditablePath,
  updateVectorContours as updateEditorVectorContours,
} from "./document/path/editable-path-actions";
import {
  applyBooleanOperation as applyEditorBooleanOperation,
  canApplyBooleanOperation as canEditorApplyBooleanOperation,
} from "./document/path/path-boolean-actions";
import { setVectorPathComposition as setEditorVectorPathComposition } from "./document/path/path-composition-actions";
import {
  canMakeCompoundPath as canEditorMakeCompoundPath,
  canReleaseCompoundPath as canEditorReleaseCompoundPath,
  makeCompoundPath as makeEditorCompoundPath,
  releaseCompoundPath as releaseEditorCompoundPath,
} from "./document/path/path-compound-actions";
import {
  canRoundPathPoint as canEditorRoundPathPoint,
  getPathCornerRadiusStableMax as getEditorPathCornerRadiusStableMax,
  getPathCornerRadiusSummary as getEditorPathCornerRadiusSummary,
  getPathPointCornerControl as getEditorPathPointCornerControl,
  getPathPointCornerRadius as getEditorPathPointCornerRadius,
  setPathCornerRadius as setEditorPathCornerRadius,
  setPathPointCornerRadius as setEditorPathPointCornerRadius,
} from "./document/path/path-corner-actions";
import {
  deletePathPoint as deleteEditorPathPoint,
  deletePathPoints as deleteEditorPathPoints,
  deleteVectorPoint as deleteEditorVectorPoint,
  getPathPointType as getEditorPathPointType,
  insertPathPoint as insertEditorPathPoint,
  insertVectorPoint as insertEditorVectorPoint,
  setPathPointType as setEditorPathPointType,
  setPathPointTypes as setEditorPathPointTypes,
  setVectorPointType as setEditorVectorPointType,
  setVectorPointTypes as setEditorVectorPointTypes,
} from "./document/path/path-point-actions";
import {
  canJoinVectorPathEndpoints as canEditorJoinVectorPathEndpoints,
  canSplitVectorPath as canEditorSplitVectorPath,
  joinVectorPathEndpoints as joinEditorVectorPathEndpoints,
  splitVectorPath as splitEditorVectorPath,
} from "./document/path/path-topology-actions";
import {
  addShapeNode as addEditorShapeNode,
  addTextNode as addEditorTextNode,
  addVectorNode as addEditorVectorNode,
  cancelEditing as cancelEditorEditing,
  commitEditing as commitEditorEditing,
  finalizeEditing as finalizeEditorEditing,
  finishEditingIfNeeded as finishEditorEditingIfNeeded,
  setActiveTool as setEditorActiveTool,
  setEditingText as setEditorEditingText,
  startEditing as startEditorEditing,
} from "./editing/editing-actions";
import {
  applyLocalFontCatalog as applyEditorLocalFontCatalog,
  getDefaultFont as getEditorDefaultFont,
  getFontPreviewFamily as getEditorFontPreviewFamily,
  getFontPreviewState as getEditorFontPreviewState,
  initializeLocalFonts as initializeEditorLocalFonts,
  preloadFontOptions as preloadEditorFontOptions,
  preloadFonts as preloadEditorFonts,
  requestLocalFonts as requestEditorLocalFonts,
  setLastUsedFont as setEditorLastUsedFont,
} from "./fonts/font-catalog-actions";
import {
  applyDocumentChange,
  createDocumentChange,
} from "./history/document-change";
import {
  handleCanvasShortcutKeyDown as handleEditorCanvasShortcutKeyDown,
  handleEditingShortcutKeyDown as handleEditorEditingShortcutKeyDown,
  handlePenDirectSelectionModifierDown as handleEditorPenDirectSelectionModifierDown,
  handlePenDirectSelectionModifierUp as handleEditorPenDirectSelectionModifierUp,
  handlePenPointTypeToggleModifierDown as handleEditorPenPointTypeToggleModifierDown,
  handlePenPointTypeToggleModifierUp as handleEditorPenPointTypeToggleModifierUp,
  handleSpaceDown as handleEditorSpaceDown,
  handleSpaceUp as handleEditorSpaceUp,
  handleWindowBlur as handleEditorWindowBlur,
  handleWindowKeyDown as handleEditorWindowKeyDown,
} from "./input/keyboard-shortcuts";
import { getPathEditingInspectorState as getEditorPathEditingInspectorState } from "./inspection/path/path-edit-inspector";
import { getSelectionBooleanOperations as getEditorSelectionBooleanOperations } from "./inspection/selection-boolean-operations";
import {
  getNodePropertySupport as getEditorNodePropertySupport,
  getSelectionProperties as getEditorSelectionProperties,
  getSelectionPropertiesKey as getEditorSelectionPropertiesKey,
  getSelectionPropertiesSnapshot as getEditorSelectionPropertiesSnapshot,
  setSelectionColor as setEditorSelectionColor,
  setSelectionProperty as setEditorSelectionProperty,
} from "./inspection/selection-properties";
import {
  beginSelectionDragInteraction as beginEditorSelectionDragInteraction,
  beginSelectionRotationInteraction as beginEditorSelectionRotationInteraction,
  beginTextPathPositioningInteraction as beginEditorTextPathPositioningInteraction,
  endSelectionDragInteraction as endEditorSelectionDragInteraction,
  endSelectionRotationInteraction as endEditorSelectionRotationInteraction,
  endTextPathPositioningInteraction as endEditorTextPathPositioningInteraction,
  startPathEditing as startEditorPathEditing,
  stopPathEditing as stopEditorPathEditing,
} from "./interaction/interaction-actions";
import { disposeEditor, mountEditor } from "./lifecycle/editor-lifecycle";
import {
  DEFAULT_EDITABLE_FONT_FAMILY,
  FontManager,
} from "./managers/font-manager";
import { GeometryManager } from "./managers/geometry-manager";
import { HistoryManager } from "./managers/history-manager";
import { VectorRenderSurfaceManager } from "./managers/vector-render-surface-manager";
import {
  buildNodeCapabilityGeometry,
  getNodeFrameFromGeometry,
} from "./nodes/node-capabilities";
import {
  getChildNodeIds,
  getDescendantLeafNodeIds,
  getEffectiveSelectionNodeIds,
  getSelectionTargetNodeId,
  isDescendantOf,
  isGroupNode,
} from "./nodes/node-tree";
import { getVectorPathEditingChildId } from "./nodes/vector/vector-path-composition";
import { beginNodePlacement as beginEditorNodePlacement } from "./placement/node-placement";
import {
  getCanvasTransformOverlayState as getEditorCanvasTransformOverlayState,
  getHoveredNodePreview as getEditorHoveredNodePreview,
  getTextPathOverlayState as getEditorTextPathOverlayState,
  getVectorPathOverlayState as getEditorVectorPathOverlayState,
} from "./queries/canvas-overlay-queries";
import {
  getEditablePathSession as getEditorEditablePathSession,
  getLayerRow as getEditorLayerRow,
  getNode as getEditorNode,
  getNodeEditCapabilities as getEditorNodeEditCapabilities,
  getNodeFrame as getEditorNodeFrame,
  getNodeGeometry as getEditorNodeGeometry,
  getNodeHitBounds as getEditorNodeHitBounds,
  getNodeRenderBounds as getEditorNodeRenderBounds,
  getNodeRenderFrame as getEditorNodeRenderFrame,
  getNodeRenderGeometry as getEditorNodeRenderGeometry,
  getNodeSelectionFrame as getEditorNodeSelectionFrame,
  getNodeTransformBounds as getEditorNodeTransformBounds,
  getNodeTransformFrame as getEditorNodeTransformFrame,
  getSelectionFrameKey as getEditorSelectionFrameKey,
  getSelectionPreviewDelta as getEditorSelectionPreviewDelta,
  getSelectionTransformFrame as getEditorSelectionTransformFrame,
} from "./queries/node-queries";
import {
  clearSelection as clearEditorSelection,
  clearSelectionPreservingFocus as clearEditorSelectionPreservingFocus,
  deselect as deselectEditorNode,
  ensureSelected as ensureEditorSelected,
  isSelected as isEditorSelected,
  select as selectEditorNode,
  setSelectedNodes as setEditorSelectedNodes,
  toggleSelection as toggleEditorSelection,
} from "./selection/selection-actions";
import { getSelectionBounds as getEditorSelectionBounds } from "./selection/selection-bounds";
import { createEditorStore } from "./state/store/create-editor-store";
import { HandTool } from "./tools/hand-tool";
import { PenTool } from "./tools/pen-tool";
import { PointerTool } from "./tools/pointer-tool";
import { ShapeTool } from "./tools/shape-tool";
import { TextTool } from "./tools/text-tool";
import {
  beginMoveSelection as beginEditorMoveSelection,
  commitMoveSelection as commitEditorMoveSelection,
  moveSelectionBy as moveEditorSelectionBy,
  updateMoveSelection as updateEditorMoveSelection,
} from "./transform/move-selection";
import {
  beginResizeSelection as beginEditorResizeSelection,
  resizeSelectionFromCorner as resizeEditorSelectionFromCorner,
  updateResizeSelection as updateEditorResizeSelection,
} from "./transform/resize-selection";
import {
  beginRotateSelection as beginEditorRotateSelection,
  rotateSelectionBy as rotateEditorSelectionBy,
  updateRotateSelection as updateEditorRotateSelection,
} from "./transform/rotate-selection";
import {
  beginSelectionDrag as beginEditorSelectionDrag,
  endSelectionDrag as endEditorSelectionDrag,
  updateSelectionDrag as updateEditorSelectionDrag,
} from "./transform/selection-drag";
import {
  beginTextPathEdit as beginEditorTextPathEdit,
  updateTextPathEdit as updateEditorTextPathEdit,
} from "./transform/text-path-edit";
import {
  cancelPendingViewportFocus as cancelEditorPendingViewportFocus,
  scheduleViewportFocus as scheduleEditorViewportFocus,
  zoomIn as zoomEditorIn,
  zoomOut as zoomEditorOut,
} from "./viewport/viewport-focus";
import { getViewportCenter as getEditorViewportCenter } from "./viewport/viewport-queries";
import { zoomViewportFromWheel as zoomEditorViewportFromWheel } from "./viewport/viewport-wheel-zoom";

// Intentional facade: keep the public editor API and durable subsystem wiring
// here, and move behavior-heavy implementation into capability modules.
export class Editor {
  constructor({ accent = UI_ACCENT, initialZoom = 1 } = {}) {
    this.accent = accent;
    this.availableFonts = [];
    this.defaultFont = createLocalFontDescriptor(DEFAULT_LOCAL_FONT);
    this.getInitialLocalFontCatalog = null;
    this.lastUsedFont = null;
    this.nodeElements = new Map();
    this.nodeTransformElements = new Map();
    this.viewerRef = null;
    this.hostRef = null;
    this.persistLastUsedFont = null;
    this.pendingViewportFocusFrame = null;
    this.requestLocalFontCatalog = null;
    this.viewportFocusRequest = 0;
    this.store = createEditorStore({
      initialZoom,
      resolveDefaultFont: () => this.defaultFont,
    });
    this.fonts = new FontManager({
      onChange: () => this.store.getState().bumpFontRevision(),
    });
    this.geometry = new GeometryManager(this.fonts);
    this.vectorRenderSurfaces = new VectorRenderSurfaceManager();
    this.tools = new Map([
      ["pointer", new PointerTool(this)],
      ["hand", new HandTool(this)],
      ["pen", new PenTool(this)],
      ["shape", new ShapeTool(this)],
      ["text", new TextTool(this)],
    ]);
    this.editingHistoryMark = null;
    this.lastPasteCount = 0;
    this.lastPasteKey = null;
    this.unsubscribe = null;
    this.localFontCatalogPromise = null;
    this.interactionPreviewListeners = new Set();
    this.interactionPreviewRevision = 0;
    this.placementSurfaceListeners = new Set();
    this.history = new HistoryManager({
      applyChange: applyDocumentChange,
      applyState: (nodes) => {
        const previousSelectedNodeIds = this.selectedNodeIds;
        this.getState().loadNodes(nodes);
        const nextSelectedNodeIds = previousSelectedNodeIds.filter((nodeId) => {
          return nodes.some((node) => node.id === nodeId);
        });

        if (nextSelectedNodeIds.length > 0) {
          this.getState().selectNodes(nextSelectedNodeIds);
        }

        if (typeof window === "undefined") {
          this.onViewportChange?.();
          return;
        }

        window.requestAnimationFrame(() => {
          this.onViewportChange?.();
        });
      },
      captureState: () => this.nodes,
      captureSnapshot: () => this.serializeDocument(),
      createChange: createDocumentChange,
    });
    this.handleWindowKeyDown = this.handleWindowKeyDown.bind(this);
    this.handlePenDirectSelectionModifierDown =
      this.handlePenDirectSelectionModifierDown.bind(this);
    this.handlePenDirectSelectionModifierUp =
      this.handlePenDirectSelectionModifierUp.bind(this);
    this.handlePenPointTypeToggleModifierDown =
      this.handlePenPointTypeToggleModifierDown.bind(this);
    this.handlePenPointTypeToggleModifierUp =
      this.handlePenPointTypeToggleModifierUp.bind(this);
    this.handleSpaceDown = this.handleSpaceDown.bind(this);
    this.handleSpaceUp = this.handleSpaceUp.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.onViewportChange = null;
    this.selectionPropertiesSnapshotCache = null;
    this.selectionDragPreviewState = null;
  }

  mount() {
    mountEditor(this);
  }

  dispose() {
    disposeEditor(this);
  }

  getState() {
    return this.store.getState();
  }

  get activeTool() {
    return this.getState().activeTool;
  }

  get nextShapeKind() {
    return this.getState().nextShapeKind;
  }

  get currentTool() {
    return this.tools.get(this.activeTool) || this.tools.get("pointer");
  }

  get canRedo() {
    return this.history.canRedo;
  }

  get canUndo() {
    return this.history.canUndo;
  }

  get editingNodeId() {
    return this.getState().editingNodeId;
  }

  get penDirectSelectionModifierPressed() {
    return this.getState().penDirectSelectionModifierPressed;
  }

  get editingNode() {
    return this.getNode(this.editingNodeId);
  }

  get editingText() {
    return this.getState().editingText;
  }

  get editingFont() {
    if (!this.editingNode) {
      return null;
    }

    return this.fonts.getLoadedFont(this.editingNode.font);
  }

  get editingFontFamily() {
    if (!this.editingNode) {
      return DEFAULT_EDITABLE_FONT_FAMILY;
    }

    return this.fonts.getEditableFontFamily(this.editingNode.font);
  }

  get editingPreviewNode() {
    if (!this.editingNode) {
      return null;
    }

    if (this.editingNode.type !== "text") {
      return this.editingNode;
    }

    return {
      ...this.editingNode,
      warp: { kind: "none" },
    };
  }

  get editingPreviewGeometry() {
    if (!(this.editingPreviewNode && this.editingFont)) {
      return null;
    }

    return buildNodeCapabilityGeometry(
      this.editingPreviewNode,
      this.editingFont
    );
  }

  get editingFrame() {
    if (!this.editingPreviewNode) {
      return null;
    }

    return getNodeFrameFromGeometry(
      this.editingPreviewNode,
      this.editingPreviewGeometry,
      "selection"
    );
  }

  get fontRevision() {
    return this.getState().fontRevision;
  }

  get bootstrapError() {
    return this.getState().fontCatalogError;
  }

  get bootstrapState() {
    const fontCatalogState = this.getState().fontCatalogState;

    if (fontCatalogState === "error") {
      return "error";
    }

    if (fontCatalogState === "loading") {
      return "loading";
    }

    return "ready";
  }

  get geometryById() {
    return this.geometry.getAll(this.nodes, this.fontRevision);
  }

  get nodes() {
    return this.getState().nodes;
  }

  get hoveredNodeId() {
    return this.getState().hoveredNodeId;
  }

  get focusedGroupId() {
    return this.getState().focusedGroupId;
  }

  get pathEditingNodeId() {
    return this.getState().pathEditingNodeId;
  }

  get pathEditingPoint() {
    return this.getState().pathEditingPoint;
  }

  get pathEditingPoints() {
    return this.getState().pathEditingPoints;
  }

  get isDirty() {
    return this.history.isDirty;
  }

  get isHoveringSuppressed() {
    return this.getState().isHoveringSuppressed;
  }

  get isSelectionDragging() {
    return this.getState().isSelectionDragging;
  }

  get selectionDragPreview() {
    return this.selectionDragPreviewState;
  }

  get isSelectionRotating() {
    return this.getState().isSelectionRotating;
  }

  get isTextPathPositioning() {
    return this.getState().isTextPathPositioning;
  }

  get layerNodeIds() {
    return [...getChildNodeIds(this.nodes, ROOT_PARENT_ID)].reverse();
  }

  get selectedNode() {
    return this.getNode(this.selectedNodeId);
  }

  get selectedNodes() {
    return this.selectedNodeIds
      .map((nodeId) => this.getNode(nodeId))
      .filter(Boolean);
  }

  get selectedNodeId() {
    return this.selectedNodeIds.at(-1) || null;
  }

  get selectedNodeIds() {
    return this.getState().selectedNodeIds;
  }

  canEditNodePath(nodeId = this.selectedNodeId) {
    const targetNodeId = this.getPathEditingEntryNodeId(nodeId);
    return Boolean(this.getNodeEditCapabilities(targetNodeId)?.canEditPath);
  }

  canStartPathEditing(nodeId = this.selectedNodeId) {
    const targetNodeId = this.getPathEditingEntryNodeId(nodeId);
    return Boolean(
      this.getNodeEditCapabilities(targetNodeId)?.requiresPathEditing
    );
  }

  isPathEditing(nodeId = this.pathEditingNodeId) {
    return Boolean(nodeId && this.pathEditingNodeId === nodeId);
  }

  get zoom() {
    return this.getState().viewport.zoom;
  }

  preloadFonts(nodes = this.nodes) {
    preloadEditorFonts(this, nodes);
  }

  preloadFontOptions(fonts) {
    preloadEditorFontOptions(this, fonts);
  }

  getFontPreviewState(font) {
    return getEditorFontPreviewState(this, font);
  }

  getFontPreviewFamily(font) {
    return getEditorFontPreviewFamily(this, font);
  }

  getDefaultFont() {
    return getEditorDefaultFont(this);
  }

  get fontCatalogState() {
    return this.getState().fontCatalogState;
  }

  setDefaultFont(font) {
    this.defaultFont = createLocalFontDescriptor(font || DEFAULT_LOCAL_FONT);
  }

  setFontBytesLoader(loadFontBytes) {
    this.fonts.setFontBytesLoader(loadFontBytes);
  }

  setLocalFontCatalogLoaders({ getInitialCatalog, requestCatalog }) {
    this.getInitialLocalFontCatalog = getInitialCatalog || null;
    this.requestLocalFontCatalog = requestCatalog || null;
  }

  setLastUsedFontPersistence(persistLastUsedFont) {
    this.persistLastUsedFont = persistLastUsedFont || null;
  }

  async initializeLocalFonts() {
    return await initializeEditorLocalFonts(this);
  }

  async requestLocalFonts() {
    return await requestEditorLocalFonts(this);
  }

  setLastUsedFont(font) {
    setEditorLastUsedFont(this, font);
  }

  applyLocalFontCatalog(catalog) {
    applyEditorLocalFontCatalog(this, catalog);
  }

  getNode(nodeId) {
    return getEditorNode(this, nodeId);
  }

  getChildNodeIds(parentId = ROOT_PARENT_ID) {
    return getChildNodeIds(this.nodes, parentId);
  }

  getDescendantLeafNodeIds(nodeId) {
    return getDescendantLeafNodeIds(this.nodes, nodeId);
  }

  getEffectiveSelectionNodeIds(nodeIds = this.selectedNodeIds) {
    return getEffectiveSelectionNodeIds(this.nodes, nodeIds);
  }

  getSelectionTargetNodeId(nodeId) {
    return getSelectionTargetNodeId(this.nodes, nodeId, this.focusedGroupId);
  }

  getPathEditingTargetNodeId(nodeId = this.selectedNodeId) {
    const node = this.getNode(nodeId);

    if (!node) {
      return null;
    }

    if (node.type === "vector" && this.isPathEditing(node.id)) {
      return getVectorPathEditingChildId(this, node.id);
    }

    return node.id;
  }

  getPathEditingEntryNodeId(nodeId = this.selectedNodeId) {
    const node = this.getNode(nodeId);

    if (node?.type === "vector") {
      return getVectorPathEditingChildId(this, node.id) || node.id;
    }

    return this.getPathEditingTargetNodeId(nodeId);
  }

  getPathEditingVisualOwnerNodeId(nodeId = this.pathEditingNodeId) {
    if (!nodeId) {
      return null;
    }

    return this.getSelectionTargetNodeId(nodeId) || nodeId;
  }

  sharesPathEditingVisualOwner(nodeId, otherNodeId = this.pathEditingNodeId) {
    if (!(nodeId && otherNodeId)) {
      return false;
    }

    return (
      this.getPathEditingVisualOwnerNodeId(nodeId) ===
      this.getPathEditingVisualOwnerNodeId(otherNodeId)
    );
  }

  isDescendantOf(nodeId, ancestorId) {
    return isDescendantOf(this.nodes, nodeId, ancestorId);
  }

  isGroupNode(nodeId) {
    return isGroupNode(this.getNode(nodeId));
  }

  isNodeEffectivelyVisible(nodeId) {
    const node = this.getNode(nodeId);
    if (!node || node.visible === false) {
      return false;
    }

    if (node.parentId === ROOT_PARENT_ID) {
      return true;
    }

    return this.isNodeEffectivelyVisible(node.parentId);
  }

  getLayerRow(nodeId) {
    return getEditorLayerRow(this, nodeId);
  }

  getNodeGeometry(nodeId) {
    return getEditorNodeGeometry(this, nodeId);
  }

  getNodeRenderGeometry(nodeId) {
    return getEditorNodeRenderGeometry(this, nodeId);
  }

  getNodeRenderFrame(nodeId) {
    return getEditorNodeRenderFrame(this, nodeId);
  }

  getHoveredNodePreview() {
    return getEditorHoveredNodePreview(this);
  }

  getCanvasTransformOverlayState() {
    return getEditorCanvasTransformOverlayState(this);
  }

  getTextPathOverlayState() {
    return getEditorTextPathOverlayState(this);
  }

  getVectorPathOverlayState() {
    return getEditorVectorPathOverlayState(this);
  }

  getNodeRenderBounds(nodeId) {
    return getEditorNodeRenderBounds(this, nodeId);
  }

  getNodeHitBounds(nodeId) {
    return getEditorNodeHitBounds(this, nodeId);
  }

  getNodeEditCapabilities(nodeId) {
    return getEditorNodeEditCapabilities(this, nodeId);
  }

  getEditablePathSession(nodeId = this.pathEditingNodeId) {
    return getEditorEditablePathSession(this, nodeId);
  }

  getNodePropertySupport(nodeId) {
    return getEditorNodePropertySupport(this.getNode(nodeId));
  }

  setSelectionProperty(propertyId, value, nodeIds = this.selectedNodeIds) {
    return setEditorSelectionProperty(this, propertyId, value, nodeIds);
  }

  setSelectionColor(selectionColorId, value, nodeIds = this.selectedNodeIds) {
    return setEditorSelectionColor(this, selectionColorId, value, nodeIds);
  }

  getSelectionBooleanOperations(nodeIds = this.selectedNodeIds) {
    return getEditorSelectionBooleanOperations(this, nodeIds);
  }

  canApplyBooleanOperation(operation, nodeIds = this.selectedNodeIds) {
    return canEditorApplyBooleanOperation(this, operation, nodeIds);
  }

  canMakeCompoundPath(nodeIds = this.selectedNodeIds) {
    return canEditorMakeCompoundPath(this, nodeIds);
  }

  canReleaseCompoundPath(nodeIds = this.selectedNodeIds) {
    return canEditorReleaseCompoundPath(this, nodeIds);
  }

  makeCompoundPath(nodeIds = this.selectedNodeIds) {
    return makeEditorCompoundPath(this, nodeIds);
  }

  releaseCompoundPath(nodeIds = this.selectedNodeIds) {
    return releaseEditorCompoundPath(this, nodeIds);
  }

  setVectorPathComposition(nodeId, pathComposition) {
    return setEditorVectorPathComposition(this, nodeId, pathComposition);
  }

  uniteSelection(nodeIds = this.selectedNodeIds) {
    return applyEditorBooleanOperation(this, "unite", nodeIds);
  }

  subtractSelection(nodeIds = this.selectedNodeIds) {
    return applyEditorBooleanOperation(this, "subtract", nodeIds);
  }

  intersectSelection(nodeIds = this.selectedNodeIds) {
    return applyEditorBooleanOperation(this, "intersect", nodeIds);
  }

  excludeSelection(nodeIds = this.selectedNodeIds) {
    return applyEditorBooleanOperation(this, "exclude", nodeIds);
  }

  getNodeSelectionFrame(nodeId) {
    return getEditorNodeSelectionFrame(this, nodeId);
  }

  getNodeTransformFrame(nodeId) {
    return getEditorNodeTransformFrame(this, nodeId);
  }

  getNodeTransformBounds(nodeId) {
    return getEditorNodeTransformBounds(this, nodeId);
  }

  getNodeFrame(nodeId) {
    return getEditorNodeFrame(this, nodeId);
  }

  getSelectionTransformFrame(nodeIds = this.selectedNodeIds) {
    return getEditorSelectionTransformFrame(this, nodeIds);
  }

  getSelectionPreviewDelta(nodeIds = this.selectedNodeIds) {
    return getEditorSelectionPreviewDelta(this, nodeIds);
  }

  getInteractionPreviewRevision() {
    return this.interactionPreviewRevision;
  }

  getPenPreviewState() {
    return this.tools.get("pen")?.getPreviewState?.() || null;
  }

  getPenHoverState() {
    return this.tools.get("pen")?.getHoverState?.() || null;
  }

  getSelectionFrameKey(nodeIds = this.selectedNodeIds) {
    return getEditorSelectionFrameKey(this, nodeIds);
  }

  getSelectionBounds(nodeIds = this.selectedNodeIds) {
    return getEditorSelectionBounds(this, nodeIds);
  }

  getSelectionProperties(nodeIds = this.selectedNodeIds) {
    return getEditorSelectionProperties(this, nodeIds);
  }

  getSelectionPropertiesKey(nodeIds = this.selectedNodeIds) {
    return getEditorSelectionPropertiesKey(this, nodeIds);
  }

  getSelectionPropertiesSnapshot(nodeIds = this.selectedNodeIds) {
    const state = this.getState();
    const nodeIdsKey = nodeIds.join("\0");
    const cachedSnapshot = this.selectionPropertiesSnapshotCache;

    if (
      cachedSnapshot &&
      cachedSnapshot.fontRevision === state.fontRevision &&
      cachedSnapshot.nodeIdsKey === nodeIdsKey &&
      cachedSnapshot.nodes === state.nodes
    ) {
      return cachedSnapshot.snapshot;
    }

    const snapshot = getEditorSelectionPropertiesSnapshot(this, nodeIds);

    this.selectionPropertiesSnapshotCache = {
      fontRevision: state.fontRevision,
      nodeIdsKey,
      nodes: state.nodes,
      snapshot,
    };

    return snapshot;
  }

  getDebugDump() {
    return getEditorDebugDump(this);
  }

  getDocument() {
    return getEditorDocument(this);
  }

  addTextNode(point) {
    addEditorTextNode(this, point);
  }

  addShapeNode(point, shape) {
    addEditorShapeNode(this, point, shape);
  }

  addVectorNode(point) {
    addEditorVectorNode(this, point);
  }

  insertNodes(nodes) {
    insertEditorNodes(this, nodes);
  }

  cancelEditing() {
    cancelEditorEditing(this);
  }

  clearSelection() {
    clearEditorSelection(this);
  }

  clearSelectionPreservingFocus() {
    clearEditorSelectionPreservingFocus(this);
  }

  commitEditing() {
    commitEditorEditing(this);
  }

  copySelection() {
    return copyEditorSelection(this);
  }

  deleteSelected() {
    deleteEditorSelected(this);
  }

  deleteVectorPoint(
    nodeId = this.pathEditingNodeId,
    point = this.pathEditingPoint
  ) {
    if (!(nodeId && point)) {
      return false;
    }

    return deleteEditorVectorPoint(this, nodeId, point);
  }

  deletePathPoint(
    nodeId = this.pathEditingNodeId,
    point = this.pathEditingPoint
  ) {
    if (!(nodeId && point)) {
      return false;
    }

    return deleteEditorPathPoint(this, nodeId, point);
  }

  deletePathPoints(
    nodeId = this.pathEditingNodeId,
    points = this.pathEditingPoints
  ) {
    if (!(nodeId && points?.length > 0)) {
      return false;
    }

    return deleteEditorPathPoints(this, nodeId, points);
  }

  deleteNode(nodeId) {
    deleteEditorNode(this, nodeId);
  }

  dispatchCanvasPointerDown(info) {
    return this.currentTool.onCanvasPointerDown(info);
  }

  dispatchCanvasPointerLeave(info) {
    return this.currentTool.onCanvasPointerLeave(info);
  }

  dispatchCanvasPointerMove(info) {
    return this.currentTool.onCanvasPointerMove(info);
  }

  dispatchNodePointerDown(info) {
    return this.currentTool.onNodePointerDown(info);
  }

  duplicate(nodeId) {
    duplicateEditorNodes(this, nodeId);
  }

  groupSelected() {
    groupEditorSelected(this);
  }

  async exportDocument() {
    return await exportEditorDocument(this);
  }

  finalizeEditing() {
    finalizeEditorEditing(this);
  }

  handleEditingShortcutKeyDown(event, key) {
    return handleEditorEditingShortcutKeyDown(this, event, key);
  }

  handleCanvasShortcutKeyDown(event, key) {
    return handleEditorCanvasShortcutKeyDown(this, event, key);
  }

  handleWindowKeyDown(event) {
    handleEditorWindowKeyDown(this, event);
  }

  handlePenDirectSelectionModifierDown(event) {
    handleEditorPenDirectSelectionModifierDown(this, event);
  }

  handlePenDirectSelectionModifierUp(event) {
    handleEditorPenDirectSelectionModifierUp(this, event);
  }

  handlePenPointTypeToggleModifierDown(event) {
    handleEditorPenPointTypeToggleModifierDown(this, event);
  }

  handlePenPointTypeToggleModifierUp(event) {
    handleEditorPenPointTypeToggleModifierUp(this, event);
  }

  handleWindowBlur() {
    handleEditorWindowBlur(this);
  }

  get penPointTypeToggleModifierPressed() {
    return this.getState().penPointTypeToggleModifierPressed;
  }

  select(nodeId) {
    selectEditorNode(this, nodeId);
  }

  setSelectedNodes(nodeIds) {
    setEditorSelectedNodes(this, nodeIds);
  }

  toggleSelection(nodeId) {
    toggleEditorSelection(this, nodeId);
  }

  ungroup(nodeId) {
    ungroupEditorNodes(this, nodeId);
  }

  deselect(nodeId) {
    deselectEditorNode(this, nodeId);
  }

  setHoveredNode(nodeId) {
    this.getState().setHoveredNodeId(nodeId);
  }

  setFocusedGroup(nodeId) {
    this.getState().setFocusedGroupId(nodeId);
  }

  exitGroupFocus() {
    if (!this.focusedGroupId) {
      return;
    }

    const currentFocusedGroupId = this.focusedGroupId;
    const focusedGroup = this.getNode(currentFocusedGroupId);
    const nextFocusedGroupId =
      focusedGroup?.parentId && focusedGroup.parentId !== ROOT_PARENT_ID
        ? focusedGroup.parentId
        : null;

    this.getState().setFocusedGroupId(nextFocusedGroupId);
    this.getState().selectNode(currentFocusedGroupId);
  }

  setHoveringSuppressed(isHoveringSuppressed) {
    this.getState().setHoveringSuppressed(isHoveringSuppressed);
  }

  setSelectionDragging(isSelectionDragging) {
    this.getState().setSelectionDragging(isSelectionDragging);
  }

  setSelectionDragPreview(selectionDragPreview) {
    this.selectionDragPreviewState = selectionDragPreview || null;
    this.notifyInteractionPreviewChanged();
  }

  notifyInteractionPreviewChanged() {
    this.interactionPreviewRevision += 1;

    for (const listener of this.interactionPreviewListeners) {
      listener();
    }
  }

  setSelectionRotating(isSelectionRotating) {
    this.getState().setSelectionRotating(isSelectionRotating);
  }

  subscribeInteractionPreview(listener) {
    this.interactionPreviewListeners.add(listener);

    return () => {
      this.interactionPreviewListeners.delete(listener);
    };
  }

  notifyPlacementSurfaceApplied() {
    for (const listener of this.placementSurfaceListeners) {
      listener();
    }
  }

  subscribePlacementSurface(listener) {
    this.placementSurfaceListeners.add(listener);

    return () => {
      this.placementSurfaceListeners.delete(listener);
    };
  }

  setTextPathPositioning(isTextPathPositioning) {
    this.getState().setTextPathPositioning(isTextPathPositioning);
  }

  beginSelectionDragInteraction() {
    beginEditorSelectionDragInteraction(this);
  }

  endSelectionDragInteraction() {
    endEditorSelectionDragInteraction(this);
  }

  beginSelectionRotationInteraction() {
    beginEditorSelectionRotationInteraction(this);
  }

  endSelectionRotationInteraction() {
    endEditorSelectionRotationInteraction(this);
  }

  beginTextPathPositioningInteraction() {
    beginEditorTextPathPositioningInteraction(this);
  }

  endTextPathPositioningInteraction() {
    endEditorTextPathPositioningInteraction(this);
  }

  ensureSelected(nodeId) {
    ensureEditorSelected(this, nodeId);
  }

  setActiveTool(toolId) {
    setEditorActiveTool(this, toolId);
  }

  setNextShapeKind(shape) {
    this.getState().setNextShapeKind(shape);
  }

  setPathEditingNodeId(nodeId) {
    this.getState().setPathEditingNodeId(nodeId);
  }

  ensurePathEditingTargetForPointSelection() {
    if (this.pathEditingNodeId) {
      return;
    }

    const targetNodeId = this.getPathEditingEntryNodeId(this.selectedNodeId);

    if (!(targetNodeId && this.canEditNodePath(targetNodeId))) {
      return;
    }

    this.getState().setPathEditingNodeId(targetNodeId);
  }

  setPathEditingPoint(point) {
    if (point) {
      this.ensurePathEditingTargetForPointSelection();
    }

    this.getState().setPathEditingPoint(point);
  }

  setPathEditingPoints(points, primaryPoint = null) {
    if ((points?.length || 0) > 0) {
      this.ensurePathEditingTargetForPointSelection();
    }

    this.getState().setPathEditingPoints(points, primaryPoint);
  }

  clearPathEditingSelection() {
    this.ensurePathEditingTargetForPointSelection();
    this.getState().setPathEditingPoints([]);
  }

  getVectorPointType(nodeId, point = this.pathEditingPoint) {
    const node = this.getNode(nodeId);

    if (!(node && point)) {
      return null;
    }

    if (node.type === "path") {
      return node.segments[point.segmentIndex]?.pointType || null;
    }

    if (node.type !== "vector") {
      return null;
    }

    return (
      node.contours[point.contourIndex]?.segments[point.segmentIndex]
        ?.pointType || null
    );
  }

  getPathPointType(
    nodeId = this.pathEditingNodeId,
    point = this.pathEditingPoint
  ) {
    if (!(nodeId && point)) {
      return null;
    }

    return getEditorPathPointType(this, nodeId, point);
  }

  canRoundPathPoint(
    nodeId = this.pathEditingNodeId,
    point = this.pathEditingPoint
  ) {
    if (!(nodeId && point)) {
      return false;
    }

    return canEditorRoundPathPoint(this, nodeId, point);
  }

  getPathPointCornerRadius(
    nodeId = this.pathEditingNodeId,
    point = this.pathEditingPoint
  ) {
    if (!(nodeId && point)) {
      return 0;
    }

    return getEditorPathPointCornerRadius(this, nodeId, point);
  }

  getPathPointCornerControl(
    nodeId = this.pathEditingNodeId,
    point = this.pathEditingPoint
  ) {
    if (!(nodeId && point)) {
      return null;
    }

    return getEditorPathPointCornerControl(this, nodeId, point);
  }

  getPathCornerRadiusSummary(nodeId = this.pathEditingNodeId) {
    if (!nodeId) {
      return null;
    }

    return getEditorPathCornerRadiusSummary(this, nodeId);
  }

  getPathCornerRadiusStableMax(nodeId = this.pathEditingNodeId) {
    if (!nodeId) {
      return 0;
    }

    return getEditorPathCornerRadiusStableMax(this, nodeId);
  }

  getPathEditingInspectorState(nodeId = this.selectedNodeId) {
    return getEditorPathEditingInspectorState(
      this,
      this.getPathEditingTargetNodeId(nodeId)
    );
  }

  setVectorPointType(
    pointType,
    nodeId = this.pathEditingNodeId,
    point = this.pathEditingPoint
  ) {
    if (!nodeId) {
      return false;
    }

    if (point) {
      return setEditorVectorPointType(this, nodeId, point, pointType);
    }

    if (this.pathEditingPoints.length === 0) {
      return false;
    }

    return setEditorVectorPointTypes(
      this,
      nodeId,
      this.pathEditingPoints,
      pointType
    );
  }

  setPathPointType(
    pointType,
    nodeId = this.pathEditingNodeId,
    point = this.pathEditingPoint
  ) {
    if (!nodeId) {
      return false;
    }

    if (point) {
      return setEditorPathPointType(this, nodeId, point, pointType);
    }

    if (this.pathEditingPoints.length === 0) {
      return false;
    }

    return setEditorPathPointTypes(
      this,
      nodeId,
      this.pathEditingPoints,
      pointType
    );
  }

  setPathPointCornerRadius(
    cornerRadius,
    nodeId = this.pathEditingNodeId,
    point = this.pathEditingPoint,
    sourceNode = null
  ) {
    if (!(nodeId && point)) {
      return false;
    }

    return setEditorPathPointCornerRadius(
      this,
      nodeId,
      point,
      cornerRadius,
      sourceNode
    );
  }

  setPathCornerRadius(
    cornerRadius,
    nodeId = this.pathEditingNodeId,
    sourceNode = null
  ) {
    if (!nodeId) {
      return false;
    }

    return setEditorPathCornerRadius(this, nodeId, cornerRadius, sourceNode);
  }

  canSplitPath(nodeId = this.pathEditingNodeId, point = this.pathEditingPoint) {
    if (!(nodeId && point)) {
      return false;
    }

    return canEditorSplitVectorPath(this.getNode(nodeId), point);
  }

  splitPath(nodeId = this.pathEditingNodeId, point = this.pathEditingPoint) {
    if (!(nodeId && point)) {
      return false;
    }

    return splitEditorVectorPath(this, nodeId, point);
  }

  canJoinPathEndpoints(
    nodeId = this.pathEditingNodeId,
    points = this.pathEditingPoints
  ) {
    if (!(nodeId && points?.length > 0)) {
      return false;
    }

    return canEditorJoinVectorPathEndpoints(this.getNode(nodeId), points);
  }

  joinPathEndpoints(
    nodeId = this.pathEditingNodeId,
    points = this.pathEditingPoints
  ) {
    if (!(nodeId && points?.length > 0)) {
      return false;
    }

    return joinEditorVectorPathEndpoints(this, nodeId, points);
  }

  insertVectorPoint(target, nodeId = this.pathEditingNodeId) {
    if (!nodeId) {
      return false;
    }

    return insertEditorVectorPoint(this, nodeId, target);
  }

  insertPathPoint(target, nodeId = this.pathEditingNodeId) {
    if (!nodeId) {
      return false;
    }

    return insertEditorPathPoint(this, nodeId, target);
  }

  moveSelectedPathPointsBy(delta, nodeId = this.pathEditingNodeId) {
    if (!(nodeId && delta)) {
      return false;
    }

    return moveEditorSelectedPathPointsBy(this, nodeId, delta);
  }

  setEditingText(value) {
    setEditorEditingText(this, value);
  }

  setSelectedText(text) {
    if (!this.selectedNode) {
      return null;
    }

    updateEditorSelectedNode(this, { text });
    return this.selectedNodeId;
  }

  setSelectedFont(font) {
    if (!this.selectedNode) {
      return null;
    }

    updateEditorSelectedNode(this, {
      font: createLocalFontDescriptor(font),
    });
    return this.selectedNodeId;
  }

  setNodeOrder(nodeIds, parentId) {
    setEditorNodeOrder(this, nodeIds, parentId);
  }

  moveNodeToParent(nodeId, parentId, beforeNodeId) {
    moveEditorNodeToParent(this, nodeId, parentId, beforeNodeId);
  }

  renameGroup(nodeId, name) {
    renameEditorGroup(this, nodeId, name);
  }

  setViewportZoom(zoom) {
    this.getState().setViewportZoom(zoom);
  }

  startPathEditing(nodeId = this.selectedNodeId) {
    return startEditorPathEditing(this, this.getPathEditingEntryNodeId(nodeId));
  }

  stopPathEditing() {
    return stopEditorPathEditing(this);
  }

  togglePathEditing(nodeId = this.selectedNodeId) {
    const targetNodeId = this.getPathEditingEntryNodeId(nodeId);

    if (this.isPathEditing(targetNodeId)) {
      return this.stopPathEditing();
    }

    return this.startPathEditing(targetNodeId);
  }

  moveSelectionBy(options) {
    return moveEditorSelectionBy(this, options);
  }

  resizeSelectionFromCorner(options) {
    return resizeEditorSelectionFromCorner(this, options);
  }

  rotateSelectionBy(options) {
    return rotateEditorSelectionBy(this, options);
  }

  beginResizeSelection(options) {
    return beginEditorResizeSelection(this, options);
  }

  updateResizeSelection(session, options) {
    return updateEditorResizeSelection(this, session, options);
  }

  beginMoveSelection(options) {
    return beginEditorMoveSelection(this, options);
  }

  updateMoveSelection(session, options) {
    return updateEditorMoveSelection(this, session, options);
  }

  commitMoveSelection(session) {
    return commitEditorMoveSelection(this, session);
  }

  beginSelectionDrag(options) {
    return beginEditorSelectionDrag(this, options);
  }

  updateSelectionDrag(session, options) {
    return updateEditorSelectionDrag(this, session, options);
  }

  endSelectionDrag(session, options) {
    return endEditorSelectionDrag(this, session, options);
  }

  beginRotateSelection(options) {
    return beginEditorRotateSelection(this, options);
  }

  updateRotateSelection(session, options) {
    return updateEditorRotateSelection(this, session, options);
  }

  beginTextPathEdit(options) {
    return beginEditorTextPathEdit(this, options);
  }

  updateTextPathEdit(session, options) {
    return updateEditorTextPathEdit(this, session, options);
  }

  beginNodePlacement(options) {
    return beginEditorNodePlacement(this, options);
  }

  toggleVisibility(nodeId) {
    toggleEditorVisibility(this, nodeId);
  }

  sendToBack(nodeId) {
    sendEditorToBack(this, nodeId);
  }

  startEditing(node) {
    startEditorEditing(this, node);
  }

  updateNode(nodeId, updater) {
    updateEditorNode(this, nodeId, updater);
  }

  updateVectorContours(nodeId, contours, options) {
    return updateEditorVectorContours(this, nodeId, contours, options);
  }

  updateEditablePath(nodeId, contours, options) {
    return updateEditorEditablePath(this, nodeId, contours, options);
  }

  updateNodes(nodeIds, updater) {
    updateEditorNodes(this, nodeIds, updater);
  }

  updateSelectedNode(updater) {
    updateEditorSelectedNode(this, updater);
  }

  bringToFront(nodeId) {
    bringEditorToFront(this, nodeId);
  }

  isSelected(nodeId) {
    return isEditorSelected(this, nodeId);
  }

  loadDocument(contents) {
    return loadEditorDocument(this, contents);
  }

  newDocument() {
    createNewEditorDocument(this);
  }

  registerNodeElement(nodeId, element) {
    if (element) {
      this.nodeElements.set(nodeId, element);
    } else {
      this.nodeElements.delete(nodeId);
    }
  }

  registerNodeTransformElement(nodeId, element) {
    const currentElement = this.nodeTransformElements.get(nodeId) || null;

    if (currentElement === element) {
      return;
    }

    if (element) {
      this.nodeTransformElements.set(nodeId, element);
    } else {
      this.nodeTransformElements.delete(nodeId);
    }

    this.notifyInteractionPreviewChanged();
  }

  serializeDocument() {
    return serializeEditorDocument(this);
  }

  markDocumentSaved() {
    this.history.markSaved();
  }

  markHistoryStep(name) {
    return this.history.mark(name);
  }

  commitHistoryStep(mark) {
    return this.history.commitMark(mark);
  }

  revertToMark(mark) {
    return this.history.revertToMark(mark);
  }

  redo() {
    return this.history.redo();
  }

  undo() {
    return this.history.undo();
  }

  resetHistory() {
    this.history.reset();
    this.editingHistoryMark = null;
  }

  resetPasteSequence() {
    resetEditorPasteSequence(this);
  }

  finishEditingIfNeeded() {
    finishEditorEditingIfNeeded(this);
  }

  run(runChange) {
    this.history.run(runChange);
  }

  getNodeElement(nodeId) {
    return this.nodeElements.get(nodeId) || null;
  }

  getNodeTransformElement(nodeId) {
    return this.nodeTransformElements.get(nodeId) || null;
  }

  zoomIn() {
    zoomEditorIn(this);
  }

  zoomOut() {
    zoomEditorOut(this);
  }

  getViewportCenter() {
    return getEditorViewportCenter(this);
  }

  zoomViewportFromWheel(options) {
    return zoomEditorViewportFromWheel(this, options);
  }

  handleSpaceDown(event) {
    handleEditorSpaceDown(this, event);
  }

  handleSpaceUp(event) {
    handleEditorSpaceUp(this, event);
  }

  cancelPendingViewportFocus() {
    cancelEditorPendingViewportFocus(this);
  }

  pasteClipboardContent(content) {
    pasteEditorClipboardContent(this, content);
  }

  pasteText(text) {
    pasteEditorText(this, text);
  }

  scheduleViewportFocus(nodeIds) {
    scheduleEditorViewportFocus(this, nodeIds);
  }

  loadLocalFontCatalog(loadCatalog, { force = false } = {}) {
    if (!force && this.localFontCatalogPromise) {
      return this.localFontCatalogPromise;
    }

    this.localFontCatalogPromise = loadCatalog()
      .then((catalog) => {
        this.applyLocalFontCatalog(catalog);
        return catalog;
      })
      .catch((error) => {
        this.localFontCatalogPromise = null;
        throw error;
      });

    return this.localFontCatalogPromise;
  }
}
