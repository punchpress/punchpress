import type {
  LocalFontCatalogState,
  LocalFontDescriptor,
} from "@punchpress/punch-schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useEditorValue } from "../../editor-react/use-editor-value";

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
  const catalogState = useEditorValue((editor) => editor.fontCatalogState);

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
        <DialogPanel>
          <Alert>
            <AlertTitle>Unresolved fonts</AlertTitle>
            <AlertDescription>
              <ul className="flex list-none flex-col gap-0.5 pl-0">
                {missingFonts.map((font) => {
                  return <li key={font.postscriptName}>{font.fullName}</li>;
                })}
              </ul>
            </AlertDescription>
          </Alert>
        </DialogPanel>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            size="chrome"
            type="button"
          >
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
