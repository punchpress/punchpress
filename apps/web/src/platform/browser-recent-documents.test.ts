import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const RECENT_DOCUMENTS_KEY = "punchpress:recent-documents";

class TestFileSystemFileHandle {
  contents: string;
  identity: string;
  name: string;
  permissionState: PermissionState;
  requestPermissionState: PermissionState;
  throwOnCompare: boolean;
  throwOnQuery: boolean;

  constructor(
    name: string,
    {
      contents = "",
      identity = name,
      permissionState = "granted",
      requestPermissionState = permissionState,
      throwOnCompare = false,
      throwOnQuery = false,
    }: {
      contents?: string;
      identity?: string;
      permissionState?: PermissionState;
      requestPermissionState?: PermissionState;
      throwOnCompare?: boolean;
      throwOnQuery?: boolean;
    } = {}
  ) {
    this.contents = contents;
    this.identity = identity;
    this.name = name;
    this.permissionState = permissionState;
    this.requestPermissionState = requestPermissionState;
    this.throwOnCompare = throwOnCompare;
    this.throwOnQuery = throwOnQuery;
  }

  getFile() {
    return {
      text: async () => this.contents,
    };
  }

  isSameEntry(otherHandle: TestFileSystemFileHandle) {
    if (this.throwOnCompare) {
      throw new DOMException("Revoked handle", "NotAllowedError");
    }

    return this.identity === otherHandle.identity;
  }

  queryPermission() {
    if (this.throwOnQuery) {
      throw new DOMException("Revoked handle", "NotAllowedError");
    }

    return this.permissionState;
  }

  requestPermission() {
    this.permissionState = this.requestPermissionState;
    return this.requestPermissionState;
  }
}

const recentDocumentStore = new Map<string, unknown>();
const getMock = mock((key: string) => recentDocumentStore.get(key));
const setMock = mock((key: string, value: unknown) => {
  recentDocumentStore.set(key, value);
});

mock.module("idb-keyval", () => ({
  get: getMock,
  set: setMock,
}));

const importBrowserRecentDocuments = () => {
  return import(`./browser-recent-documents.ts?test=${crypto.randomUUID()}`);
};

const setBrowserSupport = () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { indexedDB: {} },
  });
  Object.defineProperty(globalThis, "FileSystemFileHandle", {
    configurable: true,
    value: TestFileSystemFileHandle,
  });
};

describe("browser recent documents", () => {
  beforeEach(() => {
    recentDocumentStore.clear();
    getMock.mockClear();
    setMock.mockClear();
    setBrowserSupport();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "FileSystemFileHandle");
  });

  test("persists retained documents after removing duplicates and denied handles", async () => {
    const primaryHandle = new TestFileSystemFileHandle("poster-a.punch", {
      identity: "poster-a",
    });
    const duplicateHandle = new TestFileSystemFileHandle(
      "poster-a-copy.punch",
      {
        identity: "poster-a",
      }
    );
    const deniedHandle = new TestFileSystemFileHandle("poster-b.punch", {
      identity: "poster-b",
      permissionState: "denied",
    });

    recentDocumentStore.set(RECENT_DOCUMENTS_KEY, [
      {
        fileHandle: deniedHandle,
        fileName: "poster-b.punch",
        id: "denied",
        lastOpenedAt: "2026-03-11T12:00:00.000Z",
      },
      {
        fileHandle: duplicateHandle,
        fileName: "poster-a-copy.punch",
        id: "duplicate",
        lastOpenedAt: "2026-03-10T12:00:00.000Z",
      },
      {
        fileHandle: primaryHandle,
        fileName: "poster-a.punch",
        id: "primary",
        lastOpenedAt: "2026-03-12T12:00:00.000Z",
      },
    ]);

    const { getBrowserRecentDocuments } = await importBrowserRecentDocuments();
    const recentDocuments = await getBrowserRecentDocuments();

    expect(recentDocuments).toHaveLength(1);
    expect(recentDocuments[0]).toMatchObject({
      fileName: "poster-a.punch",
      id: "primary",
    });
    expect(setMock).toHaveBeenCalledTimes(1);
    expect(recentDocumentStore.get(RECENT_DOCUMENTS_KEY)).toEqual(
      recentDocuments
    );
  });

  test("returns null when a prompted handle stays denied", async () => {
    const fileHandle = new TestFileSystemFileHandle("locked.punch", {
      permissionState: "prompt",
      requestPermissionState: "denied",
    });

    const { openBrowserRecentDocument } = await importBrowserRecentDocuments();
    const openedDocument = await openBrowserRecentDocument(
      fileHandle as FileSystemFileHandle,
      "locked.punch"
    );

    expect(openedDocument).toBeNull();
    expect(setMock).not.toHaveBeenCalled();
  });

  test("reopens a prompted handle and refreshes recent documents when access is granted", async () => {
    const fileHandle = new TestFileSystemFileHandle("granted.punch", {
      contents: '{"version":"1.0"}',
      permissionState: "prompt",
      requestPermissionState: "granted",
    });

    const { openBrowserRecentDocument } = await importBrowserRecentDocuments();
    const openedDocument = await openBrowserRecentDocument(
      fileHandle as FileSystemFileHandle,
      ""
    );

    expect(openedDocument).toEqual({
      contents: '{"version":"1.0"}',
      fileHandle,
      fileName: "granted.punch",
    });
    expect(setMock).toHaveBeenCalledTimes(1);
    expect(recentDocumentStore.get(RECENT_DOCUMENTS_KEY)).toEqual([
      expect.objectContaining({
        fileHandle,
        fileName: "granted.punch",
      }),
    ]);
  });

  test("clears persisted recent documents", async () => {
    recentDocumentStore.set(RECENT_DOCUMENTS_KEY, [
      {
        fileHandle: new TestFileSystemFileHandle("clear-me.punch"),
        fileName: "clear-me.punch",
        id: "clear-me",
        lastOpenedAt: "2026-03-13T12:00:00.000Z",
      },
    ]);

    const { clearBrowserRecentDocuments } =
      await importBrowserRecentDocuments();
    const clearedRecentDocuments = await clearBrowserRecentDocuments();

    expect(clearedRecentDocuments).toEqual([]);
    expect(recentDocumentStore.get(RECENT_DOCUMENTS_KEY)).toEqual([]);
  });
});
