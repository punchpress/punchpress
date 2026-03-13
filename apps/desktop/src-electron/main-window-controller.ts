import path from "node:path";
import { BrowserWindow, session, shell } from "electron";
import {
  DOCUMENT_BEFORE_CLOSE_CHANNEL,
  DOCUMENT_OPENED_CHANNEL,
  DOCUMENT_RECENT_DOCUMENTS_CHANGED_CHANNEL,
} from "./desktop-channels.js";
import type { DesktopOpenedDocument } from "./recent-documents.js";
import { isDev } from "./utils/is-dev.js";

const defaultWindowSize = {
  width: 1440,
  height: 960,
  minWidth: 1120,
  minHeight: 760,
};

const getRendererDevUrl = () => {
  return process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5273";
};

export const createMainWindowController = () => {
  let mainWindow: BrowserWindow | null = null;
  let isMainWindowCloseApproved = false;
  let isMainWindowRendererReady = false;
  let nextCloseRequestId = 0;
  let pendingCloseRequestId: number | null = null;

  const sendToRenderer = (channel: string, payload?: unknown) => {
    if (payload === undefined) {
      mainWindow?.webContents.send(channel);
      return;
    }

    mainWindow?.webContents.send(channel, payload);
  };

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

  const requestRendererCloseApproval = () => {
    if (
      !(mainWindow && isMainWindowRendererReady) ||
      pendingCloseRequestId !== null
    ) {
      return false;
    }

    nextCloseRequestId += 1;
    pendingCloseRequestId = nextCloseRequestId;
    mainWindow.webContents.send(
      DOCUMENT_BEFORE_CLOSE_CHANNEL,
      nextCloseRequestId
    );
    return true;
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
      isMainWindowCloseApproved = false;
      isMainWindowRendererReady = false;
      pendingCloseRequestId = null;
    });

    nextWindow.on("close", (event) => {
      if (nextWindow !== mainWindow || isMainWindowCloseApproved) {
        isMainWindowCloseApproved = false;
        return;
      }

      if (isDev) {
        return;
      }

      if (pendingCloseRequestId !== null) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      if (!requestRendererCloseApproval()) {
        isMainWindowCloseApproved = true;
        nextWindow.close();
      }
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

  const handleCloseResponse = (
    event: Electron.IpcMainEvent,
    requestId: number,
    shouldClose: boolean
  ) => {
    if (
      mainWindow?.webContents !== event.sender ||
      requestId !== pendingCloseRequestId
    ) {
      return;
    }

    pendingCloseRequestId = null;

    if (!(shouldClose && mainWindow)) {
      return;
    }

    isMainWindowCloseApproved = true;
    mainWindow.close();
  };

  const handleRendererReady = (sender: Electron.WebContents) => {
    if (mainWindow?.webContents !== sender) {
      return false;
    }

    isMainWindowRendererReady = true;
    return true;
  };

  const sendOpenedDocument = (openedDocument: DesktopOpenedDocument) => {
    sendToRenderer(DOCUMENT_OPENED_CHANNEL, openedDocument);
  };

  const sendRecentDocumentsChanged = () => {
    sendToRenderer(DOCUMENT_RECENT_DOCUMENTS_CHANGED_CHANNEL);
  };

  return {
    createMainWindow,
    ensureMainWindow,
    focusMainWindow,
    getMainWindow: () => mainWindow,
    handleCloseResponse,
    handleRendererReady,
    isRendererReady: () => isMainWindowRendererReady,
    sendOpenedDocument,
    sendRecentDocumentsChanged,
    sendToRenderer,
  };
};
