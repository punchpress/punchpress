import { createContext, useContext, useEffect, useState } from "react";
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
import {
  confirmMergeCurves,
  type PendingMergeCurves,
} from "./merge-curves-command";

const MergeCurvesContext = createContext<((nodeIds?: string[]) => void) | null>(
  null
);

export const MergeCurvesProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const editor = useEditor();
  const [pendingMerge, setPendingMerge] = useState<PendingMergeCurves | null>(
    null
  );

  useEffect(() => {
    setPendingMerge((pending) => (pending?.editor === editor ? pending : null));
  }, [editor]);

  const mergeCurves = (nodeIds = editor.selectedNodeIds) => {
    if (!editor.canMergeCurves(nodeIds)) {
      return;
    }

    if (editor.hasMixedCurveStyles(nodeIds)) {
      setPendingMerge({ editor, nodeIds: [...nodeIds] });
      return;
    }

    editor.mergeCurves(nodeIds);
  };

  const confirmMerge = () => {
    confirmMergeCurves(editor, pendingMerge);
    setPendingMerge(null);
  };

  return (
    <MergeCurvesContext.Provider value={mergeCurves}>
      {children}
      <Dialog
        modal
        onOpenChange={(open) => {
          if (!open) {
            setPendingMerge(null);
          }
        }}
        open={pendingMerge?.editor === editor}
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
            <Button onClick={() => setPendingMerge(null)} variant="ghost">
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
