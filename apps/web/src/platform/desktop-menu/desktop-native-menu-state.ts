import type { Editor } from "@punchpress/engine";
import { getDesktopCompoundOperationState } from "./desktop-native-menu-compound";
import type {
  DesktopAppMenuState,
  DesktopMenuChoiceState,
  DesktopVectorCompoundOperation,
  DesktopVectorFillRule,
  DesktopVectorStrokeLineCap,
  DesktopVectorStrokeLineJoin,
} from "./desktop-native-menu-types";

const getChoiceState = <Value extends string>(
  property:
    | {
        isMixed: boolean;
        value: Value | null;
      }
    | undefined
): DesktopMenuChoiceState<Value> | null => {
  if (!property) {
    return null;
  }

  return {
    enabled: true,
    isMixed: property.isMixed,
    value: property.isMixed ? null : property.value,
  };
};

export const getDesktopAppMenuState = (
  editor: Editor,
  selectedNodeIds: string[]
): DesktopAppMenuState => {
  const selectionProperties =
    editor.getSelectionPropertiesSnapshot(selectedNodeIds).selectionProperties;
  const selectedNode = selectionProperties.selectedNode;
  const fillRule = getChoiceState<DesktopVectorFillRule>(
    selectionProperties.properties.fillRule
  );
  const compoundOperation = getDesktopCompoundOperationState(
    editor,
    selectedNodeIds
  );
  const strokeLineCap = getChoiceState<DesktopVectorStrokeLineCap>(
    selectionProperties.properties.strokeLineCap
  );
  const strokeLineJoin = getChoiceState<DesktopVectorStrokeLineJoin>(
    selectionProperties.properties.strokeLineJoin
  );

  return {
    canDelete: selectionProperties.canDelete,
    canEditPath: Boolean(
      selectedNode?.id && editor.canStartPathEditing(selectedNode.id)
    ),
    compoundOperation:
      getChoiceState<DesktopVectorCompoundOperation>(compoundOperation),
    canMakeCompoundPath: editor.canMakeCompoundPath(selectedNodeIds),
    canReleaseCompoundPath: editor.canReleaseCompoundPath(selectedNodeIds),
    selectedNodeType: selectedNode?.type || null,
    selectionKind: selectionProperties.selectionKind,
    vectorStyle:
      fillRule || strokeLineCap || strokeLineJoin
        ? {
            fillRule,
            strokeLineCap,
            strokeLineJoin,
          }
        : null,
  };
};
