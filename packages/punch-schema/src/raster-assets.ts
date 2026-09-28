import { createRasterAssetId } from "./normalize";
import type {
  DesignDocument,
  ImageMimeTypeDocument,
  RasterAssetDocument,
} from "./schema";

const DATA_URL_MIME_TYPE_PATTERN = /^data:([^;,]+)/;

export const getImageMimeTypeFromDataUrl = (
  src: unknown
): ImageMimeTypeDocument | null => {
  if (typeof src !== "string") {
    return null;
  }

  const mimeType = DATA_URL_MIME_TYPE_PATTERN.exec(src)?.[1];

  return mimeType === "image/jpeg" || mimeType === "image/png"
    ? mimeType
    : null;
};

const getImageMimeType = (node: Record<string, unknown>) => {
  return node.mimeType === "image/jpeg" || node.mimeType === "image/png"
    ? node.mimeType
    : getImageMimeTypeFromDataUrl(node.src) || "image/png";
};

const getRasterAssetExtension = (mimeType: ImageMimeTypeDocument) => {
  return mimeType === "image/jpeg" ? "jpg" : "png";
};

export const createRasterAssetRecord = (
  node: Record<string, unknown>
): RasterAssetDocument => {
  const assetId =
    typeof node.assetId === "string" && node.assetId.length > 0
      ? node.assetId
      : createRasterAssetId(String(node.id || "image"));
  const mimeType = getImageMimeType(node);

  return {
    colorSpace: "srgb",
    currentMimeType: mimeType,
    hasAlpha: mimeType !== "image/jpeg",
    height:
      typeof node.pixelHeight === "number"
        ? node.pixelHeight
        : typeof node.height === "number"
          ? node.height
          : 1,
    id: assetId,
    kind: "raster",
    name:
      typeof node.name === "string" && node.name.length > 0
        ? node.name
        : "Image",
    originalMimeType: mimeType,
    preferredExportMimeType: mimeType,
    ref: `assets/raster/${assetId}.${getRasterAssetExtension(mimeType)}`,
    storage: "single",
    width:
      typeof node.pixelWidth === "number"
        ? node.pixelWidth
        : typeof node.width === "number"
          ? node.width
          : 1,
  };
};

export const createDocumentAssetsFromNodes = (
  nodes: readonly Record<string, unknown>[],
  existingAssets: DesignDocument["assets"] | Record<string, unknown> = {}
) => {
  const assets = { ...existingAssets } as DesignDocument["assets"];

  for (const node of nodes) {
    if (node.type !== "image") {
      continue;
    }

    const assetId =
      typeof node.assetId === "string" && node.assetId.length > 0
        ? node.assetId
        : createRasterAssetId(String(node.id || "image"));

    if (!assets[assetId]) {
      assets[assetId] = createRasterAssetRecord({
        ...node,
        assetId,
      });
    }
  }

  return assets;
};
