import { FALLBACK_FONTS, MAX_ZOOM, MIN_ZOOM, UI_ACCENT } from "./constants";
import {
  DEFAULT_EDITABLE_FONT_FAMILY,
  FontManager,
} from "./managers/font-manager";
import { GeometryManager } from "./managers/geometry-manager";
import { isInputElement } from "./primitives/dom";
import { clamp } from "./primitives/math";
import { isNodeVisible } from "./shapes/warp-text/model";
import { measureStraightText } from "./shapes/warp-text/straight-text-metrics";
import { createEditorStore } from "./state/store";
import { HandTool } from "./tools/hand-tool";
import { PointerTool } from "./tools/pointer-tool";
import { TextTool } from "./tools/text-tool";

export class Editor {
  constructor({
    accent = UI_ACCENT,
    fonts = FALLBACK_FONTS,
    initialZoom = 1,
  } = {}) {
    this.accent = accent;
    this.availableFonts = fonts;
    this.bootstrapError = "";
    this.bootstrapState = "ready";
    this.spacePressed = false;
    this.nodeElements = new Map();
    this.viewerRef = null;
    this.hostRef = null;
    this.store = createEditorStore({ fonts, initialZoom });
    this.fonts = new FontManager({
      onChange: () => this.store.getState().bumpFontRevision(),
    });
    this.geometry = new GeometryManager(this.fonts);
    this.tools = new Map([
      ["pointer", new PointerTool(this)],
      ["hand", new HandTool(this)],
      ["text", new TextTool(this)],
    ]);
    this.unsubscribe = null;
    this.handleWindowKeyDown = this.handleWindowKeyDown.bind(this);
    this.handleSpaceDown = this.handleSpaceDown.bind(this);
    this.handleSpaceUp = this.handleSpaceUp.bind(this);
    this.onSpacePressedChange = null;
    this.onViewportChange = null;
  }

  mount() {
    this.preloadFonts();

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
      window.addEventListener("keydown", this.handleWindowKeyDown);
      window.addEventListener("keydown", this.handleSpaceDown);
      window.addEventListener("keyup", this.handleSpaceUp);
    }
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = null;

    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this.handleWindowKeyDown);
      window.removeEventListener("keydown", this.handleSpaceDown);
      window.removeEventListener("keyup", this.handleSpaceUp);
    }
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

  get editingNodeId() {
    return this.getState().editingNodeId;
  }

  get editingNode() {
    return this.getNode(this.editingNodeId);
  }

  get editingText() {
    return this.getState().editingText;
  }

  get editingGeometry() {
    if (!this.editingNodeId) {
      return null;
    }

    return this.getNodeGeometry(this.editingNodeId);
  }

  get editingFont() {
    if (!this.editingNode) {
      return null;
    }

    return this.fonts.getLoadedFont(this.editingNode.fontUrl);
  }

  get editingFontFamily() {
    if (!this.editingNode) {
      return DEFAULT_EDITABLE_FONT_FAMILY;
    }

    return this.fonts.getEditableFontFamily(this.editingNode.fontUrl);
  }

  get editingMetrics() {
    if (!(this.editingFont && this.editingNode)) {
      return null;
    }

    return measureStraightText(this.editingNode, this.editingFont);
  }

  get fontRevision() {
    return this.getState().fontRevision;
  }

  get geometryById() {
    return this.geometry.getAll(this.nodes, this.fontRevision);
  }

  get nodes() {
    return this.getState().nodes;
  }

  get layerNodeIds() {
    return [...this.nodes].reverse().map((node) => node.id);
  }

  get selectedNode() {
    return this.getNode(this.selectedNodeId);
  }

  get selectedNodeId() {
    return this.getState().selectedNodeId;
  }

  get zoom() {
    return this.getState().viewport.zoom;
  }

  preloadFonts(nodes = this.nodes) {
    this.fonts.preload(this.availableFonts, nodes);
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
      isSelected: node.id === this.selectedNodeId,
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

  addTextNode(point) {
    this.getState().addTextNode(point);
  }

  cancelEditing() {
    this.getState().cancelEditing();
  }

  clearSelection() {
    this.getState().clearSelection();
  }

  commitEditing() {
    this.getState().commitEditing();
  }

  deleteSelected() {
    this.getState().deleteSelected();
  }

  deleteNode(nodeId) {
    this.getState().deleteNodeById(nodeId);
  }

  dispatchCanvasPointerDown(info) {
    this.currentTool.onCanvasPointerDown(info);
  }

  dispatchNodePointerDown(info) {
    this.currentTool.onNodePointerDown(info);
  }

  duplicateNode(nodeId) {
    this.getState().duplicateNodeById(nodeId);
  }

  finalizeEditing() {
    this.commitEditing();
    this.setActiveTool("pointer");
  }

  handleWindowKeyDown(event) {
    if (isInputElement(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "j") {
      if (!this.selectedNodeId) {
        return;
      }

      event.preventDefault();
      this.duplicateNode(this.selectedNodeId);
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.code === "BracketLeft") {
      if (!this.selectedNodeId) {
        return;
      }

      event.preventDefault();
      this.sendNodeToBack(this.selectedNodeId);
      return;
    }

    if (event.code === "BracketRight") {
      if (!this.selectedNodeId) {
        return;
      }

      event.preventDefault();
      this.bringNodeToFront(this.selectedNodeId);
      return;
    }

    if (key === "backspace" || key === "delete") {
      event.preventDefault();
      this.deleteSelected();
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

    this.getState().selectNode(nodeId);
  }

  setActiveTool(toolId) {
    if (!this.tools.has(toolId)) {
      return;
    }

    if (toolId !== "text" && this.editingNodeId) {
      this.commitEditing();
    }

    this.getState().setActiveTool(toolId);
  }

  setEditingText(value) {
    this.getState().setEditingText(value);
  }

  setNodeOrder(nodeIds) {
    this.getState().setNodeOrder(nodeIds);
  }

  setViewportZoom(zoom) {
    this.getState().setViewportZoom(zoom);
  }

  toggleNodeVisibility(nodeId) {
    this.getState().toggleNodeVisibilityById(nodeId);
  }

  sendNodeToBack(nodeId) {
    this.getState().sendNodeToBack(nodeId);
  }

  startEditing(node) {
    this.getState().startEditing(node);
  }

  updateNode(nodeId, updater) {
    this.getState().updateNodeById(nodeId, updater);
  }

  updateSelectedNode(updater) {
    this.getState().updateSelectedNode(updater);
  }

  bringNodeToFront(nodeId) {
    this.getState().bringNodeToFront(nodeId);
  }

  registerNodeElement(nodeId, element) {
    if (element) {
      this.nodeElements.set(nodeId, element);
    } else {
      this.nodeElements.delete(nodeId);
    }
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
}
