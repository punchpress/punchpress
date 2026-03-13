import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const DOCUMENT_BEFORE_CLOSE_CHANNEL = "document:before-close";
const DOCUMENT_CLOSE_RESPONSE_CHANNEL = "document:close-response";
const DOCUMENT_RECENT_DOCUMENTS_CHANGED_CHANNEL =
  "document:recent-documents-changed";
const RENDERER_READY_CHANNEL = "document:renderer-ready";

const appHandlers = new Map<string, (...args: unknown[]) => void>();
const ipcHandlers = new Map<string, (...args: unknown[]) => void>();
const createdWindows: FakeBrowserWindow[] = [];

let appReady = true;
let isDev = false;
let requestSingleInstanceLock = true;
let resolveWhenReady: (() => void) | null = null;
let whenReadyPromise: Promise<void>;

const flushTasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

class FakeBrowserWindow {
  static getAllWindows() {
    return [...createdWindows];
  }

  close = mock(() => undefined);
  focus = mock(() => undefined);
  isMinimized = mock(() => false);
  loadURL = mock(async () => undefined);
  options: Record<string, unknown>;
  restore = mock(() => undefined);
  show = mock(() => undefined);
  webContents = {
    send: mock((_channel: string, _payload?: unknown) => undefined),
    setWindowOpenHandler: mock(
      (_handler: (details: { url: string }) => { action: string }) => undefined
    ),
  };
  private readonly eventHandlers = new Map<
    string,
    ((...args: unknown[]) => void)[]
  >();
  private readonly onceHandlers = new Map<
    string,
    ((...args: unknown[]) => void)[]
  >();

