/* biome-ignore lint/performance/noBarrelFile: package root public API */
export {
  DEFAULT_DOCUMENT_BASE_NAME,
  PUNCH_DOCUMENT_EXTENSION,
  PUNCH_DOCUMENT_MIME_TYPE,
  PUNCH_DOCUMENT_VERSION,
  PUNCH_SVG_EXTENSION,
  PUNCH_SVG_MIME_TYPE,
  ROOT_PARENT_ID,
} from "./constants";
export {
  getMissingDocumentFonts,
  replaceMissingDocumentFonts,
} from "./document-fonts";
export {
  DocumentParseError,
  DocumentValidationError,
  MissingDocumentFontsError,
  UnsupportedDocumentVersionError,
} from "./errors";
export { loadDesignDocument, parseDesignDocument } from "./load";
export type {
  LocalFontCatalogResult,
  LocalFontCatalogState,
  LocalFontDescriptor,
  LocalFontOption,
} from "./local-fonts";
export {
  areLocalFontsEqual,
  createLocalFontDescriptor,
  createLocalFontOption,
  DEFAULT_LOCAL_FONT,
  getLocalFontId,
  getLocalFontLabel,
  getLocalFontSearchText,
} from "./local-fonts";
export { migrateDocument } from "./migrate";
export {
  createDesignDocument,
  saveDesignDocument,
  serializeDesignDocument,
} from "./save";
export type {
  DesignDocument,
  GroupNodeDocument,
  LocalFontDocument,
  NodeDocument,
  TextNodeDocument,
  TransformDocument,
  WarpDocument,
} from "./schema";
export {
  designDocumentSchema,
  groupNodeSchema,
  localFontSchema,
  nodeSchema,
  textNodeSchema,
  transformSchema,
  warpSchema,
} from "./schema";
