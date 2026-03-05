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
        <div className="panel-message error">
          tRPC bootstrap failed: {bootstrapError || "Unknown error"}
        </div>
      )}

      {!selectedNode && <div className="panel-message">No selection</div>}

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
