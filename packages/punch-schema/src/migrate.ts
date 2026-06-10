import { PUNCH_DOCUMENT_VERSION } from "./constants";
import { UnsupportedDocumentVersionError } from "./errors";
import { normalizeNodesForSchema } from "./normalize";
import { createDocumentAssetsFromNodes } from "./raster-assets";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

export const migrateDocument = (value: unknown) => {
  if (!isRecord(value)) {
    throw new UnsupportedDocumentVersionError(
      "Document must be a JSON object."
    );
  }

  const normalizeDocumentRecord = (document: Record<string, unknown>) => {
    if (!Array.isArray(document.nodes)) {
      return document;
    }

    const nodes = normalizeNodesForSchema(document.nodes);

    return {
      ...document,
      assets: createDocumentAssetsFromNodes(
        nodes,
        isRecord(document.assets) ? document.assets : {}
      ),
      nodes,
    };
  };

  if (value.version === PUNCH_DOCUMENT_VERSION) {
    return normalizeDocumentRecord(value);
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
