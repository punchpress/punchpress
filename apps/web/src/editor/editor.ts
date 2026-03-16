import { UI_ACCENT } from "./constants";
import { getEditorDebugDump } from "./debug-dump";
import { getStoredLastUsedFont } from "./default-font";
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
  sendToBack as sendEditorToBack,
  setNodeOrder as setEditorNodeOrder,
  toggleVisibility as toggleEditorVisibility,
  updateNode as updateEditorNode,
  updateNodes as updateEditorNodes,
  updateSelectedNode as updateEditorSelectedNode,
} from "./document/node-actions";
import { getEditableNodeFrame } from "./editable-node-frame";
import {
  addTextNode as addEditorTextNode,
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
  handleSpaceDown as handleEditorSpaceDown,
  handleSpaceUp as handleEditorSpaceUp,
  handleWindowKeyDown as handleEditorWindowKeyDown,
} from "./input/keyboard-shortcuts";
import { disposeEditor, mountEditor } from "./lifecycle/editor-lifecycle";
import { createLocalFontDescriptor, DEFAULT_LOCAL_FONT } from "./local-fonts";
import {
  DEFAULT_EDITABLE_FONT_FAMILY,
  FontManager,
} from "./managers/font-manager";
import { GeometryManager } from "./managers/geometry-manager";
import { HistoryManager } from "./managers/history-manager";
import {
  getLayerRow as getEditorLayerRow,
  getNode as getEditorNode,
  getNodeFrame as getEditorNodeFrame,
  getNodeGeometry as getEditorNodeGeometry,
  getSelectionFrameKey as getEditorSelectionFrameKey,
} from "./queries/node-queries";
import {
  clearSelection as clearEditorSelection,
  deselect as deselectEditorNode,
  ensureSelected as ensureEditorSelected,
  isSelected as isEditorSelected,
  select as selectEditorNode,
  setSelectedNodes as setEditorSelectedNodes,
  toggleSelection as toggleEditorSelection,
} from "./selection/selection-actions";
import { getSelectionBounds as getEditorSelectionBounds } from "./selection/selection-bounds";
import { buildNodeGeometry } from "./shapes/warp-text/warp-engine";
import { createEditorStore } from "./state/store/create-editor-store";
import { HandTool } from "./tools/hand-tool";
import { PointerTool } from "./tools/pointer-tool";
import { TextTool } from "./tools/text-tool";
import {
  beginMoveSelection as beginEditorMoveSelection,
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
  cancelPendingViewportFocus as cancelEditorPendingViewportFocus,
  scheduleViewportFocus as scheduleEditorViewportFocus,
  zoomIn as zoomEditorIn,
  zoomOut as zoomEditorOut,
} from "./viewport/viewport-focus";

// Intentional facade: keep the public editor API and durable subsystem wiring
// here, and move behavior-heavy implementation into capability modules.
export class Editor {
  constructor({ accent = UI_ACCENT, initialZoom = 1 } = {}) {
    this.accent = accent;
    this.availableFonts = [];
    this.lastUsedFont = getStoredLastUsedFont();
    this.defaultFont = createLocalFontDescriptor(
      this.lastUsedFont || DEFAULT_LOCAL_FONT
    );
    this.nodeElements = new Map();
    this.viewerRef = null;
    this.hostRef = null;
    this.pendingViewportFocusFrame = null;
    this.viewportFocusRequest = 0;
    this.store = createEditorStore({
      defaultFont: this.defaultFont,
      initialZoom,
    });
    this.fonts = new FontManager({
      onChange: () => this.store.getState().bumpFontRevision(),
    });
    this.geometry = new GeometryManager(this.fonts);
    this.tools = new Map([
      ["pointer", new PointerTool(this)],
      ["hand", new HandTool(this)],
      ["text", new TextTool(this)],
    ]);
    this.editingHistoryMark = null;
    this.unsubscribeEditorCommand = null;
    this.unsubscribe = null;
    this.localFontCatalogPromise = null;
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
    this.handleSpaceDown = this.handleSpaceDown.bind(this);
    this.handleSpaceUp = this.handleSpaceUp.bind(this);
    this.onViewportChange = null;
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

    const geometry = buildNodeGeometry(
      this.editingPreviewNode,
      this.editingFont
    );

    return {
      bbox: geometry.bbox,
      id: this.editingPreviewNode.id,
      paths: geometry.paths,
      ready: geometry.ready,
    };
  }

  get editingFrame() {
    if (!this.editingPreviewNode) {
      return null;
    }

    return getEditableNodeFrame(
      this.editingPreviewNode,
      this.editingPreviewGeometry
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

  get isDirty() {
    return this.history.isDirty;
  }

  get isHoveringSuppressed() {
    return this.getState().isHoveringSuppressed;
  }

  get layerNodeIds() {
    return [...this.nodes].reverse().map((node) => node.id);
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

  getLayerRow(nodeId) {
    return getEditorLayerRow(this, nodeId);
  }

  getNodeGeometry(nodeId) {
    return getEditorNodeGeometry(this, nodeId);
  }

  getNodeFrame(nodeId) {
    return getEditorNodeFrame(this, nodeId);
  }

  getSelectionFrameKey(nodeIds = this.selectedNodeIds) {
    return getEditorSelectionFrameKey(this, nodeIds);
  }

  getSelectionBounds(nodeIds = this.selectedNodeIds) {
    return getEditorSelectionBounds(this, nodeIds);
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

  cancelEditing() {
    cancelEditorEditing(this);
  }

  clearSelection() {
    clearEditorSelection(this);
  }

  commitEditing() {
    commitEditorEditing(this);
  }

  deleteSelected() {
    deleteEditorSelected(this);
  }

  deleteNode(nodeId) {
    deleteEditorNode(this, nodeId);
  }

  dispatchCanvasPointerDown(info) {
    this.currentTool.onCanvasPointerDown(info);
  }

  dispatchNodePointerDown(info) {
    this.currentTool.onNodePointerDown(info);
  }

  duplicate(nodeId) {
    duplicateEditorNodes(this, nodeId);
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

  select(nodeId) {
    selectEditorNode(this, nodeId);
  }

  setSelectedNodes(nodeIds) {
    setEditorSelectedNodes(this, nodeIds);
  }

  toggleSelection(nodeId) {
    toggleEditorSelection(this, nodeId);
  }

  deselect(nodeId) {
    deselectEditorNode(this, nodeId);
  }

  setHoveredNode(nodeId) {
    this.getState().setHoveredNodeId(nodeId);
  }

  setHoveringSuppressed(isHoveringSuppressed) {
    this.getState().setHoveringSuppressed(isHoveringSuppressed);
  }

  ensureSelected(nodeId) {
    ensureEditorSelected(this, nodeId);
  }

  setActiveTool(toolId) {
    setEditorActiveTool(this, toolId);
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

  setNodeOrder(nodeIds) {
    setEditorNodeOrder(this, nodeIds);
  }

  setViewportZoom(zoom) {
    this.getState().setViewportZoom(zoom);
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

  beginRotateSelection(options) {
    return beginEditorRotateSelection(this, options);
  }

  updateRotateSelection(session, options) {
    return updateEditorRotateSelection(this, session, options);
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

  finishEditingIfNeeded() {
    finishEditorEditingIfNeeded(this);
  }

  run(runChange) {
    this.history.run(runChange);
  }

  getNodeElement(nodeId) {
    return this.nodeElements.get(nodeId) || null;
  }

  zoomIn() {
    zoomEditorIn(this);
  }

  zoomOut() {
    zoomEditorOut(this);
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
