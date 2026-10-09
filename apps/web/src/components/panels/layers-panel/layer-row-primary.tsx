import { Input } from "@/components/ui/input";
import { getCompoundVectorOperationTarget } from "@/lib/vector-compound-operation";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { LayerCompoundOperationMenu } from "./layer-compound-operation-menu";
import { LayerNodeIcon } from "./layer-node-icon";
import { LayerTreeRowParts } from "./layer-tree-row-parts";
import type { useLayerRename } from "./use-layer-rename";

const PRIMARY_CLASS_NAME =
  "flex h-full min-w-0 flex-1 items-center gap-1.5 border-0 bg-transparent p-0 text-left text-inherit outline-none";

interface LayerRowPrimaryProps {
  layer: {
    isActive: boolean;
    isContainer: boolean;
    isGroup: boolean;
    isSelected: boolean;
    label: string;
    node: { id: string; type: string };
  };
  onDoubleClick: () => void;
  onSelect: (event?: { shiftKey: boolean }) => void;
  rename: ReturnType<typeof useLayerRename>;
}

// The icon and name of a layer row: a select button, the rename input while
// renaming, or a compound-operation menu on the icon for compound vectors.
export const LayerRowPrimary = ({
  layer,
  onDoubleClick,
  onSelect,
  rename,
}: LayerRowPrimaryProps) => {
  const nodeId = layer.node.id;
  const hasCompoundMenu = useEditorValue((editor) => {
    return getCompoundVectorOperationTarget(editor, nodeId)?.nodeId === nodeId;
  });
  const icon = (
    <LayerNodeIcon isGroup={layer.isGroup} nodeType={layer.node.type} />
  );
  const selectButtonProps = {
    "aria-current": layer.isActive ? ("true" as const) : undefined,
    "aria-label": layer.label,
    "aria-pressed": layer.isSelected,
    "data-layer-node-id": layer.node.id,
    onClick: onSelect,
    onDoubleClick,
    type: "button" as const,
  };

  if (layer.isContainer && rename.isRenaming) {
    return (
      <div className={PRIMARY_CLASS_NAME}>
        <LayerTreeRowParts.Icon>{icon}</LayerTreeRowParts.Icon>
        <Input
          className="min-w-0 flex-1"
          nativeInput
          size="field"
          {...rename.inputProps}
        />
      </div>
    );
  }

  if (!hasCompoundMenu) {
    return (
      <button className={PRIMARY_CLASS_NAME} {...selectButtonProps}>
        <LayerTreeRowParts.Icon>{icon}</LayerTreeRowParts.Icon>
        <LayerTreeRowParts.Label>{layer.label}</LayerTreeRowParts.Label>
      </button>
    );
  }

  return (
    <div className={PRIMARY_CLASS_NAME}>
      {/* The icon is the compound-operation menu trigger here, so it stays
          exposed to assistive technology. */}
      <LayerTreeRowParts.Icon aria-hidden={undefined}>
        <LayerCompoundOperationMenu
          className="inline-flex items-center justify-center"
          label={layer.label}
          nodeId={layer.node.id}
          nodeType={layer.node.type}
          onSelect={onSelect}
        />
      </LayerTreeRowParts.Icon>
      <button className={PRIMARY_CLASS_NAME} {...selectButtonProps}>
        <LayerTreeRowParts.Label>{layer.label}</LayerTreeRowParts.Label>
      </button>
    </div>
  );
};
