import path from "node:path";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
  session,
  shell,
} from "electron";
import { registerDocumentFileHandlers } from "./document-files.js";
import {
  configurePrivilegedStaticAppScheme,
  serveStaticAt,
} from "./helpers/serve-static-app.js";
import {
  type DesktopOpenedDocument,
  getRecentDocuments,
  openDocumentAtPath,
  openRecentDocument,
} from "./recent-documents.js";
import { startAutoUpdater } from "./helpers/app-updater.js";
import { isDev } from "./utils/is-dev.js";

const defaultWindowSize = {
  width: 1440,
  height: 960,
  minWidth: 1120,
  minHeight: 760,
};

const DOCUMENT_OPENED_CHANNEL = "document:open-file";
const RENDERER_READY_CHANNEL = "document:renderer-ready";
const PUNCH_DOCUMENT_EXTENSION = ".punch";

let mainWindow: BrowserWindow | null = null;
let isMainWindowRendererReady = false;
let isFlushingPendingOpenDocumentPaths = false;

app.setName("PunchPress");
app.setPath(
  "userData",
  path.join(app.getPath("appData"), "build.punchpress.desktop")
);

configurePrivilegedStaticAppScheme();

const getRendererDevUrl = () => {
  return process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5273";
};

const sendDocumentCommand = (
  command: "export" | "open" | "save" | "save-as"
) => {
  mainWindow?.webContents.send("document:command", command);
};

const sendEditorCommand = (command: "redo" | "undo") => {
  mainWindow?.webContents.send("editor:command", command);
};

const sendOpenedDocument = (openedDocument: DesktopOpenedDocument) => {
  if (!(mainWindow && isMainWindowRendererReady)) {
    pendingOpenedDocuments.push(openedDocument);
    return;
  }

  mainWindow.webContents.send(DOCUMENT_OPENED_CHANNEL, openedDocument);
};

const openRecentDocumentFromMenu = async (filePath: string) => {
  const openedDocument = await openRecentDocument(filePath);

  await installApplicationMenu();

  if (!openedDocument) {
    return;
  }

  sendOpenedDocument(openedDocument);
};

const normalizeOpenDocumentPath = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0 || trimmedValue.startsWith("-")) {
    return null;
  }

  const resolvedFilePath = path.resolve(trimmedValue);

  return path.extname(resolvedFilePath).toLowerCase() ===
    PUNCH_DOCUMENT_EXTENSION
    ? resolvedFilePath
    : null;
};

const extractOpenDocumentPathsFromArgv = (argv: string[]) => {
  const filePaths = argv
    .map(normalizeOpenDocumentPath)
    .filter((filePath): filePath is string => Boolean(filePath));

  return [...new Set(filePaths)];
};

const pendingOpenDocumentPaths = extractOpenDocumentPathsFromArgv(process.argv);
const pendingOpenedDocuments: DesktopOpenedDocument[] = [];

const focusMainWindow = () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
};

const flushPendingOpenedDocuments = () => {
  if (!(mainWindow && isMainWindowRendererReady)) {
    return;
  }

  const openedDocumentsToSend = pendingOpenedDocuments.splice(0);

  for (const openedDocument of openedDocumentsToSend) {
    mainWindow.webContents.send(DOCUMENT_OPENED_CHANNEL, openedDocument);
  }
};

const openDocumentFromPath = async (filePath: string) => {
  const openedDocument = await openDocumentAtPath(filePath);

  await installApplicationMenu();

  if (!openedDocument) {
    return;
  }

  sendOpenedDocument(openedDocument);
};

const flushPendingOpenDocumentPaths = async () => {
  if (
    !app.isReady() ||
    isFlushingPendingOpenDocumentPaths ||
    pendingOpenDocumentPaths.length === 0
  ) {
    return;
  }

  isFlushingPendingOpenDocumentPaths = true;

  try {
    while (pendingOpenDocumentPaths.length > 0) {
      const filePath = pendingOpenDocumentPaths.shift();

      if (!filePath) {
        continue;
      }

      try {
        await openDocumentFromPath(filePath);
      } catch (error) {
        console.error(`Failed to open document at ${filePath}`, error);
      }
    }
  } finally {
    isFlushingPendingOpenDocumentPaths = false;
    flushPendingOpenedDocuments();
  }
};

const buildOpenRecentSubmenu = async (): Promise<
  MenuItemConstructorOptions[]
