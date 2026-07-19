import { ARTBOARD_HEIGHT, ARTBOARD_WIDTH } from "@punchpress/engine";
import type { LocalFontDescriptor } from "@punchpress/punch-schema";
import { MissingDocumentFontsError } from "@punchpress/punch-schema";
import { useEffectEvent, useState } from "react";
import { showToast } from "@/components/ui/toast";
import {
  collectRasterAssetPayloads,
  createPunchPackageBytes,
} from "@/platform/punch-package-client";
import { importSvgToNodes } from "@/platform/svg-import-document";
import {
  clearRecentPunchDocumentFiles,
  getDocumentBaseName,
  getRecentPunchDocumentFiles,
  openPunchDocumentFile,
  openRecentPunchDocumentFile,
  openSvgImportFile,
  type PunchRecentDocument,
  savePunchDocumentFile,
  savePunchPngFile,
  savePunchSvgFile,
} from "@/platform/web-document-files";
import { useWorkspace } from "@/workspace/use-workspace";
import { useEditor } from "../../../editor-react/use-editor";
import {
  type DocumentCommand,
  formatFontList,
  getDocumentCommandErrorTitle,
} from "./document-command-utils";
import { useDocumentCommandTriggers } from "./use-document-command-triggers";
import { useEditorModalBlocking } from "./use-editor-modal-blocking";
import { useUnsavedDocumentWarning } from "./use-unsaved-document-warning";

const getSvgImportTargetCenter = (editor: ReturnType<typeof useEditor>) => {
  return (
    editor.getViewportCenter?.() || {
      x: ARTBOARD_WIDTH / 2,
      y: ARTBOARD_HEIGHT / 2,
    }
  );
};

