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

export const createEditorStore = ({
  initialZoom = 1,
  resolveDefaultFont,
} = {}) => {
  const getDefaultFont = () => {
    return createLocalFontDescriptor(
      resolveDefaultFont?.() || DEFAULT_LOCAL_FONT
    );
  };

  return createStore((set) => ({
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
    selectedNodeIds: [],
    spacePressed: false,
    viewport: {
      x: 0,
      y: 0,
      zoom: initialZoom,
    },
    setBrushSettings: (patch, toolId) => {
      set((state) => ({
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
    ...createDocumentStoreActions(set, getDefaultFont),
    ...createEditingStoreActions(set),
    ...createFontStoreActions(set),
    ...createSelectionStoreActions(set),
  }));
};
