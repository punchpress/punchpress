import { DocumentParseError, DocumentValidationError } from "./errors";
import { migrateDocument } from "./migrate";
import { type DesignDocument, designDocumentSchema } from "./schema";

const parseDocumentJson = (contents: string) => {
  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new DocumentParseError("Document is not valid JSON.", {
      cause: error,
    });
  }
};

const formatValidationError = (error: {
  issues: Array<{ message: string; path: Array<string | number> }>;
}) => {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "document";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
};

export const parseDesignDocument = (contents: string): DesignDocument => {
  const parsed = parseDocumentJson(contents);
  const migrated = migrateDocument(parsed);
  const result = designDocumentSchema.safeParse(migrated);

  if (!result.success) {
    throw new DocumentValidationError(formatValidationError(result.error), {
      cause: result.error,
    });
  }

  return result.data;
};

export const loadDesignDocument = (contents: string) => {
  const document = parseDesignDocument(contents);

  return {
    document,
    nodes: document.nodes,
  };
};
