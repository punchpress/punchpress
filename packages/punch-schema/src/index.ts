// biome-ignore lint/performance/noBarrelFile: package root public API
export {
  clipboardContentSchema,
  PUNCH_CLIPBOARD_HTML_ATTRIBUTE,
  PUNCH_CLIPBOARD_MIME_TYPE,
  parseClipboardContent,
  serializeClipboardContent,
} from "./clipboard";
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
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
  VECTOR_STROKE_LINE_CAP_VALUES,
  VECTOR_STROKE_LINE_JOIN_VALUES,
} from "./vector-stroke-style";
export {
  getMissingDocumentFonts,
  replaceMissingDocumentFonts,
} from "./document-fonts";
export { normalizeNodeForSchema, normalizeNodesForSchema } from "./normalize";
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
  ClipboardContent,
  DesignDocument,
  GroupNodeDocument,
  LocalFontDocument,
  NodeDocument,
  ShapeKindDocument,
  ShapeNodeDocument,
  TextNodeDocument,
  TransformDocument,
  VectorContourDocument,
  VectorFillRuleDocument,
  VectorHandleDocument,
  VectorStrokeLineCapDocument,
  VectorStrokeLineJoinDocument,
  VectorNodeDocument,
  VectorPointTypeDocument,
  VectorSegmentDocument,
  WarpDocument,
} from "./schema";
export {
  designDocumentSchema,
  groupNodeSchema,
  localFontSchema,
  nodeSchema,
  shapeKindSchema,
  shapeNodeSchema,
  textNodeSchema,
  transformSchema,
  vectorContourSchema,
  vectorFillRuleSchema,
  vectorHandleSchema,
  vectorNodeSchema,
  vectorPointTypeSchema,
  vectorSegmentSchema,
  vectorStrokeLineCapSchema,
  vectorStrokeLineJoinSchema,
  warpSchema,
} from "./schema";
