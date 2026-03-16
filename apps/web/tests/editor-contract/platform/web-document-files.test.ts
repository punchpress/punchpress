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
      '{"version":"1.1","nodes":[]}',
      "renamed-design",
      "/tmp/original-folder/original-design.punch",
      true
    );

    expect(saveDocumentMock).toHaveBeenCalledWith({
      contents: '{"version":"1.1","nodes":[]}',
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
