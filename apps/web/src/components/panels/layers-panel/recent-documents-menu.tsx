import { FolderOpenIcon } from "lucide-react";
import {
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "@/components/ui/menu";
import { getRecentDocumentSecondaryLabel } from "./recent-documents";

export const RecentDocumentsMenu = ({
  clearRecentDocumentsSafely,
  duplicateRecentDocumentNames,
  openRecentDocumentSafely,
  recentDocuments,
}) => {
  if (recentDocuments.length === 0) {
    return (
      <MenuItem disabled>
        <FolderOpenIcon size={15} />
        Open Recent
      </MenuItem>
    );
  }

  return (
    <MenuSub>
      <MenuSubTrigger>
        <FolderOpenIcon size={15} />
        Open Recent
      </MenuSubTrigger>
      <MenuSubPopup>
        {recentDocuments
          .map((recentDocument) => {
            const secondaryLabel = getRecentDocumentSecondaryLabel(
              recentDocument,
              duplicateRecentDocumentNames
            );

            return (
              <MenuItem
                key={recentDocument.id}
                onClick={() => {
                  openRecentDocumentSafely(recentDocument);
                }}
                title={recentDocument.filePath || undefined}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {recentDocument.fileName}
                  </span>
                  {secondaryLabel ? (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {secondaryLabel}
                    </span>
                  ) : null}
                </span>
              </MenuItem>
            );
          })
          .concat([
            <MenuSeparator key="recent-documents-separator" />,
            <MenuItem
              key="clear-recent-documents"
              onClick={() => {
                clearRecentDocumentsSafely();
              }}
            >
              Clear Recent
            </MenuItem>,
          ])}
      </MenuSubPopup>
    </MenuSub>
  );
};
