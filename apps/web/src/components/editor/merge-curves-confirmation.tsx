import { createContext, useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEditor } from "../../editor-react/use-editor";

const MergeCurvesContext = createContext<((nodeIds?: string[]) => void) | null>(
  null
);

export const MergeCurvesProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const editor = useEditor();
  const [pendingNodeIds, setPendingNodeIds] = useState<string[] | null>(null);

  const mergeCurves = (nodeIds = editor.selectedNodeIds) => {
    if (!editor.canMergeCurves(nodeIds)) {
      return;
    }

    if (editor.hasMixedCurveStyles(nodeIds)) {
      setPendingNodeIds([...nodeIds]);
      return;
    }

    editor.mergeCurves(nodeIds);
  };

  const confirmMerge = () => {
    if (pendingNodeIds) {
      editor.mergeCurves(pendingNodeIds);
    }
    setPendingNodeIds(null);
  };

  return (
    <MergeCurvesContext.Provider value={mergeCurves}>
      {children}
      <Dialog
        modal
        onOpenChange={(open) => {
          if (!open) {
            setPendingNodeIds(null);
          }
        }}
        open={pendingNodeIds !== null}
      >
        <DialogPopup bottomStickOnMobile={false} showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Merge curves into one style?</DialogTitle>
            <DialogDescription>
              These curves have different styles. The merged path will use the
              first selected curve&apos;s style. Separate Curves will not
              restore the other styles. Group selection keeps each curve&apos;s
              appearance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingNodeIds(null)} variant="ghost">
              Cancel
            </Button>
            <Button onClick={confirmMerge}>Merge Curves</Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </MergeCurvesContext.Provider>
  );
};

export const useMergeCurves = () => {
  const mergeCurves = useContext(MergeCurvesContext);

  if (!mergeCurves) {
    throw new Error("useMergeCurves requires MergeCurvesProvider");
  }

  return mergeCurves;
};
