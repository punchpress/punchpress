import { useEffectEvent, useRef, useState } from "react";
import type {
  UnsavedDocumentChoice,
  UnsavedDocumentReason,
} from "../unsaved-document-dialog";

export const useUnsavedDocumentWarning = (
  isDirty: () => boolean,
  saveDocument: () => Promise<boolean>
) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reason, setReason] = useState<UnsavedDocumentReason>("replace");
  const pendingChoiceResolverRef = useRef<
    ((choice: UnsavedDocumentChoice) => void) | null
  >(null);

  const resolveChoice = useEffectEvent((choice: UnsavedDocumentChoice) => {
    const resolve = pendingChoiceResolverRef.current;

    pendingChoiceResolverRef.current = null;
    setIsDialogOpen(false);
    resolve?.(choice);
  });

  const handleDialogOpenChange = useEffectEvent((open: boolean) => {
    if (open) {
      setIsDialogOpen(true);
      return;
    }

    if (pendingChoiceResolverRef.current) {
      resolveChoice("cancel");
      return;
    }

    setIsDialogOpen(false);
  });

  const confirmDirtyDocument = useEffectEvent(
    async (nextReason: UnsavedDocumentReason) => {
      if (!isDirty()) {
        return true;
      }

      if (pendingChoiceResolverRef.current) {
        return false;
      }

      setReason(nextReason);
      setIsDialogOpen(true);
      const choice = await new Promise<UnsavedDocumentChoice>((resolve) => {
        pendingChoiceResolverRef.current = resolve;
      });

      if (choice === "save") {
        return saveDocument();
      }

      return choice === "discard";
    }
  );

  const confirmCreatingNewDirtyDocument = useEffectEvent(() => {
    return confirmDirtyDocument("new");
  });

  const confirmQuittingDirtyDocument = useEffectEvent(() => {
    return confirmDirtyDocument("quit");
  });

  const confirmReplacingDirtyDocument = useEffectEvent(() => {
    return confirmDirtyDocument("replace");
  });

  return {
    confirmCreatingNewDirtyDocument,
    confirmQuittingDirtyDocument,
    confirmReplacingDirtyDocument,
    unsavedDocumentDialogProps: {
      onChoice: resolveChoice,
      onOpenChange: handleDialogOpenChange,
      open: isDialogOpen,
      reason,
    },
  };
};
