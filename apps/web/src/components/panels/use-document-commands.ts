import { useEffect, useEffectEvent, useState } from "react";
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
import { useEditor } from "../../editor/use-editor";

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
  const [recentDocuments, setRecentDocuments] = useState<PunchRecentDocument[]>(
    []
  );

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

  const handleOpenDocument = useEffectEvent(async () => {
    const openedDocument = await openPunchDocumentFile();

    if (!openedDocument) {
      return;
    }

    applyOpenedDocument(openedDocument);
    await refreshRecentDocuments();
  });

  const handleSaveDocument = useEffectEvent(async (forceDialog = false) => {
    const result = await savePunchDocumentFile(
      editor.serializeDocument(),
      documentBaseName,
      forceDialog ? null : documentHandle,
      forceDialog
    );

    if (result.canceled) {
      return;
    }

    setDocumentHandle(result.fileHandle || documentHandle);
    if (result.fileName) {
      setDocumentBaseName(getDocumentBaseName(result.fileName));
    }

    showToast({
      message: `Saved ${result.fileName || `${documentBaseName}.punch`}`,
      type: "success",
    });
    await refreshRecentDocuments();
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
    (recentDocument: PunchRecentDocument) => {
      openRecentPunchDocumentFile(recentDocument)
        .then(async (openedDocument) => {
          if (openedDocument) {
            applyOpenedDocument(openedDocument);
          }

          await refreshRecentDocuments();
        })
        .catch((error) => {
          handleActionError("open", error);
        });
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
        applyOpenedDocument(openedDocument);
        refreshRecentDocuments().catch((error) => {
          handleActionError("open", error);
        });
      });

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

  return {
    openRecentDocumentSafely,
    recentDocuments,
    runDocumentCommandSafely,
  };
};
