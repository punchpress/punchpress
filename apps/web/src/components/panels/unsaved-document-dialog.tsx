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

interface UnsavedDocumentDialogProps {
  onChoice: (choice: UnsavedDocumentChoice) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const UnsavedDocumentDialog = ({
  onChoice,
  onOpenChange,
  open,
}: UnsavedDocumentDialogProps) => {
  const saveButtonRef = useRef<HTMLButtonElement>(null);

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
          <DialogTitle>Save changes before opening?</DialogTitle>
          <DialogDescription>
            Opening another document will replace your current editor state.
            Save your work first, discard your changes, or cancel.
          </DialogDescription>
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
              Discard
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
