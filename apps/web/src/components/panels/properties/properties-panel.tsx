import { PERF_COUNTERS } from "@punchpress/engine";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useEditor } from "../../../editor-react/use-editor";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { DesignerPane } from "../../designer/designer";
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
    <DesignerPane data-properties-panel="">
      <div
        className="min-h-0 flex-1 overflow-y-auto px-(--panel-px) pt-(--panel-pt) pb-(--panel-pb)"
        data-testid="properties-panel-body"
      >
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

        {layout.hasSelectionColors ? <SelectionColorsFields /> : null}

        {nodeId && nodeType === "text" ? (
          <TextWarpFields nodeId={nodeId} />
        ) : null}

        {layout.canDelete ? (
          <div className="border-border border-t pt-(--section-py) first:border-t-0 first:pt-0 [&_[data-slot=button]]:w-full">
            <Button
              onClick={() => editor.deleteSelected()}
              size="field"
              type="button"
              variant="destructive-outline"
            >
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </DesignerPane>
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
