import { afterEach, describe, expect, mock, test } from "bun:test";

const fileOpenMock = mock(() => {
  throw new Error("fileOpen should not be called in desktop tests.");
});
const fileSaveMock = mock(() => {
  throw new Error("fileSave should not be called in desktop tests.");
});

mock.module("browser-fs-access", () => ({
  fileOpen: fileOpenMock,
  fileSave: fileSaveMock,
}));

const restoreWindow = () => {
  Reflect.deleteProperty(globalThis, "window");
};

const importWebDocumentFiles = () => {
  return import(
    `../../../src/platform/web-document-files.ts?test=${crypto.randomUUID()}`
  );
};

afterEach(() => {
  fileOpenMock.mockClear();
  fileSaveMock.mockClear();
  restoreWindow();
});

describe("savePunchDocumentFile", () => {
  test("keeps the current desktop file path as save-as dialog context", async () => {
    const saveDocumentMock = mock(async () => ({
      canceled: false,
      fileHandle: "/tmp/renamed-design.punch",
      fileName: "renamed-design.punch",
    }));

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        electron: {
          documentFiles: {
            saveDocument: saveDocumentMock,
          },
        },
      },
    });

    const { savePunchDocumentFile } = await importWebDocumentFiles();
    const result = await savePunchDocumentFile(
      '{"version":"1.6","nodes":[]}',
      "renamed-design",
      "/tmp/original-folder/original-design.punch",
      true
    );

    expect(saveDocumentMock).toHaveBeenCalledWith({
      contents: '{"version":"1.6","nodes":[]}',
      defaultFileName: "renamed-design.punch",
      directoryPath: "/tmp/original-folder/original-design.punch",
      fileHandle: null,
    });
    expect(fileSaveMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      canceled: false,
      fileHandle: "/tmp/renamed-design.punch",
      fileName: "renamed-design.punch",
    });
  });
});

describe("getDocumentBaseName", () => {
  test("strips svg extensions when deriving the document name", async () => {
    const { getDocumentBaseName } = await importWebDocumentFiles();

    expect(getDocumentBaseName("imported-art.svg")).toBe("imported-art");
  });
});

describe("openPunchDocumentFile", () => {
  test("opens punch documents through the browser open dialog", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });
    fileOpenMock.mockResolvedValueOnce({
      handle: {
        kind: "file",
        name: "design.punch",
      },
      name: "design.punch",
      text: async () => '{"version":"1.6","nodes":[]}',
    });

    const { openPunchDocumentFile } = await importWebDocumentFiles();
    const result = await openPunchDocumentFile();

    expect(fileOpenMock).toHaveBeenCalledWith({
      description: "PunchPress document",
      excludeAcceptAllOption: true,
      extensions: [".punch"],
      mimeTypes: ["application/vnd.punchpress+json"],
    });
    expect(result).toEqual({
      contents: '{"version":"1.6","nodes":[]}',
      fileHandle: {
        kind: "file",
        name: "design.punch",
      },
      fileName: "design.punch",
    });
  });
});

describe("openSvgImportFile", () => {
  test("opens svg artwork through the browser import dialog", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });
    fileOpenMock.mockResolvedValueOnce({
      handle: {
        kind: "file",
        name: "imported-art.svg",
      },
      name: "imported-art.svg",
      text: async () => "<svg></svg>",
    });

    const { openSvgImportFile } = await importWebDocumentFiles();
    const result = await openSvgImportFile();

    expect(fileOpenMock).toHaveBeenCalledWith({
      description: "SVG artwork",
      excludeAcceptAllOption: true,
      extensions: [".svg"],
      mimeTypes: ["image/svg+xml"],
    });
    expect(result).toEqual({
      contents: "<svg></svg>",
      fileHandle: {
        kind: "file",
        name: "imported-art.svg",
      },
      fileName: "imported-art.svg",
    });
  });
});