const renderSvgToPngBlob = async (
  svg: string,
  width: number,
  height: number
) => {
  const image = new Image();
  const objectUrl = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml" })
  );

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not render artboard PNG."));
      image.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not create PNG canvas.");
    }

    context.drawImage(image, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Could not encode artboard PNG."));
          return;
        }

        resolve(blob);
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const useDocumentCommands = () => {
  const editor = useEditor();
  const workspace = useWorkspace();
  const electronDocumentCommands =
    typeof window === "undefined"
      ? undefined
      : window.electron?.documentCommands;
  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = useState(false);
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

  const showMissingFontWarning = useEffectEvent((resolution) => {
    if (resolution.missingFonts.length === 0 || !resolution.replacementFont) {
      return;
    }

    showToast({
      message: `Replaced missing font${
        resolution.missingFonts.length === 1 ? "" : "s"
      } ${formatFontList(resolution.missingFonts)} with ${
        resolution.replacementFont.fullName
      }.`,
      type: "warning",
    });
  });

  const finishOpenedDocument = useEffectEvent(async (openedDocument) => {
    if (!openedDocument) {
      return;
    }

    try {
      const resolution = await workspace.openDocumentTab(openedDocument);
      showMissingFontWarning(resolution);
    } finally {
      await refreshRecentDocuments();
    }
  });

  const saveDocumentTab = useEffectEvent(
    async (tab = workspace.activeTab, forceDialog = false) => {
      if (tab.kind === "scratchpad") {
        showToast({
          message: "Scratchpad saves automatically.",
          type: "info",
        });
        return false;
      }

      // Worker tile encodes must land before the manifest payloads are
      // captured; packaging itself (zip + payload decode) runs in the
      // package worker.
      await tab.editor.rasterAssets.flush();

      const packageBytes = await createPunchPackageBytes(
        tab.editor.serializeDocument(),
        collectRasterAssetPayloads(tab.editor)
      );
      const result = await savePunchDocumentFile(
        tab.editor.serializeDocument(),
        tab.baseName,
        tab.fileHandle,
        forceDialog,
        { packageBytes }
      );

      if (result.canceled) {
        return false;
      }

      workspace.updateTabFileIdentity(tab.id, {
        baseName: result.fileName ? getDocumentBaseName(result.fileName) : null,
        fileHandle: result.fileHandle || tab.fileHandle,
      });
      tab.editor.markDocumentSaved();

      showToast({
        message: `Saved ${result.fileName || `${tab.baseName}.punch`}`,
        type: "success",
      });
      await refreshRecentDocuments();
      return true;
    }
  );

  const isAnyFileBackedDocumentDirty = useEffectEvent(() => {
    return workspace.tabs.some((tab) => tab.kind === "file" && tab.isDirty);
  });
  const {
    confirmClosingDirtyDocument,
    confirmQuittingDirtyDocument,
    unsavedDocumentDialogProps,
  } = useUnsavedDocumentWarning(isAnyFileBackedDocumentDirty, () =>
    saveDocumentTab(workspace.activeTab)
  );

  const handleNewDocument = useEffectEvent(() => {
    setIsNewFileDialogOpen(true);
  });

  const handleCreateNewDocument = useEffectEvent((request) => {
    workspace.createNewFileTab(request);
    setIsNewFileDialogOpen(false);
  });

  const handleOpenDocument = useEffectEvent(async () => {
    const openedDocument = await openPunchDocumentFile();
    await finishOpenedDocument(openedDocument);
  });

  const handleImportSvg = useEffectEvent(async () => {
    const openedSvg = await openSvgImportFile();

    if (!openedSvg) {
      return;
    }

    const importedNodes = await importSvgToNodes(openedSvg.contents, {
      targetCenter: getSvgImportTargetCenter(editor),
    });

    editor.insertNodes(importedNodes);
    showToast({
      message: `Imported ${openedSvg.fileName}`,
      type: "success",
    });
  });

  const handleExportDocument = useEffectEvent(async () => {
    const selectedNode = editor.selectedNode;
    const documentBaseName = workspace.activeTab.baseName;

    if (selectedNode?.type === "artboard") {
      const svg = await editor.exportSelectedArtboardSvg(selectedNode.id);

      if (!svg) {
        throw new Error("Select an artboard before exporting PNG.");
      }

      const png = await renderSvgToPngBlob(
        svg,
        selectedNode.width,
        selectedNode.height
      );
      const result = await savePunchPngFile(png, selectedNode.name);

      if (result.canceled) {
        return;
      }

      showToast({
        message: `Exported ${result.fileName || `${selectedNode.name}.png`}`,
        type: "success",
      });
      return;
    }

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
        handleNewDocument();
        return;
      }

      if (command === "open") {
        await handleOpenDocument();
        return;
      }

      if (command === "import-svg") {
        await handleImportSvg();
        return;
      }

      if (command === "save") {
        await saveDocumentTab(workspace.activeTab);
        return;
      }

      if (command === "save-as") {
        await saveDocumentTab(workspace.activeTab, true);
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

  const closeTabSafely = useEffectEvent(async (tabId) => {
    const tab = workspace.tabs.find((entry) => entry.id === tabId);

    if (!tab) {
      return;
    }

    if (tab.kind !== "file" || !tab.isDirty) {
      workspace.closeTab(tabId);
      return;
    }

    workspace.focusTab(tabId);
    const shouldClose = await confirmClosingDirtyDocument(() =>
      saveDocumentTab(tab)
    );

    if (shouldClose) {
      workspace.closeTab(tabId);
    }
  });

  const openRecentDocumentSafely = useEffectEvent(
    async (recentDocument: PunchRecentDocument) => {
      try {
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

  const confirmQuittingAllDirtyTabs = useEffectEvent(async () => {
    const dirtyTabs = workspace.tabs.filter(
      (tab) => tab.kind === "file" && tab.isDirty
    );

    for (const tab of dirtyTabs) {
      workspace.focusTab(tab.id);
      const shouldContinue = await confirmQuittingDirtyDocument(() =>
        saveDocumentTab(tab)
      );

      if (!shouldContinue) {
        return false;
      }
    }

    return true;
  });

  useDocumentCommandTriggers({
    confirmQuittingDirtyDocument: confirmQuittingAllDirtyTabs,
    electronDocumentCommands,
    finishOpenedDocument,
    handleActionError,
    isDocumentDirty: isAnyFileBackedDocumentDirty,
    refreshRecentDocuments,
    runDocumentCommandSafely,
  });

  useEditorModalBlocking(
    isMissingFontsExportDialogOpen ||
      isNewFileDialogOpen ||
      unsavedDocumentDialogProps.open
  );

  return {
    clearRecentDocumentsSafely,
    closeTabSafely,
    missingFontsExportDialogProps: {
      missingFonts: missingFontsForExport,
      onOpenChange: setIsMissingFontsExportDialogOpen,
      open: isMissingFontsExportDialogOpen,
    },
    newFileDialogProps: {
      onCreate: handleCreateNewDocument,
      onOpenChange: setIsNewFileDialogOpen,
      open: isNewFileDialogOpen,
    },
    openRecentDocumentSafely,
    recentDocuments,
    runDocumentCommandSafely,
    unsavedDocumentDialogProps,
  };
};
