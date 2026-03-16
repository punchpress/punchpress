import type { LocalFontDescriptor } from "@punchpress/punch-schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";

interface MissingFontsExportDialogProps {
  missingFonts: LocalFontDescriptor[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const MissingFontsExportDialog = ({
  missingFonts,
  onOpenChange,
  open,
}: MissingFontsExportDialogProps) => {
  return (
    <Dialog modal onOpenChange={onOpenChange} open={open}>
      <DialogPopup
        blockOutsidePointerEvents
        bottomStickOnMobile={false}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Can&apos;t export while fonts are missing</DialogTitle>
          <DialogDescription>
            Install the missing font or choose another font before exporting
            this document.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="pt-0">
          <div className="rounded-xl border bg-muted/50 px-4 py-3 text-sm">
            <div className="font-medium text-foreground">Missing fonts</div>
            <ul className="mt-2 flex list-none flex-col gap-1 pl-0 text-muted-foreground">
              {missingFonts.map((font) => {
                return <li key={font.postscriptName}>{font.fullName}</li>;
              })}
            </ul>
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button">
            OK
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
};
