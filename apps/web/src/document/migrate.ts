import { PUNCH_DOCUMENT_VERSION } from "./constants";
import { UnsupportedDocumentVersionError } from "./errors";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

export const migrateDocument = (value: unknown) => {
  if (!isRecord(value)) {
    throw new UnsupportedDocumentVersionError(
      "Document must be a JSON object."
    );
  }

  if (value.version === PUNCH_DOCUMENT_VERSION) {
    return value;
  }

  if (typeof value.version !== "string" || value.version.length === 0) {
    throw new UnsupportedDocumentVersionError(
      "Document is missing a supported version."
    );
  }

  throw new UnsupportedDocumentVersionError(
    `Unsupported document version: ${value.version}`
  );
};
