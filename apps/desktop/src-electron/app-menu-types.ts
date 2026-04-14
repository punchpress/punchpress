export type DesktopSelectionKind = "group" | "multi" | "none" | "single";

export type DesktopSelectedNodeType = "group" | "shape" | "text" | "vector";

export type DesktopVectorFillRule = "evenodd" | "nonzero";

export type DesktopVectorStrokeLineCap = "butt" | "round" | "square";

export type DesktopVectorStrokeLineJoin = "bevel" | "miter" | "round";

export interface DesktopMenuChoiceState<Value extends string> {
  enabled: boolean;
  isMixed: boolean;
  value: Value | null;
}

export interface DesktopVectorStyleMenuState {
  fillRule: DesktopMenuChoiceState<DesktopVectorFillRule> | null;
  strokeLineCap: DesktopMenuChoiceState<DesktopVectorStrokeLineCap> | null;
  strokeLineJoin: DesktopMenuChoiceState<DesktopVectorStrokeLineJoin> | null;
}

export interface DesktopAppMenuState {
  canDelete: boolean;
  canEditPath: boolean;
  selectedNodeType: DesktopSelectedNodeType | null;
  selectionKind: DesktopSelectionKind;
  vectorStyle: DesktopVectorStyleMenuState | null;
}

export type DesktopEditorCommand =
  | { action: "redo" | "undo"; type: "history" }
  | { action: "delete-selected" | "toggle-path-editing"; type: "selection" }
  | {
      propertyId: "fillRule";
      type: "selection-property";
      value: DesktopVectorFillRule;
    }
  | {
      propertyId: "strokeLineCap";
      type: "selection-property";
      value: DesktopVectorStrokeLineCap;
    }
  | {
      propertyId: "strokeLineJoin";
      type: "selection-property";
      value: DesktopVectorStrokeLineJoin;
    };
