import type { Editor } from "@punchpress/engine";
import type {
  DesktopAppMenuState,
  DesktopMenuChoiceState,
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
  const selectionProperties = editor.getSelectionPropertiesSnapshot(
    selectedNodeIds
  ).selectionProperties;
  const selectedNode = selectionProperties.selectedNode;
  const fillRule = getChoiceState<DesktopVectorFillRule>(
    selectionProperties.properties.fillRule
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
