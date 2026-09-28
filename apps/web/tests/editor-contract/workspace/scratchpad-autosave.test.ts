import { expect, test } from "bun:test";
import { createScratchpadAutosave } from "../../../src/workspace/scratchpad-autosave";

const createEditor = () => {
  let contents = "initial";
  const listeners = new Set<() => void>();

  return {
    editor: {
      serializeDocumentAsync: async () => contents,
      store: {
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
    },
    edit: (nextContents: string) => {
      contents = nextContents;
      for (const listener of listeners) {
        listener();
      }
    },
    listenerCount: () => listeners.size,
  };
};

test("flushing a pending Scratchpad edit writes the latest content once", async () => {
  const { editor, edit } = createEditor();
  const saved: string[] = [];
  const autosave = createScratchpadAutosave(
    editor,
    (contents) => {
      saved.push(contents);
      return Promise.resolve();
    },
    20
  );

  edit("first");
  edit("latest");
  await autosave.flush();
  await new Promise((resolve) => setTimeout(resolve, 40));

  expect(saved).toEqual(["latest"]);
  autosave.dispose();
});

test("flush waits for async serialization and saves edits made during it", async () => {
  const { editor, edit } = createEditor();
  const saved: string[] = [];
  let releaseSerialization!: () => void;
  const serializationBlocked = new Promise<void>((resolve) => {
    releaseSerialization = resolve;
  });
  let serializationStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    serializationStarted = resolve;
  });
  let serializations = 0;
  const serialize = editor.serializeDocumentAsync;
  editor.serializeDocumentAsync = async () => {
    serializations += 1;
    const snapshot = await serialize();
    if (serializations === 1) {
      serializationStarted();
      await serializationBlocked;
    }
    return snapshot;
  };
  const autosave = createScratchpadAutosave(editor, (contents) => {
    saved.push(contents);
    return Promise.resolve();
  });

  edit("first");
  const flushing = autosave.flush();
  await started;
  edit("latest");
  releaseSerialization();
  await flushing;

  expect(saved).toEqual(["first", "latest"]);
  await autosave.dispose();
});

test("disposing with a pending timer flushes and removes the editor subscription", async () => {
  const { editor, edit, listenerCount } = createEditor();
  const saved: string[] = [];
  const autosave = createScratchpadAutosave(
    editor,
    (contents) => {
      saved.push(contents);
      return Promise.resolve();
    },
    20
  );

  edit("latest");
  await autosave.dispose();
  edit("after-dispose");
  await new Promise((resolve) => setTimeout(resolve, 40));

  expect(saved).toEqual(["latest"]);
  expect(listenerCount()).toBe(0);
});

test("a newer Scratchpad write waits for an earlier write", async () => {
  const { editor, edit } = createEditor();
  const saved: string[] = [];
  let finishFirstWrite: (() => void) | undefined;
  let finishLatestWrite: (() => void) | undefined;
  let signalFirstWriteStarted!: () => void;
  const firstWriteStarted = new Promise<void>((resolve) => {
    signalFirstWriteStarted = resolve;
  });
  let signalLatestWriteStarted!: () => void;
  const latestWriteStarted = new Promise<void>((resolve) => {
    signalLatestWriteStarted = resolve;
  });
  const autosave = createScratchpadAutosave(editor, (contents) => {
    if (contents === "first") {
      return new Promise<void>((resolve) => {
        finishFirstWrite = () => {
          saved.push(contents);
          resolve();
        };
        signalFirstWriteStarted();
      });
    }

    return new Promise<void>((resolve) => {
      finishLatestWrite = () => {
        saved.push(contents);
        resolve();
      };
      signalLatestWriteStarted();
    });
  });

  edit("first");
  const firstWrite = autosave.flush();
  let firstWriteSettled = false;
  firstWrite.then(() => {
    firstWriteSettled = true;
  });
  await firstWriteStarted;
  edit("latest");
  const latestWrite = autosave.flush();

  expect(saved).toEqual([]);
  finishFirstWrite?.();
  await latestWriteStarted;
  expect(firstWriteSettled).toBe(false);
  expect(finishLatestWrite).toBeDefined();
  finishLatestWrite?.();
  await firstWrite;
  expect(saved).toEqual(["first", "latest"]);
  await latestWrite;
  expect(saved).toEqual(["first", "latest"]);
  await autosave.dispose();
});

test("a failed flush is reported so a tab switch can stay on Scratchpad", async () => {
  const { editor, edit } = createEditor();
  let attempts = 0;
  const autosave = createScratchpadAutosave(editor, () => {
    attempts += 1;
    return attempts === 1
      ? Promise.reject(new Error("storage unavailable"))
      : Promise.resolve();
  });

  edit("latest");
  await expect(autosave.flush()).rejects.toThrow("storage unavailable");
  await autosave.dispose();
  expect(attempts).toBe(2);
});
