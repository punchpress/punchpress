import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useEditor } from "../../../editor-react/use-editor";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { AppearanceFields } from "./appearance-fields";
import { ShapeFields } from "./shape-fields";
import { TextFields } from "./text-fields";
import { TextWarpFields } from "./text-warp-fields";
import { usePropertiesPanelState } from "./use-properties-panel-state";

export const PropertiesPanel = () => {
  usePerformanceRenderCounter("render.panel.properties");
  const editor = useEditor();
  const { bootstrapError, bootstrapState, selectionProperties } =
    usePropertiesPanelState();
  const hasAppearanceFields = Boolean(
    selectionProperties.properties.fill ||
      selectionProperties.properties.stroke ||
      selectionProperties.properties.strokeWidth
  );
  const selectedNode = selectionProperties.selectedNode;

  if (
    selectionProperties.selectionKind === "none" &&
    bootstrapState !== "error"
  ) {
    return null;
  }

  return (
    <div className="flex max-h-full flex-col rounded-xl border border-[var(--designer-border)] bg-[var(--designer-surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pt-3 pb-3.5">
        {bootstrapState === "error" && (
          <Alert variant="error">
            <AlertDescription>
              Bootstrap failed: {bootstrapError || "Unknown error"}
            </AlertDescription>
          </Alert>
        )}

        {selectionProperties.selectionKind === "multi" && (
          <p className="m-0 text-[var(--designer-text-muted)] text-sm">
            {selectionProperties.selectedCount} layers selected. Shared
            properties below apply to the full selection.
          </p>
        )}

        {selectionProperties.selectionKind === "group" && (
          <p className="m-0 text-[var(--designer-text-muted)] text-sm">
            Group selected. Use the canvas or layers panel to drill in, ungroup,
            or transform its contents together.
          </p>
        )}

        {selectedNode?.type === "text" ? (
          <TextFields node={selectedNode} />
        ) : null}

        {selectedNode?.type === "shape" ? (
          <ShapeFields
            height={selectionProperties.properties.height}
            node={selectedNode}
            shape={selectionProperties.properties.shape}
            width={selectionProperties.properties.width}
          />
        ) : null}

        {hasAppearanceFields ? (
          <AppearanceFields
            fill={selectionProperties.properties.fill}
            stroke={selectionProperties.properties.stroke}
            strokeWidth={selectionProperties.properties.strokeWidth}
          />
        ) : null}

        {selectedNode?.type === "text" ? (
          <TextWarpFields node={selectedNode} />
        ) : null}

        {selectionProperties.canDelete ? (
          <div className="border-black/6 border-t pt-3 [&_[data-slot=button]]:w-full">
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
