import { Alert, AlertDescription } from "@/components/ui/alert";
import { NodeFields } from "./node-fields";

export const PropertiesPanel = ({
  bootstrapError,
  bootstrapState,
  deleteSelected,
  fonts,
  selectedNode,
  updateSelectedNode,
}) => {
  if (!selectedNode && bootstrapState !== "error") {
    return null;
  }

  return (
    <div className="flex max-h-full flex-col rounded-xl border border-[var(--designer-border)] bg-[var(--designer-surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pt-3 pb-3.5">
        {bootstrapState === "error" && (
          <Alert variant="error">
            <AlertDescription>
              tRPC bootstrap failed: {bootstrapError || "Unknown error"}
            </AlertDescription>
          </Alert>
        )}

        {selectedNode && (
          <NodeFields
            deleteSelected={deleteSelected}
            fonts={fonts}
            node={selectedNode}
            updateSelectedNode={updateSelectedNode}
          />
        )}
      </div>
    </div>
  );
};
