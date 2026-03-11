import { get, set } from "idb-keyval";

const MAX_RECENT_DOCUMENTS = 10;
const RECENT_DOCUMENTS_KEY = "punchpress:recent-documents";

export interface BrowserRecentDocumentRecord {
  fileHandle: FileSystemFileHandle;
  fileName: string;
  id: string;
  lastOpenedAt: string;
}

const createRecentDocumentId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isBrowserRecentDocumentsSupported = () => {
  return (
    typeof window !== "undefined" &&
    "indexedDB" in window &&
    typeof FileSystemFileHandle !== "undefined"
  );
};

const isRecentDocumentRecord = (
  value: unknown
): value is BrowserRecentDocumentRecord => {
  if (!(value && typeof value === "object")) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.fileHandle instanceof FileSystemFileHandle &&
    typeof candidate.fileName === "string" &&
    candidate.fileName.length > 0 &&
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.lastOpenedAt === "string" &&
    candidate.lastOpenedAt.length > 0
  );
};

const loadRecentDocumentRecords = async () => {
  if (!isBrowserRecentDocumentsSupported()) {
    return [];
  }

  const storedValue = await get<unknown>(RECENT_DOCUMENTS_KEY);

  if (!Array.isArray(storedValue)) {
    return [];
  }

  return storedValue
    .filter(isRecentDocumentRecord)
    .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt))
    .slice(0, MAX_RECENT_DOCUMENTS);
};

const saveRecentDocumentRecords = async (
  recentDocuments: BrowserRecentDocumentRecord[]
) => {
  if (!isBrowserRecentDocumentsSupported()) {
    return;
  }

  await set(
    RECENT_DOCUMENTS_KEY,
    recentDocuments.slice(0, MAX_RECENT_DOCUMENTS)
  );
};

const dedupeRecentDocumentRecords = async (
  recentDocuments: BrowserRecentDocumentRecord[]
) => {
  const uniqueRecentDocuments: BrowserRecentDocumentRecord[] = [];

  for (const recentDocument of recentDocuments) {
    let isDuplicate = false;

    for (const uniqueRecentDocument of uniqueRecentDocuments) {
      try {
        if (
          await recentDocument.fileHandle.isSameEntry(
            uniqueRecentDocument.fileHandle
          )
        ) {
          isDuplicate = true;
          break;
        }
      } catch {
        // Ignore handles that can no longer be compared.
      }
    }

    if (!isDuplicate) {
      uniqueRecentDocuments.push(recentDocument);
    }
  }

  return uniqueRecentDocuments.slice(0, MAX_RECENT_DOCUMENTS);
};

const getReadPermissionState = async (fileHandle: FileSystemFileHandle) => {
  try {
    return await fileHandle.queryPermission({ mode: "read" });
  } catch {
    return "denied";
  }
};

const getRetainedRecentDocumentRecords = async () => {
  const normalizedRecentDocuments = await dedupeRecentDocumentRecords(
    await loadRecentDocumentRecords()
  );
  const readPermissionStates = await Promise.all(
    normalizedRecentDocuments.map((recentDocument) => {
      return getReadPermissionState(recentDocument.fileHandle);
    })
  );
  const retainedRecentDocuments = normalizedRecentDocuments.filter(
    (_, index) => readPermissionStates[index] !== "denied"
  );

  const shouldPersistNormalizedRecentDocuments =
    retainedRecentDocuments.length !== normalizedRecentDocuments.length ||
    retainedRecentDocuments.some((recentDocument, index) => {
      return normalizedRecentDocuments[index]?.id !== recentDocument.id;
    });

  if (shouldPersistNormalizedRecentDocuments) {
    await saveRecentDocumentRecords(retainedRecentDocuments);
  }

  return retainedRecentDocuments;
};

export const rememberBrowserRecentDocument = async (
  fileHandle: FileSystemFileHandle
) => {
  if (!isBrowserRecentDocumentsSupported()) {
    return [];
  }

  const nextRecentDocuments = await dedupeRecentDocumentRecords([
    {
      fileHandle,
      fileName: fileHandle.name || "document.punch",
      id: createRecentDocumentId(),
      lastOpenedAt: new Date().toISOString(),
    },
    ...(await loadRecentDocumentRecords()),
  ]);

  await saveRecentDocumentRecords(nextRecentDocuments);
  return nextRecentDocuments;
};

export const getBrowserRecentDocuments = () => {
  return getRetainedRecentDocumentRecords();
};

export const openBrowserRecentDocument = async (
  fileHandle: FileSystemFileHandle,
  fileName: string
) => {
  const permissionState = await getReadPermissionState(fileHandle);
  if (permissionState === "denied") {
    return null;
  }

  if (permissionState !== "granted") {
    const requestedPermission = await fileHandle.requestPermission({
      mode: "read",
    });

    if (requestedPermission !== "granted") {
      return null;
    }
  }

  const openedDocument = {
    contents: await (await fileHandle.getFile()).text(),
    fileHandle,
    fileName: fileName || fileHandle.name || "document.punch",
  };
  await rememberBrowserRecentDocument(fileHandle);
  return openedDocument;
};
