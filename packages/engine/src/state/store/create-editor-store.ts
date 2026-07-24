import {
  createLocalFontDescriptor,
  DEFAULT_LOCAL_FONT,
} from "@punchpress/punch-schema";
import createStore from "zustand/vanilla";
import {
  DEFAULT_BRUSH_SETTINGS,
  normalizeBrushSettings,
} from "../../tools/brush-settings";
import { createDocumentStoreActions } from "./create-document-store-actions";
import { createEditingStoreActions } from "./create-editing-store-actions";
import { createFontStoreActions } from "./create-font-store-actions";
import { createSelectionStoreActions } from "./create-selection-store-actions";
import { getActiveLayerIdAfterDeletion } from "./node-tree-state";

export const createEditorStore = ({
  initialZoom = 1,
  resolveDefaultFont = undefined,
} = {}) => {
  const getDefaultFont = () => {
    return createLocalFontDescriptor(
      resolveDefaultFont?.() || DEFAULT_LOCAL_FONT
    );
  };

  return createStore((set) => {
    const setEditorState = (update) => {
      set((state) => {
        const patch = typeof update === "function" ? update(state) : update;

        if (!(patch && typeof patch === "object")) {
          return patch;
        }

        if (
          patch === state ||
          !(
            "activeLayerId" in patch ||
            "nodes" in patch ||
            "selectedNodeIds" in patch
          )
        ) {
          return patch;
        }

        const nodes = patch.nodes || state.nodes;
        const selectedNodeIds =
          patch.selectedNodeIds || state.selectedNodeIds;
        const requestedActiveLayerId =
          "activeLayerId" in patch
            ? patch.activeLayerId
            : "selectedNodeIds" in patch && selectedNodeIds.length > 0
              ? selectedNodeIds.at(-1)
              : state.activeLayerId;
        const availableNodeIds = new Set(nodes.map((node) => node.id));
        const treeFallbackActiveLayerId =
          "nodes" in patch
            ? getActiveLayerIdAfterDeletion(state, nodes)
            : null;
        const activeLayerId =
          (requestedActiveLayerId &&
          availableNodeIds.has(requestedActiveLayerId)
            ? requestedActiveLayerId
            : [...selectedNodeIds]
                .reverse()
                .find((nodeId) => availableNodeIds.has(nodeId))) ||
          treeFallbackActiveLayerId ||
          nodes.at(-1)?.id ||
          null;

        return {
          ...patch,
          activeLayerId,
        };
      });
    };

    return {
      activeLayerId: null,
      activeTool: "pointer",
      brushSettings: DEFAULT_BRUSH_SETTINGS,
      eraserSettings: DEFAULT_BRUSH_SETTINGS,
      editingNodeId: null,
      editingOriginalText: "",
      editingText: "",
      fontCatalogError: "",
      fontCatalogState: "loading",
      fontRevision: 0,
      focusedGroupId: null,
      hoveredNodeId: null,
      isHoveringSuppressed: false,
      isTextPathPositioning: false,
      isSelectionDragging: false,
      isSelectionRotating: false,
      nextShapeKind: "polygon",
      nodes: [],
      pathEditingNodeId: null,
      pathEditingPoint: null,
      pathEditingPoints: [],
      penDirectSelectionModifierPressed: false,
      penPointTypeToggleModifierPressed: false,
      rasterCropSession: null,
      selectedNodeIds: [],
      spacePressed: false,
      viewport: {
        x: 0,
        y: 0,
        zoom: initialZoom,
      },
      setBrushSettings: (patch, toolId) => {
        setEditorState((state) => ({
          ...(toolId === "eraser" ||
          (!toolId && state.activeTool === "eraser")
            ? {
                eraserSettings: normalizeBrushSettings(
                  patch || {},
                  state.eraserSettings
                ),
              }
            : {
                brushSettings: normalizeBrushSettings(
                  patch || {},
                  state.brushSettings
                ),
              }),
        }));
      },
      setRasterCropSession: (rasterCropSession) => {
        setEditorState({ rasterCropSession });
      },
      ...createDocumentStoreActions(setEditorState, getDefaultFont),
      ...createEditingStoreActions(setEditorState),
      ...createFontStoreActions(setEditorState),
      ...createSelectionStoreActions(setEditorState),
    };
  });
};
