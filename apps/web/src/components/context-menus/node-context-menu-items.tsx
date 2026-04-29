import {
  Copy01Icon,
  Delete02Icon,
  Edit01Icon,
  GeometricShapes01Icon,
  GroupLayersIcon,
  LayerBringToFrontIcon,
  LayerSendToBackIcon,
  UngroupLayersIcon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import {
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubPopup,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  BOOLEAN_VECTOR_COMPOUND_OPERATIONS,
  isBooleanVectorCompoundOperation,
} from "@/lib/vector-compound-operation";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
import {
  LAYER_SHORTCUTS,
  LayerGlyph,
} from "../panels/layers-panel/layer-glyph";
import {
  applyNodeContextVisibility,
  getNodeContextMenuState,
} from "./node-context-menu-state";

const GroupNodeContextMenuItems = ({
  canGroupSelection,
  canUngroup,
  onStartRenaming,
  singleTargetNodeId,
}) => {
  const editor = useEditor();

  if (!(canGroupSelection || canUngroup)) {
    return null;
  }

  return (
    <>
      {canGroupSelection && (
        <ContextMenuItem onClick={() => editor.groupSelected()}>
          <LayerGlyph icon={GroupLayersIcon} size={17} strokeWidth={1.7} />
          Group selection
          <ContextMenuShortcut>{LAYER_SHORTCUTS.group}</ContextMenuShortcut>
        </ContextMenuItem>
      )}
      {canUngroup && onStartRenaming ? (
        <ContextMenuItem onClick={onStartRenaming}>
          <LayerGlyph icon={Edit01Icon} size={17} strokeWidth={1.7} />
          Rename group…
        </ContextMenuItem>
      ) : null}
      {canUngroup ? (
        <ContextMenuItem onClick={() => editor.ungroup(singleTargetNodeId)}>
          <LayerGlyph icon={UngroupLayersIcon} size={17} strokeWidth={1.7} />
          Ungroup
          <ContextMenuShortcut>{LAYER_SHORTCUTS.ungroup}</ContextMenuShortcut>
        </ContextMenuItem>
      ) : null}
      <ContextMenuSeparator />
    </>
  );
};

const CompoundNodeContextMenuItems = ({
  canConvertShapeToPath,
  canJoinCurves,
  canMakeCompoundPath,
  canMergeCurves,
  canReleaseCompoundPath,
  canSeparateCurves,
  compoundOperationTarget,
  singleTargetNodeId,
  targetNodeIds,
}) => {
  const editor = useEditor();

  if (
    !(
      canConvertShapeToPath ||
      canJoinCurves ||
      canMakeCompoundPath ||
      canMergeCurves ||
      canReleaseCompoundPath ||
      canSeparateCurves ||
      compoundOperationTarget
    )
  ) {
    return null;
  }

  const currentOperation =
    compoundOperationTarget &&
    isBooleanVectorCompoundOperation(compoundOperationTarget.pathComposition)
      ? compoundOperationTarget.pathComposition
      : undefined;

  return (
    <>
      <ContextMenuSeparator />
      {canConvertShapeToPath && singleTargetNodeId ? (
        <ContextMenuItem
          onClick={() => editor.convertShapeToPath(singleTargetNodeId)}
        >
          <LayerGlyph
            icon={GeometricShapes01Icon}
            size={17}
            strokeWidth={1.7}
          />
          Convert to path
        </ContextMenuItem>
      ) : null}
      {canReleaseCompoundPath ? (
        <ContextMenuItem
          onClick={() => editor.releaseCompoundPath(targetNodeIds)}
        >
          <LayerGlyph icon={UngroupLayersIcon} size={17} strokeWidth={1.7} />
          Release Compound Path
        </ContextMenuItem>
      ) : null}
      {canMergeCurves ? (
        <ContextMenuItem onClick={() => editor.mergeCurves(targetNodeIds)}>
          <LayerGlyph
            icon={GeometricShapes01Icon}
            size={17}
            strokeWidth={1.7}
          />
          Merge Curves
        </ContextMenuItem>
      ) : null}
      {canSeparateCurves ? (
        <ContextMenuItem onClick={() => editor.separateCurves(targetNodeIds)}>
          <LayerGlyph icon={UngroupLayersIcon} size={17} strokeWidth={1.7} />
          Separate Curves
        </ContextMenuItem>
      ) : null}
      {canJoinCurves ? (
        <ContextMenuItem onClick={() => editor.joinCurves(targetNodeIds)}>
          <LayerGlyph
            icon={GeometricShapes01Icon}
            size={17}
            strokeWidth={1.7}
          />
          Join Curves
        </ContextMenuItem>
      ) : null}
      {!canReleaseCompoundPath && canMakeCompoundPath ? (
        <ContextMenuItem onClick={() => editor.makeCompoundPath(targetNodeIds)}>
          <LayerGlyph
            icon={GeometricShapes01Icon}
            size={17}
            strokeWidth={1.7}
          />
          Make Compound Path
        </ContextMenuItem>
      ) : null}
      {compoundOperationTarget ? (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <LayerGlyph
              icon={GeometricShapes01Icon}
              size={17}
              strokeWidth={1.7}
            />
            Compound Operation
          </ContextMenuSubTrigger>
          <ContextMenuSubPopup>
            <ContextMenuRadioGroup
              onValueChange={(value) => {
                editor.setVectorPathComposition(
                  compoundOperationTarget.nodeId,
                  value
                );
              }}
              value={currentOperation}
            >
              {BOOLEAN_VECTOR_COMPOUND_OPERATIONS.map((operation) => (
                <ContextMenuRadioItem
                  key={operation.value}
                  value={operation.value}
                >
                  {operation.label}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuSubPopup>
        </ContextMenuSub>
      ) : null}
      <ContextMenuSeparator />
    </>
  );
};

interface NodeContextMenuItemsProps {
  nodeId: string;
  onStartRenaming?: (() => void) | null;
}

export const NodeContextMenuItems = ({
  nodeId,
  onStartRenaming = null,
}: NodeContextMenuItemsProps) => {
  const editor = useEditor();
  const contextMenuState = useEditorValue((nextEditor, state) => {
    return getNodeContextMenuState({
      editor: nextEditor,
      isSelected: nextEditor.isSelected(nodeId),
      nodeId,
      selectedNodeIds: state.selectedNodeIds,
    });
  });

  return (
    <ContextMenuPopup>
      <GroupNodeContextMenuItems
        canGroupSelection={contextMenuState.canGroupSelection}
        canUngroup={contextMenuState.canUngroup}
        onStartRenaming={onStartRenaming}
        singleTargetNodeId={contextMenuState.singleTargetNodeId}
      />

      <ContextMenuItem onClick={() => editor.duplicate(nodeId)}>
        <LayerGlyph icon={Copy01Icon} size={17} strokeWidth={1.7} />
        Duplicate
        <ContextMenuShortcut>{LAYER_SHORTCUTS.duplicate}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() =>
          applyNodeContextVisibility(
            editor,
            contextMenuState.targetNodeIds,
            contextMenuState.nextVisibility
          )
        }
      >
        <LayerGlyph
          icon={contextMenuState.nextVisibility ? ViewIcon : ViewOffIcon}
          size={17}
          strokeWidth={1.7}
        />
        {contextMenuState.visibilityLabel}
      </ContextMenuItem>
      <CompoundNodeContextMenuItems
        canConvertShapeToPath={contextMenuState.canConvertShapeToPath}
        canJoinCurves={contextMenuState.canJoinCurves}
        canMakeCompoundPath={contextMenuState.canMakeCompoundPath}
        canMergeCurves={contextMenuState.canMergeCurves}
        canReleaseCompoundPath={contextMenuState.canReleaseCompoundPath}
        canSeparateCurves={contextMenuState.canSeparateCurves}
        compoundOperationTarget={contextMenuState.compoundOperationTarget}
        singleTargetNodeId={contextMenuState.singleTargetNodeId}
        targetNodeIds={contextMenuState.targetNodeIds}
      />
      {contextMenuState.canConvertShapeToPath ||
      contextMenuState.canJoinCurves ||
      contextMenuState.canMakeCompoundPath ||
      contextMenuState.canMergeCurves ||
      contextMenuState.canReleaseCompoundPath ||
      contextMenuState.canSeparateCurves ||
      contextMenuState.compoundOperationTarget ? null : (
        <ContextMenuSeparator />
      )}
      <ContextMenuItem
        disabled={
          !contextMenuState.isMultiTarget &&
          Boolean(contextMenuState.singleTargetLayer?.isFrontmost)
        }
        onClick={() => editor.bringToFront(nodeId)}
      >
        <LayerGlyph icon={LayerBringToFrontIcon} size={17} strokeWidth={1.7} />
        Bring to front
        <ContextMenuShortcut>
          {LAYER_SHORTCUTS.bringToFront}
        </ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={
          !contextMenuState.isMultiTarget &&
          Boolean(contextMenuState.singleTargetLayer?.isBackmost)
        }
        onClick={() => editor.sendToBack(nodeId)}
      >
        <LayerGlyph icon={LayerSendToBackIcon} size={17} strokeWidth={1.7} />
        Send to back
        <ContextMenuShortcut>{LAYER_SHORTCUTS.sendToBack}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        className="text-destructive-foreground data-highlighted:bg-destructive/10 data-highlighted:text-destructive-foreground"
        onClick={() => editor.deleteNode(nodeId)}
      >
        <LayerGlyph icon={Delete02Icon} size={17} strokeWidth={1.7} />
        Delete
      </ContextMenuItem>
    </ContextMenuPopup>
  );
};
