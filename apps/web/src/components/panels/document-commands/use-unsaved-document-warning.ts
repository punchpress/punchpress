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
    async (
      nextReason: UnsavedDocumentReason,
      saveDirtyDocument = saveDocument
    ) => {
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
        return saveDirtyDocument();
      }

      return choice === "discard";
    }
  );

  const confirmClosingDirtyDocument = useEffectEvent(
    (saveDirtyDocument?: () => Promise<boolean>) => {
      return confirmDirtyDocument("close", saveDirtyDocument);
    }
  );

  const confirmCreatingNewDirtyDocument = useEffectEvent(
    (saveDirtyDocument?: () => Promise<boolean>) => {
      return confirmDirtyDocument("new", saveDirtyDocument);
    }
  );

  const confirmQuittingDirtyDocument = useEffectEvent(
    (saveDirtyDocument?: () => Promise<boolean>) => {
      return confirmDirtyDocument("quit", saveDirtyDocument);
    }
  );

  const confirmReplacingDirtyDocument = useEffectEvent(
    (saveDirtyDocument?: () => Promise<boolean>) => {
      return confirmDirtyDocument("replace", saveDirtyDocument);
    }
  );

  return {
    confirmClosingDirtyDocument,
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
