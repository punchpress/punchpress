import { PUNCH_DOCUMENT_VERSION } from "./constants";
import { normalizeNodesForSchema } from "./normalize";
import { type DesignDocument, designDocumentSchema } from "./schema";

export const createDesignDocument = (
  nodes: readonly DesignDocument["nodes"][number][]
): DesignDocument => {
  return designDocumentSchema.parse({
    version: PUNCH_DOCUMENT_VERSION,
    nodes: normalizeNodesForSchema(nodes),
  });
};

export const serializeDesignDocument = (document: DesignDocument) => {
  const validatedDocument = designDocumentSchema.parse(document);
  return `${JSON.stringify(validatedDocument, null, 2)}\n`;
};

export const saveDesignDocument = (
  nodes: readonly DesignDocument["nodes"][number][]
) => {
  const document = createDesignDocument(nodes);

  return {
    contents: serializeDesignDocument(document),
    document,
  };
};
