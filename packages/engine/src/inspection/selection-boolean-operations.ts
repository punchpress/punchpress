import { canApplyBooleanOperation } from "../document/path/path-boolean-actions";

const BOOLEAN_OPERATION_ORDER = [
  "unite",
  "subtract",
  "intersect",
  "exclude",
] as const;

export const getSelectionBooleanOperations = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  const availability = Object.fromEntries(
    BOOLEAN_OPERATION_ORDER.map((operation) => {
      return [operation, canApplyBooleanOperation(editor, operation, nodeIds)];
    })
  );

  return {
    ...availability,
    hasAny: BOOLEAN_OPERATION_ORDER.some(
      (operation) => availability[operation]
    ),
  };
};
