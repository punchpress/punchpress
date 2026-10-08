import {
  canonicalizeTreeOrder,
  createLocalFontDescriptor,
  DEFAULT_LOCAL_FONT,
} from "@punchpress/punch-schema";
import createStore from "zustand/vanilla";
import { getRasterBrushPreset } from "../../raster/brush-preset";
import {
  DEFAULT_BRUSH_SETTINGS,
  normalizeBrushSettings,
} from "../../tools/brush-settings";
import { createDocumentStoreActions } from "./create-document-store-actions";
import { createEditingStoreActions } from "./create-editing-store-actions";
import { createFontStoreActions } from "./create-font-store-actions";
import { createSelectionStoreActions } from "./create-selection-store-actions";
import { getActiveLayerIdAfterDeletion } from "./node-tree-state";
import { withoutVectorChildEffects } from "../../effects/vector-child-effects";

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
        const patch = withCanonicalTreeOrder(
          state,
          typeof update === "function" ? update(state) : update
        );

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
        const selectedNodeIds = patch.selectedNodeIds || state.selectedNodeIds;
        const requestedActiveLayerId =
          "activeLayerId" in patch
            ? patch.activeLayerId
            : "selectedNodeIds" in patch && selectedNodeIds.length > 0
              ? selectedNodeIds.at(-1)
              : state.activeLayerId;
        const availableNodeIds = new Set(nodes.map((node) => node.id));
        const treeFallbackActiveLayerId =
          "nodes" in patch ? getActiveLayerIdAfterDeletion(state, nodes) : null;
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
      brushPresetId: "hard-round",
      brushSettings: normalizeBrushSettings({}, DEFAULT_BRUSH_SETTINGS),
      eraserPresetId: "hard-round",
      eraserSettings: normalizeBrushSettings({}, DEFAULT_BRUSH_SETTINGS),
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
          ...(toolId === "eraser" || (!toolId && state.activeTool === "eraser")
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
      selectBrushPreset: (presetId, toolId) => {
        const preset = getRasterBrushPreset(presetId);

        if (!preset) {
          throw new Error(`Unknown Raster Brush preset: ${presetId}`);
        }

        setEditorState((state) => {
          const isEraser =
            toolId === "eraser" || (!toolId && state.activeTool === "eraser");
          const currentSettings = isEraser
            ? state.eraserSettings
            : state.brushSettings;
          const nextSettings = normalizeBrushSettings(
            {
              ...preset.settings,
              color: currentSettings.color,
              seed: currentSettings.seed,
            },
            DEFAULT_BRUSH_SETTINGS
          );

          return isEraser
            ? { eraserPresetId: preset.id, eraserSettings: nextSettings }
            : { brushPresetId: preset.id, brushSettings: nextSettings };
        });
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

// Every document write keeps each group's descendants contiguous in paint
// order (renderers and export rely on it) and drops effects from vector
// children. Canonical arrays pass through
// unchanged, so caches keyed on the nodes array survive.
const withCanonicalTreeOrder = (state, patch) => {
  if (
    !(patch && typeof patch === "object" && Array.isArray(patch.nodes)) ||
    patch === state ||
    patch.nodes === state.nodes
  ) {
    return patch;
  }

  const nodes = withoutVectorChildEffects(canonicalizeTreeOrder(patch.nodes));

  return nodes === patch.nodes ? patch : { ...patch, nodes };
};
