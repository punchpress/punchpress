import type { PunchDocumentHandle } from "@/platform/web-document-files";

export const isSameFileHandle = async (
  left: PunchDocumentHandle,
  right: PunchDocumentHandle
) => {
  if (!(left && right)) {
    return false;
  }

  if (left === right) {
    return true;
  }

  if (typeof left === "string" || typeof right === "string") {
    return false;
  }

  try {
    return await left.isSameEntry(right);
  } catch {
    return false;
  }
};

export const findMatchingFileTab = async <
  Tab extends { fileHandle?: PunchDocumentHandle; id: string },
>(
  tabs: readonly Tab[],
  fileHandle: PunchDocumentHandle
) => {
  for (const tab of tabs) {
    if (await isSameFileHandle(tab.fileHandle || null, fileHandle)) {
      return tab;
    }
  }

  return null;
};

export const findLiveMatchingFileTab = async <
  Tab extends { fileHandle?: PunchDocumentHandle; id: string },
>(
  getTabs: () => readonly Tab[],
  fileHandle: PunchDocumentHandle
) => {
  const candidate = await findMatchingFileTab(getTabs(), fileHandle);
  if (!candidate) {
    return null;
  }

  const liveCandidate = getTabs().find(
    (tab) => tab.id === candidate.id && tab.fileHandle === candidate.fileHandle
  );
  if (liveCandidate) {
    return liveCandidate;
  }

  const refreshedCandidate = await findMatchingFileTab(getTabs(), fileHandle);
  if (!refreshedCandidate) {
    return null;
  }

  return (
    getTabs().find(
      (tab) =>
        tab.id === refreshedCandidate.id &&
        tab.fileHandle === refreshedCandidate.fileHandle
    ) || null
  );
};

export const createFileOpenQueue = () => {
  let pending: Promise<unknown> = Promise.resolve();

  return <Result>(operation: () => Result | PromiseLike<Result>) => {
    const next = pending.then(operation);
    pending = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };
};