> => {
  const recentDocuments = await getRecentDocuments();

  if (recentDocuments.length === 0) {
    return [
      {
        enabled: false,
        label: "No Recent Documents",
      },
    ];
  }

  return recentDocuments.map((recentDocument) => ({
    click: () => {
      openRecentDocumentFromMenu(recentDocument.filePath).catch((error) => {
        console.error(error);
      });
    },
    label: recentDocument.fileName,
  }));
};

const installApplicationMenu = async () => {
  const openRecentSubmenu = await buildOpenRecentSubmenu();
  const template: MenuItemConstructorOptions[] = [
    {
      label: "PunchPress",
      submenu: [
        { role: "about" },
        {
          label: "Open Recent",
          submenu: openRecentSubmenu,
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "showAll" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          accelerator: "CmdOrCtrl+O",
          click: () => sendDocumentCommand("open"),
          label: "Open...",
        },
        {
          accelerator: "CmdOrCtrl+S",
          click: () => sendDocumentCommand("save"),
          label: "Save",
        },
        {
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendDocumentCommand("save-as"),
          label: "Save As...",
        },
        {
          accelerator: "CmdOrCtrl+E",
          click: () => sendDocumentCommand("export"),
          label: "Export SVG...",
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          accelerator: "CmdOrCtrl+Z",
          click: () => sendEditorCommand("undo"),
          label: "Undo",
        },
        {
          accelerator: "CmdOrCtrl+Shift+Z",
          click: () => sendEditorCommand("redo"),
          label: "Redo",
        },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "bringAllToFront" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

const createMainWindow = () => {
  const sharedSession = session.fromPartition("persist:shared-session");

  const nextWindow = new BrowserWindow({
    show: false,
    width: defaultWindowSize.width,
    height: defaultWindowSize.height,
    minWidth: defaultWindowSize.minWidth,
    minHeight: defaultWindowSize.minHeight,
    title: "PunchPress",
    titleBarStyle: "hiddenInset",
    frame: false,
    transparent: true,
    trafficLightPosition: {
      x: 18,
      y: 16,
    },
    webPreferences: {
      preload: path.join(import.meta.dirname, "../preload/preload.mjs"),
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      session: sharedSession,
    },
  });
  isMainWindowRendererReady = false;
  mainWindow = nextWindow;

  nextWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  nextWindow.once("ready-to-show", () => {
    nextWindow.show();
  });

  nextWindow.on("closed", () => {
    mainWindow = null;
    isMainWindowRendererReady = false;
  });

  if (isDev) {
    nextWindow.loadURL(getRendererDevUrl()).catch((error) => {
      console.error(error);
    });
    return nextWindow;
  }

  nextWindow.loadURL("app://static/index.html").catch((error) => {
    console.error(error);
  });
  return nextWindow;
};

const ensureMainWindow = () => {
  return mainWindow || createMainWindow();
};

const enqueueOpenDocumentPath = (filePath: string) => {
  const normalizedFilePath = normalizeOpenDocumentPath(filePath);

  if (!normalizedFilePath) {
    return;
  }

  const existingIndex = pendingOpenDocumentPaths.indexOf(normalizedFilePath);

  if (existingIndex >= 0) {
    pendingOpenDocumentPaths.splice(existingIndex, 1);
  }

  pendingOpenDocumentPaths.push(normalizedFilePath);

  if (!app.isReady()) {
    return;
  }

  ensureMainWindow();
  focusMainWindow();
  flushPendingOpenDocumentPaths().catch((error) => {
    console.error(error);
  });
};

const launch = async () => {
  await app.whenReady();
  await installApplicationMenu();
  ipcMain.on(RENDERER_READY_CHANNEL, (event) => {
    if (mainWindow?.webContents !== event.sender) {
      return;
    }

    isMainWindowRendererReady = true;
    flushPendingOpenedDocuments();
  });
  registerDocumentFileHandlers({
    onRecentDocumentsChanged: () => {
      installApplicationMenu().catch((error) => {
        console.error(error);
      });
    },
  });

  if (!isDev) {
    await serveStaticAt(path.join(app.getAppPath(), "dist"));
  }

  createMainWindow();
  startAutoUpdater();
  await flushPendingOpenDocumentPaths();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      return;
    }

    focusMainWindow();
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
      enqueueOpenDocumentPath(filePath);
    }

    if (!app.isReady()) {
      return;
    }

    ensureMainWindow();
    focusMainWindow();
  });

  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    enqueueOpenDocumentPath(filePath);
  });

  launch().catch((error) => {
    console.error(error);
    app.quit();
  });
} else {
  app.quit();
}
