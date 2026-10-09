import { ViewIcon, ViewOffIcon } from "@hugeicons-pro/core-stroke-rounded";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { LayerGlyph } from "./layer-glyph";
import { LayerNodeIcon } from "./layer-node-icon";
import { LayerTreeRowParts } from "./layer-tree-row-parts";

// The drag overlay takes the source row's box, so the ghost fills it and
// reads as the row lifted off the list.
export const LayerTreeDragGhost = ({ nodeId }) => {
  const layer = useEditorValue((editor) => editor.getLayerRow(nodeId));

  if (!layer) {
    return null;
  }

  const VisibilityIcon = layer.isVisible ? ViewIcon : ViewOffIcon;

  return (
    <LayerTreeRowParts.Root
      className="cursor-grabbing border border-(--pane-border) bg-(--pane-surface) opacity-90 shadow-md"
      muted={!layer.isVisible}
    >
      <LayerTreeRowParts.Spacer />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <LayerTreeRowParts.Icon>
          <LayerNodeIcon isGroup={layer.isGroup} nodeType={layer.node.type} />
        </LayerTreeRowParts.Icon>
        <LayerTreeRowParts.Label>{layer.label}</LayerTreeRowParts.Label>
      </span>
      <span className="inline-flex size-(--field-icon-button) shrink-0 items-center justify-center text-foreground/42">
        <LayerGlyph
          className="size-(--chrome-icon)"
          icon={VisibilityIcon}
          strokeWidth={1.8}
        />
      </span>
    </LayerTreeRowParts.Root>
  );
};
