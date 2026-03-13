import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
const recentDocumentsChanged = mock(() => undefined);
const clearRecentDocumentsMock = mock(async () => undefined);
const getFocusedWindowMock = mock(() => ({ id: "focused-window" }));
const getAllWindowsMock = mock(() => [{ id: "fallback-window" }]);
const showOpenDialogMock = mock(async () => ({
  canceled: false,
  filePaths: ["/tmp/from-dialog.punch"],
}));
const showSaveDialogMock = mock(async () => ({
  canceled: false,
  filePath: "/tmp/saved-file.punch",
}));
const handleMock = mock(
  (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
    handlers.set(channel, handler);
  }
);
const getPathMock = mock((key: string) =>
  key === "documents" ? "/Users/test/Documents" : "/tmp"
);
const readDocumentAtPathMock = mock(async (filePath: string) => ({
  contents: `loaded:${filePath}`,
  fileHandle: filePath,
  fileName: filePath.split("/").at(-1) || "document.punch",
}));
const rememberRecentDocumentMock = mock((_filePath: string) => undefined);
const openRecentDocumentMock = mock(async (filePath: string) => ({
  contents: `recent:${filePath}`,
  fileHandle: filePath,
  fileName: filePath.split("/").at(-1) || "document.punch",
}));
const getRecentDocumentsMock = mock(async () => [
  {
    fileName: "alpha.punch",
    filePath: "/tmp/alpha.punch",
    lastOpenedAt: "2026-03-12T11:00:00.000Z",
  },
]);

mock.module("electron", () => ({
  BrowserWindow: {
    getAllWindows: getAllWindowsMock,
    getFocusedWindow: getFocusedWindowMock,
  },
  app: {
    getPath: getPathMock,
  },
  dialog: {
    showOpenDialog: showOpenDialogMock,
    showSaveDialog: showSaveDialogMock,
  },
  ipcMain: {
    handle: handleMock,
  },
}));

mock.module("./recent-documents.js", () => ({
  clearRecentDocuments: clearRecentDocumentsMock,
  getRecentDocuments: getRecentDocumentsMock,
  openRecentDocument: openRecentDocumentMock,
  readDocumentAtPath: readDocumentAtPathMock,
  rememberRecentDocument: rememberRecentDocumentMock,
}));

const importDocumentFiles = () => {
  return import(`./document-files.ts?test=${crypto.randomUUID()}`);
};

const createTempDir = () =>
  mkdtemp(path.join(os.tmpdir(), "punchpress-doc-files-"));

describe("registerDocumentFileHandlers", () => {
  let tempDir = "";

  beforeEach(() => {
    handlers.clear();
    recentDocumentsChanged.mockClear();
    getFocusedWindowMock.mockClear();
    getAllWindowsMock.mockClear();
    showOpenDialogMock.mockClear();
    showSaveDialogMock.mockClear();
    handleMock.mockClear();
    getPathMock.mockClear();
    clearRecentDocumentsMock.mockClear();
    readDocumentAtPathMock.mockClear();
    rememberRecentDocumentMock.mockClear();
    openRecentDocumentMock.mockClear();
    getRecentDocumentsMock.mockClear();
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true });
      tempDir = "";
    }
  });

  test("registers the file IPC handlers and opens documents through Electron", async () => {
    const { registerDocumentFileHandlers } = await importDocumentFiles();
    registerDocumentFileHandlers({
      onRecentDocumentsChanged: recentDocumentsChanged,
    });

    expect([...handlers.keys()].sort()).toEqual([
      "document:clear-recent-documents",
      "document:get-recent-documents",
      "document:open",
      "document:open-recent",
      "document:save",
      "document:save-svg",
    ]);

    const openedDocument = await handlers.get("document:open")?.();

    expect(showOpenDialogMock).toHaveBeenCalledWith(
      { id: "focused-window" },
      expect.objectContaining({
        properties: ["openFile"],
      })
    );
    expect(readDocumentAtPathMock).toHaveBeenCalledWith(
      "/tmp/from-dialog.punch"
    );
    expect(rememberRecentDocumentMock).toHaveBeenCalledWith(
      "/tmp/from-dialog.punch"
    );
    expect(recentDocumentsChanged).toHaveBeenCalledTimes(1);
    expect(openedDocument).toEqual({
      contents: "loaded:/tmp/from-dialog.punch",
      fileHandle: "/tmp/from-dialog.punch",
      fileName: "from-dialog.punch",
    });
  });

  test("refreshes recent documents after open-recent even when nothing is returned", async () => {
    openRecentDocumentMock.mockImplementationOnce(async () => null);

    const { registerDocumentFileHandlers } = await importDocumentFiles();
    registerDocumentFileHandlers({
      onRecentDocumentsChanged: recentDocumentsChanged,
    });

    const openedDocument = await handlers.get("document:open-recent")?.(
      {},
      "/tmp/missing.punch"
    );

    expect(openRecentDocumentMock).toHaveBeenCalledWith("/tmp/missing.punch");
    expect(recentDocumentsChanged).toHaveBeenCalledTimes(1);
    expect(openedDocument).toBeNull();
  });

  test("saves to an existing file handle without prompting and refreshes recents", async () => {
    tempDir = await createTempDir();
    const existingFilePath = path.join(tempDir, "existing.punch");
    const { registerDocumentFileHandlers } = await importDocumentFiles();
    registerDocumentFileHandlers({
      onRecentDocumentsChanged: recentDocumentsChanged,
    });

    const result = await handlers.get("document:save")?.(
      {},
      {
        contents: "next document",
        defaultFileName: "ignored-default.punch",
        fileHandle: existingFilePath,
      }
    );
    const savedContents = await readFile(existingFilePath, "utf8");

    expect(showSaveDialogMock).not.toHaveBeenCalled();
    expect(savedContents).toBe("next document");
    expect(rememberRecentDocumentMock).toHaveBeenCalledWith(existingFilePath);
    expect(recentDocumentsChanged).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      canceled: false,
      fileHandle: existingFilePath,
      fileName: "existing.punch",
    });
  });

  test("returns recent documents through the IPC channel", async () => {
    const { registerDocumentFileHandlers } = await importDocumentFiles();
    registerDocumentFileHandlers();

    const result = await handlers.get("document:get-recent-documents")?.();

    expect(getRecentDocumentsMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        fileName: "alpha.punch",
        filePath: "/tmp/alpha.punch",
        lastOpenedAt: "2026-03-12T11:00:00.000Z",
      },
    ]);
  });

  test("clears recent documents through the IPC channel", async () => {
    const { registerDocumentFileHandlers } = await importDocumentFiles();
    registerDocumentFileHandlers({
      onRecentDocumentsChanged: recentDocumentsChanged,
    });

    await handlers.get("document:clear-recent-documents")?.();

    expect(clearRecentDocumentsMock).toHaveBeenCalledTimes(1);
    expect(recentDocumentsChanged).toHaveBeenCalledTimes(1);
  });

  test("uses the current document directory for save as prompts", async () => {
    tempDir = await createTempDir();
    const { registerDocumentFileHandlers } = await importDocumentFiles();
    registerDocumentFileHandlers();

    await handlers.get("document:save")?.(
      {},
      {
        contents: "next document",
        defaultFileName: "save-as-target.punch",
        directoryPath: path.join(tempDir, "existing.punch"),
        fileHandle: null,
      }
    );

    expect(showSaveDialogMock).toHaveBeenCalledWith(
      { id: "focused-window" },
      expect.objectContaining({
        defaultPath: path.join(tempDir, "save-as-target.punch"),
      })
    );
  });
});
