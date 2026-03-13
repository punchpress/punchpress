const PATH_SEPARATOR_PATTERN = /[/\\]/;

export const getDuplicateRecentDocumentNames = (recentDocuments) => {
  const nameCounts = new Map();

  for (const recentDocument of recentDocuments) {
    nameCounts.set(
      recentDocument.fileName,
      (nameCounts.get(recentDocument.fileName) || 0) + 1
    );
  }

  return new Set(
    [...nameCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([fileName]) => fileName)
  );
};

export const getRecentDocumentSecondaryLabel = (
  recentDocument,
  duplicateNames
) => {
  if (!duplicateNames.has(recentDocument.fileName)) {
    return null;
  }

  if (recentDocument.filePath) {
    const segments = recentDocument.filePath.split(PATH_SEPARATOR_PATTERN);

    if (segments.length <= 1) {
      return recentDocument.filePath;
    }

    return segments.slice(0, -1).join("/");
  }

  const openedAt = new Date(recentDocument.lastOpenedAt);

  if (Number.isNaN(openedAt.getTime())) {
    return "Saved in browser";
  }

  return `Opened ${openedAt.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
};
