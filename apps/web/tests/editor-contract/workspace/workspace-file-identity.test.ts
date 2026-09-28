import { describe, expect, test } from "bun:test";
import {
  createFileOpenQueue,
  findLiveMatchingFileTab,
  findMatchingFileTab,
  isSameFileHandle,
} from "../../../src/workspace/workspace-file-identity";

const createHandle = (entryId: string, name: string, delayMs = 0) => ({
  entryId,
  isSameEntry: async (other: { entryId: string }) => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return other.entryId === entryId;
  },
  kind: "file" as const,
  name,
});

describe("workspace file identity", () => {
  test("compares native paths and browser handles without using filenames", async () => {
    const firstHandle = createHandle("entry-a", "design.punch", 10);
    const sameEntry = createHandle("entry-a", "design.punch");
    const sameNameDifferentEntry = createHandle("entry-b", "design.punch");

    expect(
      await isSameFileHandle("/designs/design.punch", "/designs/design.punch")
    ).toBe(true);
    expect(
      await isSameFileHandle("/designs/design.punch", "/archive/design.punch")
    ).toBe(false);
    expect(await isSameFileHandle(firstHandle, sameEntry)).toBe(true);
    expect(await isSameFileHandle(firstHandle, sameNameDifferentEntry)).toBe(
      false
    );
  });

  test("finds a matching tab through an asynchronous handle comparison", async () => {
    const storedHandle = createHandle("entry-a", "poster.punch");
    const reopenedHandle = createHandle("entry-a", "poster.punch", 5);
    const otherHandle = createHandle("entry-b", "poster.punch");

    await expect(
      findMatchingFileTab(
        [
          { fileHandle: otherHandle, id: "other" },
          { fileHandle: storedHandle, id: "stored" },
        ],
        reopenedHandle
      )
    ).resolves.toMatchObject({ id: "stored" });
  });

  test("deduplicates simultaneous opens without merging same-name files", async () => {
    const queue = createFileOpenQueue();
    const tabs: Array<{
      fileHandle: ReturnType<typeof createHandle>;
      id: string;
    }> = [];
    const firstHandle = createHandle("entry-a", "poster.punch", 5);
    const sameEntry = createHandle("entry-a", "poster.punch");
    const sameNameDifferentEntry = createHandle("entry-b", "poster.punch");
    const open = (fileHandle: ReturnType<typeof createHandle>) =>
      queue(async () => {
        const existingTab = await findMatchingFileTab(tabs, fileHandle);
        if (existingTab) {
          return existingTab;
        }

        const nextTab = { fileHandle, id: `tab-${tabs.length}` };
        tabs.push(nextTab);
        return nextTab;
      });

    const [firstTab, reopenedTab, otherTab] = await Promise.all([
      open(firstHandle),
      open(sameEntry),
      open(sameNameDifferentEntry),
    ]);

    expect(reopenedTab).toBe(firstTab);
    expect(otherTab).not.toBe(firstTab);
    expect(tabs).toHaveLength(2);
  });

  test("does not keep a tab closed during an asynchronous identity comparison", async () => {
    let tabs = [
      {
        fileHandle: {
          isSameEntry: async () => {
            await Promise.resolve();
            tabs = [];
            return true;
          },
          kind: "file" as const,
          name: "poster.punch",
        },
        id: "closed-during-compare",
      },
    ];

    await expect(
      findLiveMatchingFileTab(
        () => tabs,
        createHandle("entry-a", "poster.punch")
      )
    ).resolves.toBeNull();
  });

  test("rechecks a surviving tab after its handle changes during comparison", async () => {
    let tabs: Array<{
      fileHandle: {
        isSameEntry: () => Promise<boolean>;
        kind: "file";
        name: string;
      };
      id: string;
    }> = [];
    let comparisonCount = 0;
    const replacementHandle = {
      isSameEntry: async () => {
        comparisonCount += 1;
        await Promise.resolve();
        if (comparisonCount === 2) {
          tabs = [];
        }
        return true;
      },
      kind: "file" as const,
      name: "poster.punch",
    };
    const originalHandle = {
      isSameEntry: async () => {
        comparisonCount += 1;
        await Promise.resolve();
        tabs = [
          {
            fileHandle: replacementHandle,
            id: "changed-during-compare",
          },
        ];
        return true;
      },
      kind: "file" as const,
      name: "poster.punch",
    };
    tabs = [{ fileHandle: originalHandle, id: "changed-during-compare" }];

    await expect(
      findLiveMatchingFileTab(
        () => tabs,
        createHandle("entry-a", "poster.punch")
      )
    ).resolves.toBeNull();
  });
});

test("serializes simultaneous file opens and continues after a failed open", async () => {
  const queue = createFileOpenQueue();
  const events: string[] = [];
  let finishFirst: (() => void) | undefined;

  const first = queue(async () => {
    events.push("first:start");
    await new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    events.push("first:end");
    throw new Error("first open failed");
  });
  const second = queue(() => {
    events.push("second");
    return "opened";
  });

  await Promise.resolve();
  expect(events).toEqual(["first:start"]);
  finishFirst?.();

  await expect(first).rejects.toThrow("first open failed");
  await expect(second).resolves.toBe("opened");
  expect(events).toEqual(["first:start", "first:end", "second"]);
});
