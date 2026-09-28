import type {
  LocalFontCatalogState,
  LocalFontDescriptor,
} from "@punchpress/punch-schema";
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
  catalogState: LocalFontCatalogState;
  missingFonts: LocalFontDescriptor[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const MissingFontsExportDialog = ({
  catalogState,
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
          <DialogTitle>
            Can&apos;t export while fonts are unavailable
          </DialogTitle>
          <DialogDescription>
            {getResolutionMessage(catalogState)}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="pt-0">
          <div className="rounded-xl border bg-muted/50 px-4 py-3 text-sm">
            <div className="font-medium text-foreground">Unresolved fonts</div>
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

const getResolutionMessage = (state: LocalFontCatalogState) => {
  if (state === "ready") {
    return "Install the listed fonts or choose replacements in Text properties before exporting. The document still holds the original fonts.";
  }

  if (state === "unsupported") {
    return "This browser cannot access local fonts. Open the document in the desktop app before exporting. Its original fonts remain saved.";
  }

  if (state === "error") {
    return "Retry local font access before exporting. The document still holds its original fonts.";
  }

  if (state === "permission-denied") {
    return "Allow local font access or open the document in the desktop app before exporting. Its original fonts remain saved.";
  }

  if (state === "loading") {
    return "Wait for the local font check to finish before exporting. The document still holds its original fonts.";
  }

  return "Enable local font access before exporting. The document still holds its original fonts, and its temporary preview is not used for export.";
};
