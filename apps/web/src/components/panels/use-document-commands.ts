import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { showToast } from "@/components/ui/toast";
import { DEFAULT_DOCUMENT_BASE_NAME } from "@/document/constants";
import { MissingDocumentFontsError } from "@/document/errors";
import { useElectronIpcEvent } from "@/hooks/use-electron-ipc-event";
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
import type { LocalFontDescriptor } from "../../editor/local-fonts";
import { shouldIgnoreGlobalShortcutTarget } from "../../editor/primitives/dom";
import { useEditor } from "../../editor/use-editor";
import type {
  UnsavedDocumentChoice,
  UnsavedDocumentReason,
} from "./unsaved-document-dialog";

type DocumentCommand = "export" | "new" | "open" | "save" | "save-as";

const getDocumentCommandFromKeyEvent = (event: KeyboardEvent) => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) {
    return null;
  }

  const key = event.key.toLowerCase();

  if (key === "o") {
    return "open";
  }

  if (key === "n") {
    return "new";
  }

  if (key === "e") {
    return "export";
  }

  if (key === "s" && event.shiftKey) {
    return "save-as";
  }

  if (key === "s") {
    return "save";
  }

  return null;
};

const getDocumentCommandErrorTitle = (command: DocumentCommand) => {
  if (command === "open") {
    return "Couldn't open file";
  }

  if (command === "new") {
    return "Couldn't create document";
  }

  if (command === "save" || command === "save-as") {
    return "Couldn't save file";
  }

  if (command === "export") {
    return "Couldn't export SVG";
  }

  return "File action failed";
};

