import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const clearRecentDocumentsMock = mock(() => undefined);
const addRecentDocumentMock = mock((_filePath: string) => undefined);

let userDataPath = "";

mock.module("electron", () => ({
  app: {
    addRecentDocument: addRecentDocumentMock,
    clearRecentDocuments: clearRecentDocumentsMock,
    getPath: (key: string) => {
      if (key === "userData") {
        return userDataPath;
      }

      return "/tmp";
    },
  },
}));

const importRecentDocuments = () => {
  return import(`./recent-documents.ts?test=${crypto.randomUUID()}`);
};

const createTempDir = () =>
  mkdtemp(path.join(os.tmpdir(), "punchpress-recents-"));

describe("desktop recent documents", () => {
  afterEach(async () => {
    clearRecentDocumentsMock.mockClear();
    addRecentDocumentMock.mockClear();

    if (userDataPath) {
      await rm(userDataPath, { force: true, recursive: true });
      userDataPath = "";
    }
  });

  test("prunes unavailable documents and persists the cleaned list", async () => {
    userDataPath = await createTempDir();

    const existingFilePath = path.join(userDataPath, "existing.punch");
    const missingFilePath = path.join(userDataPath, "missing.punch");
    await writeFile(existingFilePath, "existing contents", "utf8");
    await writeFile(missingFilePath, "temporary contents", "utf8");

    const { getRecentDocuments, rememberRecentDocument } =
      await importRecentDocuments();
    await rememberRecentDocument(missingFilePath);
    await rememberRecentDocument(existingFilePath);
    await rm(missingFilePath);

    const recentDocuments = await getRecentDocuments();
    const storagePath = path.join(userDataPath, "recent-documents.json");
    const persistedRecentDocuments = JSON.parse(
      await readFile(storagePath, "utf8")
    );

    expect(recentDocuments).toEqual([
      expect.objectContaining({
        fileName: "existing.punch",
        filePath: existingFilePath,
      }),
    ]);
    expect(persistedRecentDocuments).toEqual(recentDocuments);
    expect(clearRecentDocumentsMock).toHaveBeenCalled();
    expect(addRecentDocumentMock).toHaveBeenLastCalledWith(existingFilePath);
  });

  test("removes a missing recent document when it is reopened", async () => {
    userDataPath = await createTempDir();

    const missingFilePath = path.join(userDataPath, "missing-open.punch");
    await writeFile(missingFilePath, "temporary contents", "utf8");

    const { getRecentDocuments, openRecentDocument, rememberRecentDocument } =
      await importRecentDocuments();
    await rememberRecentDocument(missingFilePath);
    await rm(missingFilePath);

    const openedDocument = await openRecentDocument(missingFilePath);
    const remainingRecentDocuments = await getRecentDocuments();

    expect(openedDocument).toBeNull();
    expect(remainingRecentDocuments).toEqual([]);
  });

  test("clears persisted recent documents", async () => {
    userDataPath = await createTempDir();

    const existingFilePath = path.join(userDataPath, "existing-clear.punch");
    await writeFile(existingFilePath, "existing contents", "utf8");

    const { clearRecentDocuments, getRecentDocuments, rememberRecentDocument } =
      await importRecentDocuments();
    await rememberRecentDocument(existingFilePath);
    clearRecentDocumentsMock.mockClear();
    addRecentDocumentMock.mockClear();
    await clearRecentDocuments();

    expect(await getRecentDocuments()).toEqual([]);
    expect(clearRecentDocumentsMock).toHaveBeenCalled();
    expect(addRecentDocumentMock).not.toHaveBeenCalled();
  });
});
