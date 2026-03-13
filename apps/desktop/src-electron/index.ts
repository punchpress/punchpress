import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { installApplicationMenu } from "./application-menu.js";
import {
  DOCUMENT_CLOSE_RESPONSE_CHANNEL,
  DOCUMENT_COMMAND_CHANNEL,
  EDITOR_COMMAND_CHANNEL,
  RENDERER_READY_CHANNEL,
} from "./desktop-channels.js";
import { registerDocumentFileHandlers } from "./document-files.js";
import {
  createDocumentOpeningController,
  extractOpenDocumentPathsFromArgv,
} from "./document-opening.js";
import { startAutoUpdater } from "./helpers/app-updater.js";
import {
  configurePrivilegedStaticAppScheme,
  serveStaticAt,
} from "./helpers/serve-static-app.js";
import { registerLocalFontHandlers } from "./local-fonts.js";
import { createMainWindowController } from "./main-window-controller.js";
import { isDev } from "./utils/is-dev.js";

app.setName("PunchPress");
app.setPath(
  "userData",
  path.join(app.getPath("appData"), "build.punchpress.desktop")
);

configurePrivilegedStaticAppScheme();

const mainWindowController = createMainWindowController();

let documentOpeningController: ReturnType<
  typeof createDocumentOpeningController
>;

const sendDocumentCommand = (
  command: "export" | "new" | "open" | "save" | "save-as"
) => {
  mainWindowController.sendToRenderer(DOCUMENT_COMMAND_CHANNEL, command);
};

const sendEditorCommand = (command: "redo" | "undo") => {
  mainWindowController.sendToRenderer(EDITOR_COMMAND_CHANNEL, command);
};

const syncApplicationMenu = () => {
  return installApplicationMenu({
    clearRecentDocumentsFromMenu: () => {
      return documentOpeningController.clearRecentDocumentsFromMenu();
    },
    openRecentDocumentFromMenu: (filePath) => {
      return documentOpeningController.openRecentDocumentFromMenu(filePath);
    },
    sendDocumentCommand,
    sendEditorCommand,
  });
};

documentOpeningController = createDocumentOpeningController({
  emitOpenedDocument: (openedDocument) => {
    mainWindowController.sendOpenedDocument(openedDocument);
  },
  emitRecentDocumentsChanged: () => {
    mainWindowController.sendRecentDocumentsChanged();
  },
  ensureMainWindow: () => {
    mainWindowController.ensureMainWindow();
  },
  focusMainWindow: () => {
    mainWindowController.focusMainWindow();
  },
  initialOpenDocumentPaths: extractOpenDocumentPathsFromArgv(process.argv),
  installApplicationMenu: syncApplicationMenu,
  isAppReady: () => app.isReady(),
  isRendererReady: () => mainWindowController.isRendererReady(),
});

const launch = async () => {
  await app.whenReady();
  await syncApplicationMenu();

  ipcMain.on(
    DOCUMENT_CLOSE_RESPONSE_CHANNEL,
    (event, requestId, shouldClose) => {
      mainWindowController.handleCloseResponse(event, requestId, shouldClose);
    }
  );

  ipcMain.on(RENDERER_READY_CHANNEL, (event) => {
    if (!mainWindowController.handleRendererReady(event.sender)) {
      return;
    }

    documentOpeningController.flushPendingOpenedDocuments();
  });

  registerDocumentFileHandlers({
    onRecentDocumentsChanged: () => {
      syncApplicationMenu().catch((error) => {
        console.error(error);
      });
      documentOpeningController.notifyRecentDocumentsChanged();
    },
  });
  registerLocalFontHandlers();

  if (!isDev) {
    await serveStaticAt(path.join(app.getAppPath(), "dist"));
  }

  mainWindowController.createMainWindow();
  startAutoUpdater();
  await documentOpeningController.flushPendingOpenDocumentPaths();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindowController.createMainWindow();
      return;
    }

    mainWindowController.focusMainWindow();
  });
};

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

if (app.requestSingleInstanceLock()) {
  app.on("second-instance", (_event, argv) => {
    for (const filePath of extractOpenDocumentPathsFromArgv(argv)) {
      documentOpeningController.enqueueOpenDocumentPath(filePath);
    }

    if (!app.isReady()) {
      return;
    }

    mainWindowController.ensureMainWindow();
    mainWindowController.focusMainWindow();
  });

  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    documentOpeningController.enqueueOpenDocumentPath(filePath);
  });

  launch().catch((error) => {
    console.error(error);
    app.quit();
  });
} else {
  app.quit();
}
