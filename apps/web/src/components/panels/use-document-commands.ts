import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { showToast } from "@/components/ui/toast";
import { DEFAULT_DOCUMENT_BASE_NAME } from "@/document/constants";
import {
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
import { shouldIgnoreGlobalShortcutTarget } from "../../editor/primitives/dom";
import { useEditor } from "../../editor/use-editor";
import type { UnsavedDocumentChoice } from "./unsaved-document-dialog";

type DocumentCommand = "export" | "open" | "save" | "save-as";

const getDocumentCommandFromKeyEvent = (event: KeyboardEvent) => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) {
    return null;
  }

  const key = event.key.toLowerCase();

  if (key === "o") {
    return "open";
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

  if (command === "save" || command === "save-as") {
    return "Couldn't save file";
  }

  if (command === "export") {
    return "Couldn't export SVG";
  }

  return "File action failed";
};

export const useDocumentCommands = () => {
  const editor = useEditor();
  const [documentBaseName, setDocumentBaseName] = useState(
    DEFAULT_DOCUMENT_BASE_NAME
  );
  const [documentHandle, setDocumentHandle] =
    useState<PunchDocumentHandle>(null);
  const [isUnsavedDocumentDialogOpen, setIsUnsavedDocumentDialogOpen] =
    useState(false);
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
    (openedDocument: PunchOpenedDocumentFile) => {
      editor.loadDocument(openedDocument.contents);
      setDocumentHandle(openedDocument.fileHandle);
      setDocumentBaseName(getDocumentBaseName(openedDocument.fileName));
    }
  );

  const finishOpenedDocument = useEffectEvent(
    async (openedDocument: PunchOpenedDocumentFile | null) => {
      if (!openedDocument) {
        return;
      }

      try {
        applyOpenedDocument(openedDocument);
      } finally {
        await refreshRecentDocuments();
      }
    }
  );

  const handleSaveDocument = useEffectEvent(async (forceDialog = false) => {
    const result = await savePunchDocumentFile(
      editor.serializeDocument(),
      documentBaseName,
      forceDialog ? null : documentHandle,
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

  const confirmReplacingDirtyDocument = useEffectEvent(async () => {
    if (!editor.isDirty) {
      return true;
    }

    if (pendingUnsavedDocumentChoiceResolverRef.current) {
      return false;
    }

    setIsUnsavedDocumentDialogOpen(true);
    const choice = await new Promise<UnsavedDocumentChoice>((resolve) => {
      pendingUnsavedDocumentChoiceResolverRef.current = resolve;
    });

    if (choice === "save") {
      return handleSaveDocument();
    }

    return choice === "discard";
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
    const unsubscribeCommand = window.electron?.documentCommands?.onCommand(
      (command) => {
        runDocumentCommandSafely(command);
      }
    );
    const unsubscribeOpenDocument =
      window.electron?.documentCommands?.onOpenDocument((openedDocument) => {
        applyOpenedDocumentSafely(openedDocument).catch((error) => {
          handleActionError("open", error);
        });
      });
    window.electron?.documentCommands?.markReady?.();

    return () => {
      unsubscribeCommand?.();
      unsubscribeOpenDocument?.();
    };
  }, []);

  useEffect(() => {
    refreshRecentDocuments().catch((error) => {
      handleActionError("open", error);
    });
  }, []);

  useLayoutEffect(() => {
    const editorShell = document.querySelector("[data-editor-shell-root]");

    if (!(editorShell instanceof HTMLElement)) {
      return;
    }

    const previousPointerEvents = editorShell.style.pointerEvents;
    editorShell.inert = isUnsavedDocumentDialogOpen;
    editorShell.style.pointerEvents = isUnsavedDocumentDialogOpen
      ? "none"
      : previousPointerEvents;

    return () => {
      editorShell.inert = false;
      editorShell.style.pointerEvents = previousPointerEvents;
    };
  }, [isUnsavedDocumentDialogOpen]);

  return {
    openRecentDocumentSafely,
    recentDocuments,
    runDocumentCommandSafely,
    unsavedDocumentDialogProps: {
      onChoice: resolveUnsavedDocumentChoice,
      onOpenChange: handleUnsavedDocumentDialogOpenChange,
      open: isUnsavedDocumentDialogOpen,
    },
  };
};
