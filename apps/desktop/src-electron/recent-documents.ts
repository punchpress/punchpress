import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { app } from "electron";

const MAX_RECENT_DOCUMENTS = 10;
const RECENT_DOCUMENTS_FILE_NAME = "recent-documents.json";

export interface DesktopRecentDocument {
  fileName: string;
  filePath: string;
  lastOpenedAt: string;
}

export interface DesktopOpenedDocument {
  contents: string;
  fileHandle: string;
  fileName: string;
}

let cachedRecentDocuments: DesktopRecentDocument[] | null = null;

const getRecentDocumentsStoragePath = () => {
  return path.join(app.getPath("userData"), RECENT_DOCUMENTS_FILE_NAME);
};

const isRecentDocument = (value: unknown): value is DesktopRecentDocument => {
  if (!(value && typeof value === "object")) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.filePath === "string" &&
    candidate.filePath.length > 0 &&
    typeof candidate.fileName === "string" &&
    candidate.fileName.length > 0 &&
    typeof candidate.lastOpenedAt === "string" &&
    candidate.lastOpenedAt.length > 0
  );
};

const normalizeRecentDocuments = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueDocuments = new Map<string, DesktopRecentDocument>();

  for (const entry of value) {
    if (!isRecentDocument(entry)) {
      continue;
    }

    const filePath = path.resolve(entry.filePath);
    const currentEntry = uniqueDocuments.get(filePath);

    if (currentEntry && currentEntry.lastOpenedAt >= entry.lastOpenedAt) {
      continue;
    }

    uniqueDocuments.set(filePath, {
      fileName: entry.fileName || path.basename(filePath),
      filePath,
      lastOpenedAt: entry.lastOpenedAt,
    });
  }

  return [...uniqueDocuments.values()]
    .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt))
    .slice(0, MAX_RECENT_DOCUMENTS);
};

const syncSystemRecentDocuments = (recentDocuments: DesktopRecentDocument[]) => {
  app.clearRecentDocuments();

  for (const recentDocument of recentDocuments) {
    app.addRecentDocument(recentDocument.filePath);
  }
};

const writeRecentDocuments = async (
  recentDocuments: DesktopRecentDocument[]
) => {
  cachedRecentDocuments = recentDocuments;
  await mkdir(path.dirname(getRecentDocumentsStoragePath()), {
    recursive: true,
  });
  await writeFile(
    getRecentDocumentsStoragePath(),
    JSON.stringify(recentDocuments, null, 2),
    "utf8"
  );
  syncSystemRecentDocuments(recentDocuments);
};

const isFileAvailable = async (filePath: string) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const loadRecentDocuments = async () => {
  if (cachedRecentDocuments) {
    return cachedRecentDocuments;
  }

  try {
    const storedValue = await readFile(getRecentDocumentsStoragePath(), "utf8");
    cachedRecentDocuments = normalizeRecentDocuments(JSON.parse(storedValue));
  } catch (error) {
    const systemError = error as NodeJS.ErrnoException;

    if (systemError.code && systemError.code !== "ENOENT") {
      throw error;
    }

    cachedRecentDocuments = [];
  }

  syncSystemRecentDocuments(cachedRecentDocuments);
  return cachedRecentDocuments;
};

const removeUnavailableRecentDocuments = async (
  recentDocuments: DesktopRecentDocument[]
) => {
  const availability = await Promise.all(
    recentDocuments.map((recentDocument) => {
      return isFileAvailable(recentDocument.filePath);
    })
  );

  return recentDocuments.filter((_, index) => availability[index]);
};

export const getRecentDocuments = async () => {
  const recentDocuments = await loadRecentDocuments();
  const availableRecentDocuments =
    await removeUnavailableRecentDocuments(recentDocuments);

  if (availableRecentDocuments.length !== recentDocuments.length) {
    await writeRecentDocuments(availableRecentDocuments);
    return availableRecentDocuments;
  }

  return availableRecentDocuments;
};

export const readDocumentAtPath = async (
  filePath: string
): Promise<DesktopOpenedDocument> => {
  return {
    contents: await readFile(filePath, "utf8"),
    fileHandle: filePath,
    fileName: path.basename(filePath),
  };
};

export const rememberRecentDocument = async (filePath: string) => {
  const resolvedFilePath = path.resolve(filePath);
  const recentDocuments = await getRecentDocuments();
  const nextRecentDocuments = [
    {
      fileName: path.basename(resolvedFilePath),
      filePath: resolvedFilePath,
      lastOpenedAt: new Date().toISOString(),
    },
    ...recentDocuments.filter((entry) => entry.filePath !== resolvedFilePath),
  ].slice(0, MAX_RECENT_DOCUMENTS);

  await writeRecentDocuments(nextRecentDocuments);
  return nextRecentDocuments;
};

export const openDocumentAtPath = async (filePath: string) => {
  const resolvedFilePath = path.resolve(filePath);

  if (!(await isFileAvailable(resolvedFilePath))) {
    return null;
  }

  const openedDocument = await readDocumentAtPath(resolvedFilePath);
  await rememberRecentDocument(resolvedFilePath);
  return openedDocument;
};

export const openRecentDocument = async (filePath: string) => {
  const resolvedFilePath = path.resolve(filePath);

  if (!(await isFileAvailable(resolvedFilePath))) {
    const recentDocuments = await getRecentDocuments();
    await writeRecentDocuments(
      recentDocuments.filter((entry) => entry.filePath !== resolvedFilePath)
    );
    return null;
  }

  return openDocumentAtPath(resolvedFilePath);
};
