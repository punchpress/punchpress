import type { LocalFontDescriptor } from "@punchpress/punch-schema";
import {
  DEFAULT_DOCUMENT_BASE_NAME,
  MissingDocumentFontsError,
} from "@punchpress/punch-schema";
import { useEffectEvent, useState } from "react";
import { showToast } from "@/components/ui/toast";
import {
  clearRecentPunchDocumentFiles,
  getDocumentBaseName,
  getRecentPunchDocumentFiles,
  openPunchDocumentFile,
  openRecentPunchDocumentFile,
  type PunchDocumentHandle,
  type PunchOpenedDocumentFile,
  type PunchRecentDocument,
  savePunchDocumentFile,
  savePunchSvgFile,
} from "@/platform/web-document-files";
import { useEditor } from "../../../editor-react/use-editor";
import {
  type DocumentCommand,
  formatFontList,
  getDocumentCommandErrorTitle,
} from "./document-command-utils";
import { useDocumentCommandTriggers } from "./use-document-command-triggers";
import { useEditorModalBlocking } from "./use-editor-modal-blocking";
import { useUnsavedDocumentWarning } from "./use-unsaved-document-warning";

export const useDocumentCommands = () => {
  const editor = useEditor();
  const electronDocumentCommands =
    typeof window === "undefined"
      ? undefined
      : window.electron?.documentCommands;
  const [documentBaseName, setDocumentBaseName] = useState(
    DEFAULT_DOCUMENT_BASE_NAME
  );
  const [documentHandle, setDocumentHandle] =
    useState<PunchDocumentHandle>(null);
  const [isMissingFontsExportDialogOpen, setIsMissingFontsExportDialogOpen] =
    useState(false);
  const [missingFontsForExport, setMissingFontsForExport] = useState<
    LocalFontDescriptor[]
  >([]);
  const [recentDocuments, setRecentDocuments] = useState<PunchRecentDocument[]>(
    []
  );

  const refreshRecentDocuments = useEffectEvent(async () => {
    setRecentDocuments(await getRecentPunchDocumentFiles());
  });

  const handleActionError = useEffectEvent(
    (command: DocumentCommand, error: unknown) => {
      if (command === "export" && error instanceof MissingDocumentFontsError) {
        setMissingFontsForExport(error.missingFonts);
        setIsMissingFontsExportDialogOpen(true);
        return;
      }

      console.error(error);
      const title = getDocumentCommandErrorTitle(command);
      const description =
        error instanceof Error ? error.message : "Unknown file error.";

      showToast({
        message: `${title}: ${description}`,
        priority: "high",
        type: "error",
      });
    }
  );

  const applyOpenedDocument = useEffectEvent(
    async (openedDocument: PunchOpenedDocumentFile) => {
      await editor.initializeLocalFonts().catch(() => undefined);
      const resolution = editor.loadDocument(openedDocument.contents);
      setDocumentHandle(openedDocument.fileHandle);
      setDocumentBaseName(getDocumentBaseName(openedDocument.fileName));

      if (resolution.missingFonts.length > 0 && resolution.replacementFont) {
        showToast({
          message: `Replaced missing font${
            resolution.missingFonts.length === 1 ? "" : "s"
          } ${formatFontList(resolution.missingFonts)} with ${
            resolution.replacementFont.fullName
          }.`,
          type: "warning",
        });
      }
    }
  );

  const finishOpenedDocument = useEffectEvent(
    async (openedDocument: PunchOpenedDocumentFile | null) => {
      if (!openedDocument) {
        return;
      }

      try {
        await applyOpenedDocument(openedDocument);
      } finally {
        await refreshRecentDocuments();
      }
    }
  );

  const handleSaveDocument = useEffectEvent(async (forceDialog = false) => {
    const result = await savePunchDocumentFile(
      editor.serializeDocument(),
      documentBaseName,
      documentHandle,
      forceDialog
    );

    if (result.canceled) {
      return false;
    }

    setDocumentHandle(result.fileHandle || documentHandle);
    if (result.fileName) {
      setDocumentBaseName(getDocumentBaseName(result.fileName));
    }
    editor.markDocumentSaved();

    showToast({
      message: `Saved ${result.fileName || `${documentBaseName}.punch`}`,
      type: "success",
    });
    await refreshRecentDocuments();
    return true;
  });

  const isDocumentDirty = useEffectEvent(() => editor.isDirty);
  const {
    confirmCreatingNewDirtyDocument,
    confirmQuittingDirtyDocument,
    confirmReplacingDirtyDocument,
    unsavedDocumentDialogProps,
  } = useUnsavedDocumentWarning(isDocumentDirty, () => handleSaveDocument());

  const handleNewDocument = useEffectEvent(async () => {
    if (editor.isDirty && !(await confirmCreatingNewDirtyDocument())) {
      return;
    }

    editor.newDocument();
    setDocumentHandle(null);
    setDocumentBaseName(DEFAULT_DOCUMENT_BASE_NAME);
  });

  const handleOpenDocument = useEffectEvent(async () => {
    if (!(await confirmReplacingDirtyDocument())) {
      return;
    }

    const openedDocument = await openPunchDocumentFile();

    await finishOpenedDocument(openedDocument);
  });

  const handleExportDocument = useEffectEvent(async () => {
    const svg = await editor.exportDocument();
    const result = await savePunchSvgFile(svg, documentBaseName);

    if (result.canceled) {
      return;
    }

    showToast({
      message: `Exported ${result.fileName || `${documentBaseName}.svg`}`,
      type: "success",
    });
  });

  const runDocumentCommand = useEffectEvent(
    async (command: DocumentCommand) => {
      if (command === "new") {
        await handleNewDocument();
        return;
      }

      if (command === "open") {
        await handleOpenDocument();
        return;
      }

      if (command === "save") {
        await handleSaveDocument();
        return;
      }

      if (command === "save-as") {
        await handleSaveDocument(true);
        return;
      }

      await handleExportDocument();
    }
  );

  const runDocumentCommandSafely = useEffectEvent(
    (command: DocumentCommand) => {
      runDocumentCommand(command).catch((error) => {
        handleActionError(command, error);
      });
    }
  );

  const openRecentDocumentSafely = useEffectEvent(
    async (recentDocument: PunchRecentDocument) => {
      try {
        if (!(await confirmReplacingDirtyDocument())) {
          return;
        }

        const openedDocument =
          await openRecentPunchDocumentFile(recentDocument);

        await finishOpenedDocument(openedDocument);
      } catch (error) {
        handleActionError("open", error);
      }
    }
  );

  const clearRecentDocumentsSafely = useEffectEvent(() => {
    clearRecentPunchDocumentFiles()
      .then(() => {
        setRecentDocuments([]);
      })
      .catch((error) => {
        handleActionError("open", error);
      });
  });

  useDocumentCommandTriggers({
    confirmQuittingDirtyDocument,
    confirmReplacingDirtyDocument,
    electronDocumentCommands,
    finishOpenedDocument,
    handleActionError,
    isDocumentDirty,
    refreshRecentDocuments,
    runDocumentCommandSafely,
  });

  useEditorModalBlocking(
    isMissingFontsExportDialogOpen || unsavedDocumentDialogProps.open
  );

  return {
    clearRecentDocumentsSafely,
    missingFontsExportDialogProps: {
      missingFonts: missingFontsForExport,
      onOpenChange: setIsMissingFontsExportDialogOpen,
      open: isMissingFontsExportDialogOpen,
    },
    openRecentDocumentSafely,
    recentDocuments,
    runDocumentCommandSafely,
    unsavedDocumentDialogProps,
  };
};
