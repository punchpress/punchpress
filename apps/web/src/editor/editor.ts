import {
  getMissingDocumentFonts,
  replaceMissingDocumentFonts,
} from "../document/document-fonts";
import { MissingDocumentFontsError } from "../document/errors";
import { exportDesignDocument } from "../document/export";
import { loadDesignDocument } from "../document/load";
import { saveDesignDocument } from "../document/save";
import { getEditableNodeFrame } from "./editable-node-frame";
import {
  getInitialLocalFontCatalog,
  requestLocalFontCatalog,
} from "../platform/local-fonts";
import { MAX_ZOOM, MIN_ZOOM, UI_ACCENT } from "./constants";
import {
  getStoredLastUsedFont,
  rememberLastUsedFont,
  resolveDefaultFont,
} from "./default-font";
import {
  applyDocumentChange,
  createDocumentChange,
} from "./history/document-change";
import { createLocalFontDescriptor, DEFAULT_LOCAL_FONT } from "./local-fonts";
import {
  DEFAULT_EDITABLE_FONT_FAMILY,
  FontManager,
} from "./managers/font-manager";
import { GeometryManager } from "./managers/geometry-manager";
import { HistoryManager } from "./managers/history-manager";
import {
  isInputElement,
  shouldIgnoreGlobalShortcutTarget,
} from "./primitives/dom";
import { clamp } from "./primitives/math";
import { isNodeVisible } from "./shapes/warp-text/model";
import { buildNodeGeometry } from "./shapes/warp-text/warp-engine";
import { createEditorStore } from "./state/store";
import { HandTool } from "./tools/hand-tool";
import { PointerTool } from "./tools/pointer-tool";
import { TextTool } from "./tools/text-tool";

export class Editor {
  constructor({ accent = UI_ACCENT, initialZoom = 1 } = {}) {
    this.accent = accent;
    this.availableFonts = [];
    this.lastUsedFont = getStoredLastUsedFont();
    this.defaultFont = createLocalFontDescriptor(
      this.lastUsedFont || DEFAULT_LOCAL_FONT
    );
    this.spacePressed = false;
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
    this.onSpacePressedChange = null;
    this.onViewportChange = null;
  }

  mount() {
    this.preloadFonts();
    this.initializeLocalFonts().catch((error) => {
      this.getState().setFontCatalogState(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to initialize local fonts."
      );
    });

    if (!this.unsubscribe) {
      let previousNodes = this.nodes;

      this.unsubscribe = this.store.subscribe((state) => {
        if (state.nodes === previousNodes) {
          return;
        }

        previousNodes = state.nodes;
        this.preloadFonts(state.nodes);
      });
    }

    if (typeof window !== "undefined") {
      this.unsubscribeEditorCommand =
        window.electron?.editorCommands?.onCommand((command) => {
          if (command === "undo") {
            this.undo();
            return;
          }

          this.redo();
        }) || null;
      window.addEventListener("keydown", this.handleWindowKeyDown);
      window.addEventListener("keydown", this.handleSpaceDown);
      window.addEventListener("keyup", this.handleSpaceUp);
    }
  }