  constructor(options: Record<string, unknown>) {
    this.options = options;
    createdWindows.push(this);
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    const handlers = this.eventHandlers.get(event) ?? [];

    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  once(event: string, handler: (...args: unknown[]) => void) {
    const handlers = this.onceHandlers.get(event) ?? [];

    handlers.push(handler);
    this.onceHandlers.set(event, handlers);
  }

  emit(event: string, ...args: unknown[]) {
    const onceHandlers = this.onceHandlers.get(event) ?? [];
    const handlers = this.eventHandlers.get(event) ?? [];

    this.onceHandlers.delete(event);

    for (const handler of [...onceHandlers, ...handlers]) {
      handler(...args);
    }
  }
}

const appQuitMock = mock(() => undefined);
const appSetNameMock = mock((_name: string) => undefined);
const appSetPathMock = mock((_name: string, _value: string) => undefined);
const buildFromTemplateMock = mock((template: unknown) => ({ template }));
const configurePrivilegedStaticAppSchemeMock = mock(() => undefined);
const fromPartitionMock = mock((_partition: string) => ({ id: "shared" }));
const getAppPathMock = mock(() => "/Applications/PunchPress.app");
const getPathMock = mock((key: string) => {
  if (key === "appData") {
    return "/Users/test/Library/Application Support";
  }

  return "/tmp";
});
const getRecentDocumentsMock = mock(async () => [
  {
    fileName: "alpha.punch",
    filePath: "/tmp/alpha.punch",
    lastOpenedAt: "2026-03-13T12:00:00.000Z",
  },
]);
const ipcOnMock = mock(
  (channel: string, handler: (...args: unknown[]) => void) => {
    ipcHandlers.set(channel, handler);
  }
);
const openDocumentAtPathMock = mock(async (filePath: string) => ({
  contents: `contents:${filePath}`,
  fileHandle: filePath,
  fileName: filePath.split("/").at(-1) || "opened.punch",
}));
const openRecentDocumentMock = mock(async (filePath: string) => ({
  contents: `recent:${filePath}`,
  fileHandle: filePath,
  fileName: filePath.split("/").at(-1) || "opened.punch",
}));
const registerDocumentFileHandlersMock = mock(
  (_options?: { onRecentDocumentsChanged?: () => void }) => undefined
);
const registerLocalFontHandlersMock = mock(() => undefined);
const requestSingleInstanceLockMock = mock(() => requestSingleInstanceLock);
const serveStaticAtMock = mock(async (_path: string) => undefined);
const setApplicationMenuMock = mock((_menu: unknown) => undefined);
const shellOpenExternalMock = mock((_url: string) => undefined);
const startAutoUpdaterMock = mock(() => undefined);
const whenReadyMock = mock(() => whenReadyPromise);

mock.module("electron", () => ({
  app: {
    getAppPath: getAppPathMock,
    getPath: getPathMock,
    isReady: () => appReady,
    on: (event: string, handler: (...args: unknown[]) => void) => {
      appHandlers.set(event, handler);
    },
    quit: appQuitMock,
    requestSingleInstanceLock: requestSingleInstanceLockMock,
    setName: appSetNameMock,
    setPath: appSetPathMock,
    whenReady: whenReadyMock,
  },
  BrowserWindow: FakeBrowserWindow,
  ipcMain: {
    on: ipcOnMock,
  },
  Menu: {
    buildFromTemplate: buildFromTemplateMock,
    setApplicationMenu: setApplicationMenuMock,
  },
  session: {
    fromPartition: fromPartitionMock,
  },
  shell: {
    openExternal: shellOpenExternalMock,
  },
}));

mock.module("./document-files.js", () => ({
  registerDocumentFileHandlers: registerDocumentFileHandlersMock,
}));

mock.module("./helpers/app-updater.js", () => ({
  startAutoUpdater: startAutoUpdaterMock,
}));

mock.module("./helpers/serve-static-app.js", () => ({
  configurePrivilegedStaticAppScheme: configurePrivilegedStaticAppSchemeMock,
  serveStaticAt: serveStaticAtMock,
}));

mock.module("./local-fonts.js", () => ({
  registerLocalFontHandlers: registerLocalFontHandlersMock,
}));

mock.module("./recent-documents.js", () => ({
  clearRecentDocuments: mock(async () => undefined),
  getRecentDocuments: getRecentDocumentsMock,
  openDocumentAtPath: openDocumentAtPathMock,
  openRecentDocument: openRecentDocumentMock,
}));

mock.module("./utils/is-dev.js", () => ({
  isDev,
}));

const createWhenReadyPromise = () => {
  whenReadyPromise = new Promise((resolve) => {
    resolveWhenReady = () => {
      appReady = true;
      resolve();
    };
  });
};

const importDesktopIndex = () => {
  return import(`./index.ts?test=${crypto.randomUUID()}`);
};

describe("desktop index bootstrap", () => {
  const originalArgv = [...process.argv];

  beforeEach(() => {
    appHandlers.clear();
    ipcHandlers.clear();
    createdWindows.splice(0);
    appReady = true;
    isDev = false;
    requestSingleInstanceLock = true;
    createWhenReadyPromise();
    resolveWhenReady?.();

    process.argv = [...originalArgv];

    appQuitMock.mockClear();
    appSetNameMock.mockClear();
    appSetPathMock.mockClear();
    buildFromTemplateMock.mockClear();
    configurePrivilegedStaticAppSchemeMock.mockClear();
    fromPartitionMock.mockClear();
    getAppPathMock.mockClear();
    getPathMock.mockClear();
    getRecentDocumentsMock.mockClear();
    ipcOnMock.mockClear();
    openDocumentAtPathMock.mockClear();
    openRecentDocumentMock.mockClear();
    registerDocumentFileHandlersMock.mockClear();
    registerLocalFontHandlersMock.mockClear();
    requestSingleInstanceLockMock.mockClear();
    serveStaticAtMock.mockClear();
    setApplicationMenuMock.mockClear();
    shellOpenExternalMock.mockClear();
    startAutoUpdaterMock.mockClear();
    whenReadyMock.mockClear();
  });

  afterEach(() => {
    process.argv = [...originalArgv];
  });

  test("queues open-file events before the app is ready and flushes them after the renderer is ready", async () => {
    appReady = false;
    createWhenReadyPromise();

    await importDesktopIndex();

    const openFileHandler = appHandlers.get("open-file");
    const openFileEvent = {
      preventDefault: mock(() => undefined),
    };

    openFileHandler?.(openFileEvent, "/tmp/queued.punch");
    openFileHandler?.(openFileEvent, "/tmp/queued.punch");
    openFileHandler?.(openFileEvent, "/tmp/ignored.txt");

    expect(openFileEvent.preventDefault).toHaveBeenCalledTimes(3);
    expect(openDocumentAtPathMock).not.toHaveBeenCalled();

    resolveWhenReady?.();
    await whenReadyPromise;
    await flushTasks();

    expect(openDocumentAtPathMock).toHaveBeenCalledTimes(1);
    expect(openDocumentAtPathMock).toHaveBeenCalledWith("/tmp/queued.punch");

    const mainWindow = createdWindows[0];

    expect(mainWindow).toBeDefined();

    ipcHandlers.get(RENDERER_READY_CHANNEL)?.({
      sender: mainWindow.webContents,
    });
  });

  test("rebuilds the menu and notifies the renderer when recent documents change", async () => {
    await importDesktopIndex();
    await flushTasks();

    const mainWindow = createdWindows[0];

    ipcHandlers.get(RENDERER_READY_CHANNEL)?.({
      sender: mainWindow.webContents,
    });

    const [{ onRecentDocumentsChanged }] =
      registerDocumentFileHandlersMock.mock.calls[0] ?? [];

    if (!onRecentDocumentsChanged) {
      throw new Error("Expected recent document callback to be registered.");
    }

    const initialMenuBuildCount = buildFromTemplateMock.mock.calls.length;
    onRecentDocumentsChanged();
    await flushTasks();

    expect(buildFromTemplateMock.mock.calls.length).toBeGreaterThan(
      initialMenuBuildCount
    );
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      DOCUMENT_RECENT_DOCUMENTS_CHANGED_CHANNEL
    );
  });

  test("requests renderer close approval and only closes on a matching response", async () => {
    await importDesktopIndex();
    await flushTasks();

    const mainWindow = createdWindows[0];

    ipcHandlers.get(RENDERER_READY_CHANNEL)?.({
      sender: mainWindow.webContents,
    });

    const closeEvent = {
      preventDefault: mock(() => undefined),
    };

    mainWindow.emit("close", closeEvent);

    expect(closeEvent.preventDefault).toHaveBeenCalled();
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      DOCUMENT_BEFORE_CLOSE_CHANNEL,
      1
    );

    const respondToClose = ipcHandlers.get(DOCUMENT_CLOSE_RESPONSE_CHANNEL);

    respondToClose?.(
      {
        sender: {},
      },
      1,
      true
    );
    respondToClose?.(
      {
        sender: mainWindow.webContents,
      },
      999,
      true
    );

    expect(mainWindow.close).not.toHaveBeenCalled();

    respondToClose?.(
      {
        sender: mainWindow.webContents,
      },
      1,
      true
    );

    expect(mainWindow.close).toHaveBeenCalledTimes(1);
  });
});
