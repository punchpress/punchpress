export type DesktopSelectionKind = "group" | "multi" | "none" | "single";

export type DesktopSelectedNodeType = "group" | "shape" | "text" | "vector";

export type DesktopVectorFillRule = "evenodd" | "nonzero";

export type DesktopVectorCompoundOperation =
  | "exclude"
  | "intersect"
  | "subtract"
  | "unite";

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
  canJoinCurves: boolean;
  canMakeCompoundPath: boolean;
  canMergeCurves: boolean;
  canReleaseCompoundPath: boolean;
  canSeparateCurves: boolean;
  compoundOperation: DesktopMenuChoiceState<DesktopVectorCompoundOperation> | null;
  selectedNodeType: DesktopSelectedNodeType | null;
  selectionKind: DesktopSelectionKind;
  vectorStyle: DesktopVectorStyleMenuState | null;
}

export type DesktopEditorCommand =
  | { action: "redo" | "undo"; type: "history" }
  | {
      type: "vector-compound-operation";
      value: DesktopVectorCompoundOperation;
    }
  | {
      action:
        | "delete-selected"
        | "join-curves"
        | "make-compound-path"
        | "merge-curves"
        | "release-compound-path"
        | "separate-curves"
        | "toggle-path-editing";
      type: "selection";
    }
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