  dispose() {
    this.unsubscribeEditorCommand?.();
    this.unsubscribeEditorCommand = null;
    this.unsubscribe?.();
    this.unsubscribe = null;

    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this.handleWindowKeyDown);
      window.removeEventListener("keydown", this.handleSpaceDown);
      window.removeEventListener("keyup", this.handleSpaceUp);
    }

    this.cancelPendingViewportFocus();
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

    const geometry = buildNodeGeometry(this.editingPreviewNode, this.editingFont);

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
    this.fonts.preload(nodes);
  }

  preloadFontOptions(fonts) {
    for (const font of fonts) {
      this.fonts.preloadFont(font);
    }
  }

  getFontPreviewState(font) {
    return this.fonts.getLoadState(font);
  }

  getFontPreviewFamily(font) {
    return this.fonts.getEditableFontFamily(font);
  }

  getDefaultFont() {
    return createLocalFontDescriptor(this.defaultFont);
  }

  get fontCatalogState() {
    return this.getState().fontCatalogState;
  }

  async initializeLocalFonts() {
    return this.loadLocalFontCatalog(() => getInitialLocalFontCatalog());
  }

  async requestLocalFonts() {
    this.getState().setFontCatalogState("loading");
    return this.loadLocalFontCatalog(() => requestLocalFontCatalog(), {
      force: true,
    });
  }

  setLastUsedFont(font) {
    const descriptor = createLocalFontDescriptor(font);
    this.lastUsedFont = descriptor;
    this.defaultFont = descriptor;
    rememberLastUsedFont(descriptor);
  }

  applyLocalFontCatalog(catalog) {
    this.availableFonts = catalog.fonts;

    const preferredFont = resolveDefaultFont(catalog.fonts, this.lastUsedFont);

    if (preferredFont) {
      this.defaultFont = createLocalFontDescriptor(preferredFont);
    }

    this.getState().setFontCatalogState(catalog.state, catalog.error);
    this.getState().bumpFontRevision();
    this.preloadFonts();
  }

  getNode(nodeId) {
    if (!nodeId) {
      return null;
    }

    return this.nodes.find((node) => node.id === nodeId) || null;
  }

  getLayerRow(nodeId) {
    const nodeIndex = this.nodes.findIndex((node) => node.id === nodeId);
    if (nodeIndex < 0) {
      return null;
    }

    const node = this.nodes[nodeIndex];
    const layerIndex = this.nodes.length - 1 - nodeIndex;
    const isVisible = isNodeVisible(node);
    const label =
      node.text.trim().length > 0 ? node.text : `Text ${layerIndex + 1}`;

    return {
      isBackmost: nodeIndex === 0,
      isFrontmost: nodeIndex === this.nodes.length - 1,
      isSelected: this.isNodeSelected(node.id),
      isVisible,
      label,
      node,
      visibilityLabel: isVisible ? "Hide layer" : "Show layer",
    };
  }

  getNodeGeometry(nodeId) {
    if (!nodeId) {
      return null;
    }

    return this.geometry.getById(this.nodes, this.fontRevision, nodeId);
  }

  getNodeFrame(nodeId) {
    if (!nodeId) {
      return null;
    }

    const node = this.getNode(nodeId);
    if (!node) {
      return null;
    }

    return getEditableNodeFrame(node, this.getNodeGeometry(nodeId));
  }

  getSelectionFrameKey(nodeIds = this.selectedNodeIds) {
    return nodeIds
      .map((nodeId) => {
        const frame = this.getNodeFrame(nodeId);

        if (!frame) {
          return nodeId;
        }

        return JSON.stringify({
          bounds: frame.bounds,
          nodeId,
          transform: frame.transform || "",
        });
      })
      .join("|");
  }

  getSelectionBounds(nodeIds = this.selectedNodeIds) {
    return getSelectionBounds(this, nodeIds);
  }

  getDocument() {
    if (this.editingNodeId) {
      this.finalizeEditing();
    }

    return saveDesignDocument(this.nodes).document;
  }

  addTextNode(point) {
    this.finishEditingIfNeeded();
    this.beginHistoryTransaction();
    this.getState().addTextNode(point, this.getDefaultFont());
  }

  cancelEditing() {
    this.getState().cancelEditing();
    this.endHistoryTransaction();
    this.getState().setActiveTool("pointer");
  }

  clearSelection() {
    this.finishEditingIfNeeded();
    this.getState().clearSelection();
  }

  commitEditing() {
    this.getState().commitEditing();
  }

  deleteSelected() {
    this.finishEditingIfNeeded();
    this.runDocumentChange(() => {
      this.getState().deleteSelected();
    });
  }

  deleteNode(nodeId) {
    this.finishEditingIfNeeded();
    if (this.isNodeSelected(nodeId)) {
      this.deleteSelected();
      return;
    }

    this.runDocumentChange(() => {
      this.getState().deleteNodeById(nodeId);
    });
  }

  dispatchCanvasPointerDown(info) {
    this.currentTool.onCanvasPointerDown(info);
  }

  dispatchNodePointerDown(info) {
    this.currentTool.onNodePointerDown(info);
  }

  duplicateNode(nodeId) {
    this.finishEditingIfNeeded();
    if (this.isNodeSelected(nodeId)) {
      this.duplicateSelected();
      return;
    }

    this.runDocumentChange(() => {
      this.getState().duplicateNodeById(nodeId);
    });
  }

  duplicateSelected() {
    this.finishEditingIfNeeded();
    this.runDocumentChange(() => {
      this.getState().duplicateSelectedNodes();
    });
  }

  async exportDocument() {
    await this.initializeLocalFonts().catch(() => undefined);
    const missingFonts = getMissingDocumentFonts(this.nodes, this.availableFonts);

    if (missingFonts.length > 0) {
      throw new MissingDocumentFontsError(missingFonts);
    }

    return exportDesignDocument(this.getDocument(), (font) =>
      this.fonts.loadFontForExport(font)
    );
  }

  finalizeEditing() {
    this.commitEditing();
    this.endHistoryTransaction();
    this.setActiveTool("pointer");
  }

  handleEditingShortcutKeyDown(event, key) {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "z") {
      event.preventDefault();

      if (event.shiftKey) {
        this.redo();
        return true;
      }

      this.undo();
      return true;
    }

    if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "y") {
      event.preventDefault();
      this.redo();
      return true;
    }

    if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "j") {
      if (this.selectedNodeIds.length === 0) {
        return true;
      }

      event.preventDefault();
      this.duplicateSelected();
      return true;
    }

    return false;
  }

  handleCanvasShortcutKeyDown(event, key) {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return false;
    }

    if (event.code === "BracketLeft") {
      if (this.selectedNodeIds.length === 0) {
        return true;
      }

      event.preventDefault();
      this.sendSelectedToBack();
      return true;
    }

    if (event.code === "BracketRight") {
      if (this.selectedNodeIds.length === 0) {
        return true;
      }

      event.preventDefault();
      this.bringSelectedToFront();
      return true;
    }

    if (key === "backspace" || key === "delete") {
      event.preventDefault();
      this.deleteSelected();
      return true;
    }

    return false;
  }

  handleWindowKeyDown(event) {
    if (shouldIgnoreGlobalShortcutTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();
    if (this.handleEditingShortcutKeyDown(event, key)) {
      return;
    }

    if (this.handleCanvasShortcutKeyDown(event, key)) {
      return;
    }

    if (this.currentTool.onKeyDown({ event, key })) {
      event.preventDefault();
    }
  }

  selectNode(nodeId) {
    if (!nodeId) {
      this.clearSelection();
      return;
    }

    if (this.editingNodeId && this.editingNodeId !== nodeId) {
      this.finalizeEditing();
    }

    this.getState().selectNode(nodeId);
  }

  selectNodes(nodeIds) {
    if (
      this.editingNodeId &&
      (nodeIds.length !== 1 || nodeIds[0] !== this.editingNodeId)
    ) {
      this.finalizeEditing();
    }

    this.getState().selectNodes(nodeIds);
  }

  toggleNodeSelection(nodeId) {
    if (!nodeId) {
      return;
    }

    if (this.editingNodeId) {
      this.finalizeEditing();
    }

    this.getState().toggleNodeSelection(nodeId);
  }

  setHoveredNode(nodeId) {
    this.getState().setHoveredNodeId(nodeId);
  }

  setHoveringSuppressed(isHoveringSuppressed) {
    this.getState().setHoveringSuppressed(isHoveringSuppressed);
  }

  ensureNodeSelected(nodeId) {
    if (!nodeId) {
      return;
    }

    if (this.isNodeSelected(nodeId)) {
      return;
    }

    this.selectNode(nodeId);
  }

  setActiveTool(toolId) {
    if (!this.tools.has(toolId)) {
      return;
    }

    if (toolId !== "text" && this.editingNodeId) {
      this.finalizeEditing();
    }

    this.getState().setActiveTool(toolId);
  }

  setEditingText(value) {
    this.getState().setEditingText(value);
  }

  setNodeOrder(nodeIds) {
    this.finishEditingIfNeeded();
    this.runDocumentChange(() => {
      this.getState().setNodeOrder(nodeIds);
    });
  }

  setViewportZoom(zoom) {
    this.getState().setViewportZoom(zoom);
  }

  toggleNodeVisibility(nodeId) {
    this.finishEditingIfNeeded();
    this.runDocumentChange(() => {
      this.getState().toggleNodeVisibilityById(nodeId);
    });
  }

  sendNodeToBack(nodeId) {
    this.finishEditingIfNeeded();
    if (this.isNodeSelected(nodeId) && this.selectedNodeIds.length > 1) {
      this.sendSelectedToBack();
      return;
    }

    this.runDocumentChange(() => {
      this.getState().sendNodeToBack(nodeId);
    });
  }

  sendSelectedToBack() {
    this.finishEditingIfNeeded();
    this.runDocumentChange(() => {
      this.getState().sendSelectedNodesToBack();
    });
  }

  startEditing(node) {
    if (this.editingNodeId && this.editingNodeId !== node.id) {
      this.finalizeEditing();
    }

    this.beginHistoryTransaction();
    this.getState().startEditing(node);
  }

  updateNode(nodeId, updater) {
    this.finishEditingIfNeeded();
    this.runDocumentChange(() => {
      this.getState().updateNodeById(nodeId, updater);
    });
  }

  updateNodes(nodeIds, updater) {
    this.finishEditingIfNeeded();
    this.runDocumentChange(() => {
      this.getState().updateNodesById(nodeIds, updater);
    });
  }

  updateSelectedNode(updater) {
    this.finishEditingIfNeeded();
    this.runDocumentChange(() => {
      this.getState().updateSelectedNode(updater);
    });
  }

  bringNodeToFront(nodeId) {
    this.finishEditingIfNeeded();
    if (this.isNodeSelected(nodeId) && this.selectedNodeIds.length > 1) {
      this.bringSelectedToFront();
      return;
    }

    this.runDocumentChange(() => {
      this.getState().bringNodeToFront(nodeId);
    });
  }

  bringSelectedToFront() {
    this.finishEditingIfNeeded();
    this.runDocumentChange(() => {
      this.getState().bringSelectedNodesToFront();
    });
  }

  isNodeSelected(nodeId) {
    return this.selectedNodeIds.includes(nodeId);
  }

  loadDocument(contents) {
    const { nodes } = loadDesignDocument(contents);
    const resolution = replaceMissingDocumentFonts(
      nodes,
      this.availableFonts,
      this.getDefaultFont()
    );

    this.getState().loadNodes(resolution.nodes);
    this.resetHistory();

    if (typeof window !== "undefined") {
      this.scheduleViewportFocus(resolution.nodes.map((node) => node.id));
    }

    return resolution;
  }

  registerNodeElement(nodeId, element) {
    if (element) {
      this.nodeElements.set(nodeId, element);
    } else {
      this.nodeElements.delete(nodeId);
    }
  }

  serializeDocument() {
    return saveDesignDocument(this.nodes).contents;
  }

  markDocumentSaved() {
    this.history.markSaved();
  }

  beginHistoryTransaction() {
    this.history.beginTransaction();
  }

  endHistoryTransaction() {
    return this.history.endTransaction();
  }

  redo() {
    return this.history.redo();
  }

  undo() {
    return this.history.undo();
  }

  resetHistory() {
    this.history.reset();
  }

  finishEditingIfNeeded() {
    if (!this.editingNodeId) {
      return;
    }

    this.finalizeEditing();
  }

  recordHistoryChange(beforeSnapshot) {
    return this.history.recordChange(beforeSnapshot);
  }

  runDocumentChange(runChange) {
    this.history.run(runChange);
  }

  getNodeElement(nodeId) {
    return this.nodeElements.get(nodeId) || null;
  }

  zoomIn() {
    const viewer = this.viewerRef;
    if (!viewer) {
      return;
    }

    viewer.setZoom(clamp(this.zoom * 1.18, MIN_ZOOM, MAX_ZOOM));
  }

  zoomOut() {
    const viewer = this.viewerRef;
    if (!viewer) {
      return;
    }

    viewer.setZoom(clamp(this.zoom / 1.18, MIN_ZOOM, MAX_ZOOM));
  }

  handleSpaceDown(event) {
    if (event.code !== "Space" || isInputElement(event.target)) {
      return;
    }

    event.preventDefault();
    this.spacePressed = true;
    this.onSpacePressedChange?.(true);
  }

  handleSpaceUp(event) {
    if (event.code !== "Space") {
      return;
    }

    this.spacePressed = false;
    this.onSpacePressedChange?.(false);
  }

  cancelPendingViewportFocus() {
    if (
      typeof window === "undefined" ||
      this.pendingViewportFocusFrame === null
    ) {
      this.pendingViewportFocusFrame = null;
      return;
    }

    window.cancelAnimationFrame(this.pendingViewportFocusFrame);
    this.pendingViewportFocusFrame = null;
  }

  scheduleViewportFocus(nodeIds) {
    if (typeof window === "undefined") {
      return;
    }

    this.cancelPendingViewportFocus();
    this.viewportFocusRequest += 1;

    const requestId = this.viewportFocusRequest;
    const attemptFocus = (attempt = 0) => {
      if (this.viewportFocusRequest !== requestId) {
        return;
      }

      const visibleNodeIds = nodeIds.filter((nodeId) => {
        return isNodeVisible(this.getNode(nodeId));
      });

      if (visibleNodeIds.length === 0) {
        this.pendingViewportFocusFrame = null;
        return;
      }

      const bounds = this.getSelectionBounds(visibleNodeIds);
      const isReady = visibleNodeIds.every((nodeId) => {
        return Boolean(
          this.getNodeElement(nodeId) && this.getNodeGeometry(nodeId)?.ready
        );
      });

      if (bounds && (isReady || attempt >= 120)) {
        focusCanvasBoundsInViewport(this, bounds);
        this.pendingViewportFocusFrame = null;
        return;
      }

      this.pendingViewportFocusFrame = window.requestAnimationFrame(() => {
        attemptFocus(attempt + 1);
      });
    };

    this.pendingViewportFocusFrame = window.requestAnimationFrame(() => {
      attemptFocus();
    });
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

const getSelectionBounds = (editor, nodeIds) => {
  const bounds = nodeIds
    .map((nodeId) => {
      const renderedBounds = getRenderedNodeBounds(editor, nodeId);
      if (renderedBounds) {
        return renderedBounds;
      }

      const frame = editor.getNodeFrame(nodeId);
      if (!frame) {
        return null;
      }

      return frame.bounds;
    })
    .filter(Boolean);

  if (bounds.length === 0) {
    return null;
  }

  const minX = Math.min(...bounds.map((bbox) => bbox.minX));
  const minY = Math.min(...bounds.map((bbox) => bbox.minY));
  const maxX = Math.max(...bounds.map((bbox) => bbox.maxX));
  const maxY = Math.max(...bounds.map((bbox) => bbox.maxY));

  return {
    height: maxY - minY,
    maxX,
    maxY,
    minX,
    minY,
    width: maxX - minX,
  };
};

const focusCanvasBoundsInViewport = (editor, bounds) => {
  const viewer = editor.viewerRef;
  const host = editor.hostRef;

  if (!(viewer && host && bounds)) {
    return;
  }

  const hostRect = host.getBoundingClientRect();
  const width = Math.max(hostRect.width, 1);
  const height = Math.max(hostRect.height, 1);
  const padding = 160;
  const contentWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const contentHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const zoom = clamp(
    Math.min(
      width / (contentWidth + padding * 2),
      height / (contentHeight + padding * 2),
      1
    ),
    MIN_ZOOM,
    MAX_ZOOM
  );
  const canvasWidth = width / zoom;
  const canvasHeight = height / zoom;
  const x = bounds.minX - (canvasWidth - contentWidth) / 2;
  const y = bounds.minY - (canvasHeight - contentHeight) / 2;

  viewer.setTo?.({ x, y, zoom });
  editor.setViewportZoom(zoom);
};

const getRenderedNodeBounds = (editor, nodeId) => {
  const element = editor.getNodeElement(nodeId);
  const host = editor.hostRef;
  const viewer = editor.viewerRef;

  if (!(element && host && viewer && editor.zoom > 0)) {
    return null;
  }

  const elementRect = element.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const scrollLeft = viewer.getScrollLeft?.();
  const scrollTop = viewer.getScrollTop?.();

  if (!(Number.isFinite(scrollLeft) && Number.isFinite(scrollTop))) {
    return null;
  }

  return {
    maxX: scrollLeft + (elementRect.right - hostRect.left) / editor.zoom,
    maxY: scrollTop + (elementRect.bottom - hostRect.top) / editor.zoom,
    minX: scrollLeft + (elementRect.left - hostRect.left) / editor.zoom,
    minY: scrollTop + (elementRect.top - hostRect.top) / editor.zoom,
  };
};
