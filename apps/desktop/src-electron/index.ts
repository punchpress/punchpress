import path from "node:path";
import {
  app,
  BrowserWindow,
  Menu,
  shell,
  session,
  type MenuItemConstructorOptions,
} from "electron";
import { registerDocumentFileHandlers } from "./document-files.js";
import { configurePrivilegedStaticAppScheme, serveStaticAt } from "./helpers/serve-static-app.js";
import { isDev } from "./utils/is-dev.js";

const defaultWindowSize = {
  width: 1440,
  height: 960,
  minWidth: 1120,
  minHeight: 760,
};

let mainWindow: BrowserWindow | null = null;

app.setName("PunchPress");
app.setPath(
  "userData",
  path.join(app.getPath("appData"), "build.punchpress.desktop"),
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

const installApplicationMenu = () => {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "PunchPress",
      submenu: [
        { role: "about" },
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
        { role: "undo" },
        { role: "redo" },
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

  mainWindow = new BrowserWindow({
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
      x: 14,
      y: 12,
    },
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.mjs"),
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      session: sharedSession,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (isDev) {
    void mainWindow.loadURL(getRendererDevUrl());
    return;
  }

  void mainWindow.loadURL("app://static/index.html");
};

const launch = async () => {
  await app.whenReady();
  installApplicationMenu();
  registerDocumentFileHandlers();

  if (!isDev) {
    await serveStaticAt(path.join(app.getAppPath(), "dist"));
  }

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
};

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

void launch();
