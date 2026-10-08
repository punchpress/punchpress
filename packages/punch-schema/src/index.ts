// biome-ignore lint/performance/noBarrelFile: package root public API

export type {
  AppearanceDocument,
  FillLayerDocument,
  GradientStopDocument,
  LinearGradientPaintDocument,
  PaintDocument,
  StrokeLayerDocument,
} from "./appearance-schema";
export {
  appearanceSchema,
  colorSchema,
  fillLayerSchema,
  gradientStopSchema,
  linearGradientPaintSchema,
  MAX_APPEARANCE_LAYERS,
  MAX_GRADIENT_STOPS,
  paintSchema,
  strokeLayerSchema,
} from "./appearance-schema";
export type { ClipboardContent } from "./clipboard";
export {
  clipboardContentSchema,
  PUNCH_CLIPBOARD_HTML_ATTRIBUTE,
  PUNCH_CLIPBOARD_MIME_TYPE,
  parseClipboardContent,
  serializeClipboardContent,
} from "./clipboard";
export type { ParsedColor } from "./color";
export { formatColor, isCanonicalColor, parseColor, toRgb } from "./color";
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
export { getMissingDocumentFonts } from "./document-fonts";
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
export { upgradeNodeAppearance1_8 } from "./migrate-appearance";
export {
  createRasterAssetId,
  normalizeNodeForSchema,
  normalizeNodesForSchema,
} from "./normalize";
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
  DesignDocument,
  DocumentAsset,
  EmptyNodeDocument,
  GroupNodeDocument,
  ImageMimeTypeDocument,
  ImageNodeDocument,
  LocalFontDocument,
  NodeDocument,
  PathNodeDocument,
  RasterAssetDocument,
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
  imageMimeTypeSchema,
  imageNodeSchema,
  localFontSchema,
  nodeSchema,
  pathNodeSchema,
  rasterAssetSchema,
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
export {
  extractEmbeddedDocumentJson,
  parseEmbeddedDesignDocument,
} from "./svg-embedded-document";
export { canonicalizeTreeOrder, findParentCycleIds } from "./tree-order";
export {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
  VECTOR_STROKE_LINE_CAP_VALUES,
  VECTOR_STROKE_LINE_JOIN_VALUES,
} from "./vector-stroke-style";
