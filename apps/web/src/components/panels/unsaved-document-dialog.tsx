import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";

export type UnsavedDocumentChoice = "cancel" | "discard" | "save";
export type UnsavedDocumentReason = "new" | "quit" | "replace";

const DIALOG_CONTENT_BY_REASON = {
  new: {
    destructiveActionLabel: "Continue Without Saving",
    description:
      "Creating a new document will clear your current editor state. Save your work first, continue without saving, or cancel.",
    title: "Save changes before creating a new document?",
  },
  quit: {
    destructiveActionLabel: "Quit Without Saving",
    description:
      "Quitting will close PunchPress and discard your current unsaved changes. Save your work first, discard your changes, or cancel.",
    title: "Save changes before quitting?",
  },
  replace: {
    destructiveActionLabel: "Discard",
    description:
      "Opening another document will replace your current editor state. Save your work first, discard your changes, or cancel.",
    title: "Save changes before opening?",
  },
} as const;

interface UnsavedDocumentDialogProps {
  onChoice: (choice: UnsavedDocumentChoice) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  reason: UnsavedDocumentReason;
}

export const UnsavedDocumentDialog = ({
  onChoice,
  onOpenChange,
  open,
  reason,
}: UnsavedDocumentDialogProps) => {
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const dialogContent = DIALOG_CONTENT_BY_REASON[reason];

  return (
    <Dialog
      disablePointerDismissal
      modal
      onOpenChange={onOpenChange}
      open={open}
    >
      <DialogPopup
        blockOutsidePointerEvents
        bottomStickOnMobile={false}
        initialFocus={saveButtonRef}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{dialogContent.title}</DialogTitle>
          <DialogDescription>{dialogContent.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:items-center sm:justify-between">
          <Button onClick={() => onChoice("cancel")} variant="ghost">
            Cancel
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              onClick={() => onChoice("discard")}
              variant="destructive-soft"
            >
              {dialogContent.destructiveActionLabel}
            </Button>
            <Button onClick={() => onChoice("save")} ref={saveButtonRef}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
};
