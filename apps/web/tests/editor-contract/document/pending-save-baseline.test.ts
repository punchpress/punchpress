import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import { saveDocumentTab } from "../../../src/components/panels/document-commands/save-document-tab";
import type { PunchFileSaveResult } from "../../../src/platform/web-document-files";

const createFileTab = (id: string, fileHandle: string | null = null) => {
  const editor = new Editor();
  editor.addShapeNode({ x: 100, y: 100 });

  return { baseName: id, editor, fileHandle, id };
};

const deferredWrite = () => {
  let resolve!: (result: PunchFileSaveResult) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<PunchFileSaveResult>(
    (resolveWrite, rejectWrite) => {
      resolve = resolveWrite;
      reject = rejectWrite;
    }
  );

  return { promise, reject, resolve };
};

describe("pending document save", () => {
  test("an edit during async serialization remains dirty after save", async () => {
    const tab = createFileTab("serializing", "/tmp/serializing.punch");
    const serialize = tab.editor.serializeDocumentAsync.bind(tab.editor);
    let signalSerializationStarted!: () => void;
    const serializationStarted = new Promise<void>((resolve) => {
      signalSerializationStarted = resolve;
    });
    let releaseSerialization!: () => void;
    const serializationBlocked = new Promise<void>((resolve) => {
      releaseSerialization = resolve;
    });
    tab.editor.serializeDocumentAsync = async () => {
      signalSerializationStarted();
      await serializationBlocked;
      return serialize();
    };
    let writtenSnapshot = "";

    const saving = saveDocumentTab({
      tab,
      updateIdentity: () => undefined,
      writeFile: (snapshot) => {
        writtenSnapshot = snapshot;
        return Promise.resolve({
          canceled: false,
          fileHandle: "/tmp/serializing.punch",
          fileName: "serializing.punch",
        });
      },
    });
    await serializationStarted;
    tab.editor.addShapeNode({ x: 200, y: 200 });
    releaseSerialization();
    await saving;

    expect(writtenSnapshot).toBe(tab.editor.serializeDocument());
    expect(tab.editor.isDirty).toBe(true);
  });

  test("successful slow write saves only its snapshot and stays on its tab", async () => {
    const tab = createFileTab("first", "/tmp/first.punch");
    const otherTab = createFileTab("second", "/tmp/second.punch");
    const write = deferredWrite();
    const updatedTabs: string[] = [];
    let writtenSnapshot = "";
    let signalWriteStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      signalWriteStarted = resolve;
    });

    const saving = saveDocumentTab({
      tab,
      updateIdentity: (id) => updatedTabs.push(id),
      writeFile: (snapshot) => {
        writtenSnapshot = snapshot;
        signalWriteStarted();
        return write.promise;
      },
    });

    await writeStarted;
    tab.editor.addShapeNode({ x: 200, y: 200 });
    const editedSnapshot = tab.editor.serializeDocument();
    otherTab.editor.addShapeNode({ x: 300, y: 300 });
    write.resolve({
      canceled: false,
      fileHandle: "/tmp/first.punch",
      fileName: "first.punch",
    });

    expect(await saving).toEqual({ fileName: "first.punch" });
    expect(updatedTabs).toEqual(["first"]);
    expect(tab.editor.isDirty).toBe(true);
    expect(otherTab.editor.isDirty).toBe(true);
    expect(tab.editor.serializeDocument()).toBe(editedSnapshot);

    const reopened = new Editor();
    reopened.loadDocument(writtenSnapshot);
    expect(reopened.serializeDocument()).toBe(writtenSnapshot);
    expect(reopened.serializeDocument()).not.toBe(editedSnapshot);

    tab.editor.undo();
    expect(tab.editor.isDirty).toBe(false);
    tab.editor.redo();
    expect(tab.editor.isDirty).toBe(true);
  });

  test("failed slow write preserves dirty state and file identity", async () => {
    const tab = createFileTab("failed", "/tmp/failed.punch");
    const write = deferredWrite();
    const updatedTabs: string[] = [];
    let signalWriteStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      signalWriteStarted = resolve;
    });
    const saving = saveDocumentTab({
      tab,
      updateIdentity: (id) => updatedTabs.push(id),
      writeFile: () => {
        signalWriteStarted();
        return write.promise;
      },
    });

    await writeStarted;
    tab.editor.addShapeNode({ x: 200, y: 200 });
    write.reject(new Error("write failed"));

    await expect(saving).rejects.toThrow("write failed");
    expect(tab.editor.isDirty).toBe(true);
    expect(tab.fileHandle).toBe("/tmp/failed.punch");
    expect(updatedTabs).toEqual([]);

    tab.editor.undo();
    expect(tab.editor.isDirty).toBe(true);
  });

  test("save as updates identity but leaves a later edit dirty", async () => {
    const tab = createFileTab("original", "/tmp/original.punch");
    const write = deferredWrite();
    const identities: unknown[] = [];
    let forceDialogRequested = false;
    let writtenSnapshot = "";
    let signalWriteStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      signalWriteStarted = resolve;
    });
    const saving = saveDocumentTab({
      forceDialog: true,
      tab,
      updateIdentity: (_id, identity) => identities.push(identity),
      writeFile: (snapshot, _name, _handle, forceDialog) => {
        writtenSnapshot = snapshot;
        forceDialogRequested = forceDialog === true;
        signalWriteStarted();
        return write.promise;
      },
    });

    await writeStarted;
    tab.editor.addShapeNode({ x: 200, y: 200 });
    write.resolve({
      canceled: false,
      fileHandle: "/tmp/renamed.punch",
      fileName: "renamed.punch",
    });

    expect(await saving).toEqual({ fileName: "renamed.punch" });
    expect(forceDialogRequested).toBe(true);
    expect(identities).toEqual([
      { baseName: "renamed", fileHandle: "/tmp/renamed.punch" },
    ]);
    expect(tab.editor.isDirty).toBe(true);
    expect(tab.editor.serializeDocument()).not.toBe(writtenSnapshot);
  });
});
