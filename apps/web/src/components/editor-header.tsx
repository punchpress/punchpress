import { BadgeAlertIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DesignerHeaderEyebrow,
  DesignerHeaderGroup,
  DesignerHeaderMeta,
  DesignerHeaderTitle,
} from "./designer/designer";

const STATUS_COPY = {
  error: "Bootstrap error",
  loading: "Loading fonts",
  ready: "Ready",
};

export const EditorHeader = ({
  bootstrapState,
  bootstrapError,
  onAddText,
  selectedNode,
  totalNodes,
}) => {
  return (
    <>
      <DesignerHeaderGroup>
        <div>
          <DesignerHeaderEyebrow>PunchPress designer</DesignerHeaderEyebrow>
          <DesignerHeaderTitle>San Diego editor MVP</DesignerHeaderTitle>
        </div>
        <DesignerHeaderMeta>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--designer-border)] bg-black/4 px-2.5 py-1 text-[11px] text-[var(--designer-text-muted)]">
            {STATUS_COPY[bootstrapState]}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--designer-border)] bg-black/4 px-2.5 py-1 text-[11px] text-[var(--designer-text-muted)]">
            {totalNodes} layers
          </span>
          {selectedNode ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--designer-border)] bg-black/4 px-2.5 py-1 text-[11px] text-[var(--designer-text-muted)]">
              Selected: {selectedNode.text}
            </span>
          ) : null}
        </DesignerHeaderMeta>
      </DesignerHeaderGroup>

      <DesignerHeaderGroup className="justify-end">
        {bootstrapState === "error" ? (
          <output className="inline-flex items-center gap-1.5 rounded-full border border-red-600/16 bg-red-600/6 px-2.5 py-1 text-[11px] text-red-600">
            <BadgeAlertIcon size={14} />
            <span>{bootstrapError || "Unknown bootstrap error"}</span>
          </output>
        ) : null}
        <Button onClick={onAddText} size="sm" type="button">
          <PlusIcon size={16} />
          Add text
        </Button>
      </DesignerHeaderGroup>
    </>
  );
};
