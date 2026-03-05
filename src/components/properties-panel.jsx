import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { NodeFields } from "./node-fields";

export const PropertiesPanel = ({
  bootstrapError,
  bootstrapState,
  deleteSelected,
  fonts,
  selectedNode,
  updateSelectedNode,
}) => {
  return (
    <aside className="properties-panel">
      {bootstrapState === "error" && (
        <Alert variant="error">
          <AlertDescription>
            tRPC bootstrap failed: {bootstrapError || "Unknown error"}
          </AlertDescription>
        </Alert>
      )}

      {!selectedNode && (
        <Card>
          <CardContent>No selection</CardContent>
        </Card>
      )}

      {selectedNode && (
        <NodeFields
          deleteSelected={deleteSelected}
          fonts={fonts}
          node={selectedNode}
          updateSelectedNode={updateSelectedNode}
        />
      )}
    </aside>
  );
};
