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
  PUNCH_PNG_EXTENSION,
  PUNCH_PNG_MIME_TYPE,
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
export { createRasterAssetId } from "./normalize";
export {
  DocumentParseError,
  DocumentValidationError,
  MissingDocumentFontsError,
  UnsupportedDocumentVersionError,
} from "./errors";
export { loadDesignDocument, parseDesignDocument } from "./load";
export {
  extractEmbeddedDocumentJson,
  parseEmbeddedDesignDocument,
} from "./svg-embedded-document";
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
  createPunchPackage,
  isPunchPackageBytes,
  loadPunchPackageContents,
} from "./package";
export {
  createDesignDocument,
  saveDesignDocument,
  serializeDesignDocument,
} from "./save";
export type {
  ArtboardNodeDocument,
  ClipboardContent,
  DesignDocument,
  DocumentAsset,
  EmptyNodeDocument,
  GroupNodeDocument,
  ImageNodeDocument,
  ImageMimeTypeDocument,
  LocalFontDocument,
  NodeDocument,
  PathNodeDocument,
  RasterAssetDocument,
  RasterAssetTileDocument,
  ShapeKindDocument,
  ShapeNodeDocument,
  TextNodeDocument,
  TransformDocument,
  VectorContourDocument,
  VectorFillRuleDocument,
  VectorHandleDocument,
  VectorNodeDocument,
  VectorPointTypeDocument,
  VectorSegmentDocument,
  VectorStrokeLineCapDocument,
  VectorStrokeLineJoinDocument,
  WarpDocument,
} from "./schema";
export {
  artboardNodeSchema,
  designDocumentSchema,
  documentAssetSchema,
  emptyNodeSchema,
  groupNodeSchema,
  imageNodeSchema,
  imageMimeTypeSchema,
  localFontSchema,
  nodeSchema,
  pathNodeSchema,
  rasterAssetSchema,
  rasterAssetTileSchema,
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
