import { PUNCH_DOCUMENT_VERSION } from "./constants";
import { UnsupportedDocumentVersionError } from "./errors";
import { upgradeNodeAppearance1_8 } from "./migrate-appearance";
import { normalizeNodesForSchema } from "./normalize";
import { createDocumentAssetsFromNodes } from "./raster-assets";
import { canonicalizeTreeOrder } from "./tree-order";

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

    const nodes = canonicalizeTreeOrder(
      normalizeNodesForSchema(document.nodes)
    );

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

  // 1.9 → 1.10 widened paint to gradients, 1.10 → 1.11 stroke alignment, and
  // 1.11 → 1.12 added effects; none changes existing data.
  if (
    value.version === "1.9" ||
    value.version === "1.10" ||
    value.version === "1.11"
  ) {
    return normalizeDocumentRecord({
      ...value,
      version: PUNCH_DOCUMENT_VERSION,
    });
  }

  // 1.8 → 1.9 is the one data-reshaping upgrade: flat fill/stroke fields fold
  // into appearance stacks. Older versions stay unsupported.
  if (value.version === "1.8") {
    return normalizeDocumentRecord({
      ...value,
      nodes: Array.isArray(value.nodes)
        ? upgradeNodesAppearance1_8(value.nodes)
        : value.nodes,
      version: PUNCH_DOCUMENT_VERSION,
    });
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

export const upgradeNodesAppearance1_8 = (nodes: unknown[]) => {
  return nodes.map((node) => {
    return isRecord(node) ? upgradeNodeAppearance1_8(node) : node;
  });
};
