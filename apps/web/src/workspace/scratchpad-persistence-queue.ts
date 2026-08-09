export const createScratchpadPersistenceQueue = ({ serialize, save }) => {
  let queue = Promise.resolve();

  return () => {
    queue = queue
      .catch(() => undefined)
      .then(async () => {
        await save(await serialize());
      });

    return queue;
  };
};
