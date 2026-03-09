import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEditorValue } from "../../editor/use-editor-value";
import { NodeFields } from "./warp-text-fields";

export const PropertiesPanel = () => {
  const bootstrapError = useEditorValue((editor) => editor.bootstrapError);
  const bootstrapState = useEditorValue((editor) => editor.bootstrapState);
  const selectedNode = useEditorValue((editor) => {
    return editor.selectedNodeIds.length === 1 ? editor.selectedNode : null;
  });
  const selectedCount = useEditorValue(
    (editor) => editor.selectedNodeIds.length
  );

  if (!(selectedNode || selectedCount > 1) && bootstrapState !== "error") {
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

        {selectedCount > 1 && (
          <p className="m-0 text-[var(--designer-text-muted)] text-sm">
            {selectedCount} layers selected. Shared actions are available from
            the canvas, shortcuts, and the layers panel.
          </p>
        )}

        {selectedNode && <NodeFields />}
      </div>
    </div>
  );
};
