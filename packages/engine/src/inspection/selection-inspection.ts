import { getCachedSelectionPropertiesSnapshot } from "./selection-properties";

// Focused reads over the cached selection properties snapshot. Each returns a
// primitive, a stored reference, or a flat object of those, so a React
// subscriber re-renders only when what it shows changes.

type SelectionKind = "group" | "multi" | "none" | "single";

// The inspector's structure for a selection: which node it inspects and which
// sections apply.
export const getSelectionInspection = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  const {
    canDelete,
    properties,
    selectedNode,
    selectionColors,
    selectionKind,
  } = getSelectionPropertiesState(editor, nodeIds);

  return {
    canDelete: Boolean(canDelete),
    hasAppearance: Boolean(properties.appearance),
    hasOpacity: Boolean(properties.opacity),
    hasSelectionColors: selectionColors.length > 0,
    nodeId: (selectedNode?.id as string | undefined) ?? null,
    nodeType: (selectedNode?.type as string | undefined) ?? null,
    selectionKind: selectionKind as SelectionKind,
  };
};

// One aggregated property (`{ id, isMixed, value }`), or null when the
// selection does not share it. The object is rebuilt per document change, so
// subscribers read its primitives.
export const getSelectionProperty = (
  editor,
  propertyId: string,
  nodeIds = editor.selectedNodeIds
) => {
  return (
    getSelectionPropertiesState(editor, nodeIds).properties[propertyId] ?? null
  );
};

// The selection's color swatches (`{ fieldId, id, usageCount, value }`).
export const getSelectionColorList = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  return getSelectionPropertiesState(editor, nodeIds).selectionColors;
};

const getSelectionPropertiesState = (editor, nodeIds: string[]) => {
  return getCachedSelectionPropertiesSnapshot(editor, nodeIds)
    .selectionProperties;
};