const formatFontList = (fonts: LocalFontDescriptor[]) => {
  if (fonts.length === 1) {
    return fonts[0].fullName;
  }

  if (fonts.length === 2) {
    return `${fonts[0].fullName} and ${fonts[1].fullName}`;
  }

  return `${fonts[0].fullName}, ${fonts[1].fullName}, and ${fonts.length - 2} more`;
};

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
  const [isUnsavedDocumentDialogOpen, setIsUnsavedDocumentDialogOpen] =
    useState(false);
  const [unsavedDocumentReason, setUnsavedDocumentReason] =
    useState<UnsavedDocumentReason>("replace");
  const [isMissingFontsExportDialogOpen, setIsMissingFontsExportDialogOpen] =
    useState(false);
  const [missingFontsForExport, setMissingFontsForExport] = useState<
    LocalFontDescriptor[]
  >([]);
  const [recentDocuments, setRecentDocuments] = useState<PunchRecentDocument[]>(
    []
  );
  const pendingUnsavedDocumentChoiceResolverRef = useRef<
    ((choice: UnsavedDocumentChoice) => void) | null
  >(null);

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

  const resolveUnsavedDocumentChoice = useEffectEvent(
    (choice: UnsavedDocumentChoice) => {
      const resolve = pendingUnsavedDocumentChoiceResolverRef.current;

      pendingUnsavedDocumentChoiceResolverRef.current = null;
      setIsUnsavedDocumentDialogOpen(false);
      resolve?.(choice);
    }
  );

  const handleUnsavedDocumentDialogOpenChange = useEffectEvent(
    (open: boolean) => {
      if (open) {
        setIsUnsavedDocumentDialogOpen(true);
        return;
      }

      if (pendingUnsavedDocumentChoiceResolverRef.current) {
        resolveUnsavedDocumentChoice("cancel");
        return;
      }

      setIsUnsavedDocumentDialogOpen(false);
    }
  );

  const confirmDirtyDocument = useEffectEvent(
    async (reason: UnsavedDocumentReason) => {
      if (!editor.isDirty) {
        return true;
      }

      if (pendingUnsavedDocumentChoiceResolverRef.current) {
        return false;
      }

      setUnsavedDocumentReason(reason);
      setIsUnsavedDocumentDialogOpen(true);
      const choice = await new Promise<UnsavedDocumentChoice>((resolve) => {
        pendingUnsavedDocumentChoiceResolverRef.current = resolve;
      });

      if (choice === "save") {
        return handleSaveDocument();
      }

      return choice === "discard";
    }
  );

  const confirmReplacingDirtyDocument = useEffectEvent(() => {
    return confirmDirtyDocument("replace");
  });

  const confirmQuittingDirtyDocument = useEffectEvent(() => {
    return confirmDirtyDocument("quit");
  });

  const confirmCreatingNewDirtyDocument = useEffectEvent(() => {
    return confirmDirtyDocument("new");
  });

  const handleNewDocument = useEffectEvent(async () => {
    if (!editor.isDirty) {
      editor.newDocument();
      setDocumentHandle(null);
      setDocumentBaseName(DEFAULT_DOCUMENT_BASE_NAME);
      return;
    }

    if (!(await confirmCreatingNewDirtyDocument())) {
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

  const applyOpenedDocumentSafely = useEffectEvent(
    async (openedDocument: PunchOpenedDocumentFile | null) => {
      if (!(await confirmReplacingDirtyDocument())) {
        return;
      }

      await finishOpenedDocument(openedDocument);
    }
  );

  const runDocumentCommandSafely = useEffectEvent(
    (command: DocumentCommand) => {
      runDocumentCommand(command).catch((error) => {
        handleActionError(command, error);
      });
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
  const isDocumentDirty = useEffectEvent(() => editor.isDirty);

  useElectronIpcEvent(electronDocumentCommands?.onCommand, (command) => {
    runDocumentCommandSafely(command);
  });

  useElectronIpcEvent(electronDocumentCommands?.onBeforeClose, (requestId) => {
    confirmQuittingDirtyDocument()
      .then((shouldClose) => {
        electronDocumentCommands?.respondBeforeClose(requestId, shouldClose);
      })
      .catch((error) => {
        console.error(error);
        electronDocumentCommands?.respondBeforeClose(requestId, false);
      });
  });

  useElectronIpcEvent(
    electronDocumentCommands?.onOpenDocument,
    (openedDocument) => {
      applyOpenedDocumentSafely(openedDocument).catch((error) => {
        handleActionError("open", error);
      });
    }
  );

  useElectronIpcEvent(
    electronDocumentCommands?.onRecentDocumentsChanged,
    () => {
      refreshRecentDocuments().catch((error) => {
        handleActionError("open", error);
      });
    }
  );

  useEffect(() => {
    if (window.electron?.documentCommands) {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreGlobalShortcutTarget(event.target)) {
        return;
      }

      const command = getDocumentCommandFromKeyEvent(event);

      if (!command) {
        return;
      }

      event.preventDefault();
      runDocumentCommandSafely(command);
    };

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, []);

  useEffect(() => {
    electronDocumentCommands?.markReady?.();
  }, [electronDocumentCommands]);

  useEffect(() => {
    refreshRecentDocuments().catch((error) => {
      handleActionError("open", error);
    });
  }, []);

  useEffect(() => {
    if (window.electron?.versions) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDocumentDirty()) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useLayoutEffect(() => {
    const editorShell = document.querySelector("[data-editor-shell-root]");
    const isBlockingDialogOpen =
      isMissingFontsExportDialogOpen || isUnsavedDocumentDialogOpen;

    if (!(editorShell instanceof HTMLElement)) {
      return;
    }

    const previousPointerEvents = editorShell.style.pointerEvents;
    editorShell.inert = isBlockingDialogOpen;
    editorShell.style.pointerEvents = isBlockingDialogOpen
      ? "none"
      : previousPointerEvents;

    return () => {
      editorShell.inert = false;
      editorShell.style.pointerEvents = previousPointerEvents;
    };
  }, [isMissingFontsExportDialogOpen, isUnsavedDocumentDialogOpen]);

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
    unsavedDocumentDialogProps: {
      onChoice: resolveUnsavedDocumentChoice,
      onOpenChange: handleUnsavedDocumentDialogOpenChange,
      open: isUnsavedDocumentDialogOpen,
      reason: unsavedDocumentReason,
    },
  };
};
