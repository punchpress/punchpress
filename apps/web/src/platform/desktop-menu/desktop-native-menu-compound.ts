import {
  getCompoundVectorOperationTarget,
  isBooleanVectorCompoundOperation,
} from "../../lib/vector-compound-operation";
import type {
  DesktopMenuChoiceState,
  DesktopVectorCompoundOperation,
} from "./desktop-native-menu-types";

export const getDesktopCompoundVectorSelection = (
  editor,
  selectedNodeIds = editor.selectedNodeIds
) => {
  if (selectedNodeIds.length !== 1) {
    return null;
  }

  return getCompoundVectorOperationTarget(editor, selectedNodeIds[0]);
};

export const getDesktopCompoundOperationState = (
  editor,
  selectedNodeIds = editor.selectedNodeIds
): DesktopMenuChoiceState<DesktopVectorCompoundOperation> | null => {
  const compoundSelection = getDesktopCompoundVectorSelection(
    editor,
    selectedNodeIds
  );

  if (!compoundSelection) {
    return null;
  }

  return {
    enabled: true,
    isMixed: false,
    value: isBooleanVectorCompoundOperation(compoundSelection.pathComposition)
      ? (compoundSelection.pathComposition as DesktopVectorCompoundOperation)
      : null,
  };
};
