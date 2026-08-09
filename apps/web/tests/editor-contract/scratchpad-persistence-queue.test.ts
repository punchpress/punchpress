import { expect, test } from "bun:test";
import { createScratchpadPersistenceQueue } from "../../src/workspace/scratchpad-persistence-queue";

test("Scratchpad persistence writes serialized revisions in request order", async () => {
  let releaseFirstSave = () => undefined;
  const firstSaveBlocked = new Promise<void>((resolve) => {
    releaseFirstSave = resolve;
  });
  const serialized = ["revision-1", "revision-2"];
  const writes: string[] = [];
  let activeSaves = 0;
  let maxActiveSaves = 0;
  const persist = createScratchpadPersistenceQueue({
    save: async (contents: string) => {
      activeSaves += 1;
      maxActiveSaves = Math.max(maxActiveSaves, activeSaves);
      if (contents === "revision-1") {
        await firstSaveBlocked;
      }
      writes.push(contents);
      activeSaves -= 1;
    },
    serialize: async () => serialized.shift() || "unexpected",
  });

  const first = persist();
  const second = persist();
  await Promise.resolve();
  releaseFirstSave();
  await Promise.all([first, second]);

  expect(maxActiveSaves).toBe(1);
  expect(writes).toEqual(["revision-1", "revision-2"]);
});
