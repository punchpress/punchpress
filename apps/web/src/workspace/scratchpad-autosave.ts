interface ScratchpadEditor {
  hasOpenHistoryStep?: boolean;
  serializeDocumentAsync: () => Promise<string>;
  store: { subscribe: (listener: () => void) => () => void };
}

export const createScratchpadAutosave = (
  editor: ScratchpadEditor,
  save: (contents: string) => Promise<unknown>,
  delayMs = 400
) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let pendingWrite = Promise.resolve();
  let latestWrite = pendingWrite;
  let revision = 0;
  let queuedRevision = 0;
  let savedRevision = 0;

  const write = ({ timed = false } = {}) => {
    clearTimeout(timeoutId);
    timeoutId = undefined;

    if (revision > queuedRevision) {
      const writeRevision = revision;
      queuedRevision = writeRevision;
      latestWrite = pendingWrite
        .then(async () => {
          // A timed write queued behind a slow save can start after a gesture
          // opened; hand it back to the timer instead of serializing now.
          if (timed && editor.hasOpenHistoryStep) {
            if (queuedRevision === writeRevision) {
              queuedRevision = savedRevision;
            }
            arm();
            return false;
          }

          await save(await editor.serializeDocumentAsync());
          return true;
        })
        .then(
          (didSave) => {
            if (didSave) {
              savedRevision = writeRevision;
            }
          },
          (error) => {
            if (queuedRevision === writeRevision) {
              queuedRevision = savedRevision;
            }
            throw error;
          }
        );
      pendingWrite = latestWrite.catch(() => undefined);
    }

    return latestWrite;
  };

  // Explicit flushes chase edits made during a write; timed writes leave
  // them to the next debounce so a continuous gesture is not re-serialized
  // after every write.
  const flush = async () => {
    while (true) {
      await write();
      if (revision === savedRevision) {
        return;
      }
    }
  };

  // Serializing a large document takes long enough to stall a frame, so a
  // timed write waits until the open gesture commits.
  const arm = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      if (editor.hasOpenHistoryStep) {
        arm();
        return;
      }

      write({ timed: true }).catch(console.error);
    }, delayMs);
  };

  const schedule = () => {
    revision += 1;
    arm();
  };

  const unsubscribe = editor.store.subscribe(schedule);

  return {
    flush,
    dispose: () => {
      unsubscribe();
      return flush();
    },
  };
};
