import createStore from "zustand/vanilla";
import {
  createLocalFontDescriptor,
  DEFAULT_LOCAL_FONT,
} from "../../local-fonts";
import { createDocumentStoreActions } from "./create-document-store-actions";
import { createEditingStoreActions } from "./create-editing-store-actions";
import { createFontStoreActions } from "./create-font-store-actions";
import { createSelectionStoreActions } from "./create-selection-store-actions";

export const createEditorStore = ({
  defaultFont = DEFAULT_LOCAL_FONT,
  initialZoom = 1,
} = {}) => {
  const resolveDefaultFont = () => {
    return createLocalFontDescriptor(defaultFont);
  };

  return createStore((set) => ({
    activeTool: "pointer",
    editingNodeId: null,
    editingOriginalText: "",
    editingText: "",
    fontCatalogError: "",
    fontCatalogState: "loading",
    fontRevision: 0,
    hoveredNodeId: null,
    isHoveringSuppressed: false,
    nodes: [],
    selectedNodeIds: [],
    spacePressed: false,
    viewport: {
      zoom: initialZoom,
    },
    ...createDocumentStoreActions(set, resolveDefaultFont),
    ...createEditingStoreActions(set),
    ...createFontStoreActions(set),
    ...createSelectionStoreActions(set),
  }));
};
