import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import {
  BOOLEAN_VECTOR_COMPOUND_OPERATIONS,
  getCompoundVectorOperationTarget,
  isBooleanVectorCompoundOperation,
} from "@/lib/vector-compound-operation";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { LayerNodeIcon } from "./layer-node-icon";

interface LayerCompoundOperationMenuProps {
  className?: string;
  label: string;
  nodeId: string;
  nodeType?: string | null;
  onSelect: () => void;
}

export const LayerCompoundOperationMenu = ({
  className,
  label,
  nodeId,
  nodeType = null,
  onSelect,
}: LayerCompoundOperationMenuProps) => {
  const editor = useEditor();
  const compoundTarget = useEditorValue((nextEditor) =>
    getCompoundVectorOperationTarget(nextEditor, nodeId)
  );

  if (!compoundTarget || compoundTarget.nodeId !== nodeId) {
    return (
      <span aria-hidden="true" className={className}>
        <LayerNodeIcon nodeType={nodeType} />
      </span>
    );
  }

  const currentOperation = isBooleanVectorCompoundOperation(
    compoundTarget.pathComposition
  )
    ? compoundTarget.pathComposition
    : undefined;

  return (
    <Menu modal={false}>
      <MenuTrigger
        aria-label={`Compound operation for ${label}`}
        className={cn(
          "rounded-[6px] border-0 bg-transparent p-0 outline-none",
          className
        )}
        data-layer-compound-operation-node-id={nodeId}
        onClick={(event) => {
          event.stopPropagation();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        title="Compound operation"
        type="button"
      >
        <LayerNodeIcon nodeType={nodeType} />
      </MenuTrigger>
      <MenuPopup align="start" sideOffset={8}>
        <MenuRadioGroup
          onValueChange={(value) => {
            editor.setVectorPathComposition(nodeId, value);
          }}
          value={currentOperation}
        >
          {BOOLEAN_VECTOR_COMPOUND_OPERATIONS.map((operation) => (
            <MenuRadioItem key={operation.value} value={operation.value}>
              {operation.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
};
