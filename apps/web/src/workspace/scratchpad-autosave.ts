interface ScratchpadEditor {
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

  const flush = async () => {
    while (true) {
      clearTimeout(timeoutId);
      timeoutId = undefined;

      if (revision > queuedRevision) {
        const writeRevision = revision;
        queuedRevision = writeRevision;
        latestWrite = pendingWrite
          .then(async () => save(await editor.serializeDocumentAsync()))
          .then(
            () => {
              savedRevision = writeRevision;
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

      await latestWrite;
      if (revision === savedRevision) {
        return;
      }
    }
  };

  const schedule = () => {
    revision += 1;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      flush().catch(console.error);
    }, delayMs);
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
