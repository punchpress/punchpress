import { PERF_COUNTERS } from "@punchpress/engine";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useEditor } from "../../../editor-react/use-editor";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { AppearancePanel } from "./appearance/appearance";
import { ArtboardFields } from "./artboard-fields";
import { BrushFields } from "./brush-fields";
import { EffectsPanel } from "./effects/effects";
import { ImageFields } from "./image-fields";
import { PathCornerFields } from "./path-corner-fields";
import { PathPointFields } from "./path-point-fields";
import { SelectionColorsFields } from "./selection-colors-fields";
import { ShapeFields } from "./shape-fields";
import { TextFields } from "./text-fields";
import { TextWarpFields } from "./text-warp-fields";
import { usePropertiesPanelLayout } from "./use-properties-panel-layout";

// Lays out the sections for the current selection. Sections read their own
// values, so a value edit re-renders only the controls that show it.
export const PropertiesPanel = () => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelProperties);
  const editor = useEditor();
  const layout = usePropertiesPanelLayout();
  const { nodeId, nodeType, pathNodeId } = layout;

  if (
    layout.selectionKind === "none" &&
    layout.bootstrapState !== "error" &&
    !layout.rasterTool
  ) {
    return null;
  }

  return (
    <div className="flex max-h-full flex-col rounded-2xl border border-[var(--designer-border)] bg-[var(--designer-surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pt-3 pb-3.5">
        {layout.bootstrapState === "error" && (
          <Alert variant="error">
            <AlertDescription>
              Bootstrap failed: {layout.bootstrapError || "Unknown error"}
            </AlertDescription>
          </Alert>
        )}

        {layout.rasterTool ? <BrushFields tool={layout.rasterTool} /> : null}

        {nodeId ? <NodeFields nodeId={nodeId} nodeType={nodeType} /> : null}

        {pathNodeId && layout.showsPathPointCorner ? (
          <PathPointFields nodeId={pathNodeId} />
        ) : null}

        {pathNodeId && layout.showsPathCorners ? (
          <PathCornerFields nodeId={pathNodeId} />
        ) : null}

        {layout.hasAppearance ? <AppearancePanel /> : null}

        <EffectsPanel />

        {layout.hasSelectionColors ? (
          <SelectionColorsFields
            withTopBorder={layout.hasLeadingFields || layout.hasAppearance}
          />
        ) : null}

        {nodeId && nodeType === "text" ? (
          <TextWarpFields
            nodeId={nodeId}
            withTopBorder={layout.hasAppearance || layout.hasSelectionColors}
          />
        ) : null}

        {layout.canDelete ? (
          <div className="border-black/4 border-t pt-4 [&_[data-slot=button]]:w-full">
            <Button
              onClick={() => editor.deleteSelected()}
              size="sm"
              type="button"
              variant="destructive-outline"
            >
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// The inspected node's own section, by node type.
const NodeFields = ({
  nodeId,
  nodeType,
}: {
  nodeId: string;
  nodeType: string | null;
}) => {
  if (nodeType === "text") {
    return <TextFields nodeId={nodeId} />;
  }

  if (nodeType === "artboard") {
    return <ArtboardFields nodeId={nodeId} />;
  }

  if (nodeType === "shape") {
    return <ShapeFields nodeId={nodeId} />;
  }

  return nodeType === "image" ? <ImageFields nodeId={nodeId} /> : null;
};
