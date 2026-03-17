import {
  createLocalFontDescriptor,
  DEFAULT_LOCAL_FONT,
} from "@punchpress/punch-schema";
import createStore from "zustand/vanilla";
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
    editingNodeId: null,
    editingOriginalText: "",
    editingText: "",
    fontCatalogError: "",
    fontCatalogState: "loading",
    fontRevision: 0,
    focusedGroupId: null,
    hoveredNodeId: null,
    isHoveringSuppressed: false,
    nodes: [],
    selectedNodeIds: [],
    spacePressed: false,
    viewport: {
      zoom: initialZoom,
    },
    ...createDocumentStoreActions(set, getDefaultFont),
    ...createEditingStoreActions(set),
    ...createFontStoreActions(set),
    ...createSelectionStoreActions(set),
  }));
};
