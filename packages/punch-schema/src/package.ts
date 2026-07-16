import { PUNCH_DOCUMENT_MIME_TYPE } from "./constants";
import { decodeDataUrl, encodeDataUrl } from "./data-url";
import { parseDesignDocument } from "./load";
import { createRasterAssetRecord } from "./raster-assets";
import { serializeDesignDocument } from "./save";
import type {
  DesignDocument,
  ImageMimeTypeDocument,
  RasterAssetDocument,
} from "./schema";
import { createZipArchive, readZipArchive } from "./zip";

const MIMETYPE_PATH = "mimetype";
const DOCUMENT_PATH = "document.json";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type PunchPackageAssetBytes = {
  bytes: Uint8Array;
  mimeType: string;
};

export type CreatePunchPackageOptions = {
  getAssetBytes?: (ref: string) => PunchPackageAssetBytes | null | undefined;
};

type TileSourceDocument = NonNullable<
  Extract<DesignDocument["nodes"][number], { type: "image" }>["tileSources"]
>[number];

const getTileSourceBytes = (
  nodeId: string,
  tileSource: TileSourceDocument,
  getAssetBytes: CreatePunchPackageOptions["getAssetBytes"]
) => {
  const asset = getAssetBytes?.(tileSource.ref);

  if (asset) {
    return asset.bytes;
  }

  if (tileSource.src) {
    return decodeDataUrl(tileSource.src).bytes;
  }

  throw new Error(
    `Image node ${nodeId} is missing bytes for raster tile ${tileSource.ref}.`
  );
};

const stripRuntimeImageFields = (node: DesignDocument["nodes"][number]) => {
  if (node.type !== "image") {
    return node;
  }

  const {
    mimeType: _mimeType,
    src: _src,
    tileSources: _tileSources,
    ...packagedNode
  } = node;
  return packagedNode;
};

const getCurrentMimeType = (
  mimeType: string,
  fallback: ImageMimeTypeDocument
) => {
  return mimeType === "image/jpeg" || mimeType === "image/png"
    ? mimeType
    : fallback;
};

const createSingleRasterPackageEntry = (
  node: Extract<DesignDocument["nodes"][number], { type: "image" }>
) => {
  if (!node.src) {
    throw new Error(`Image node ${node.id} is missing raster source data.`);
  }

  const asset = createRasterAssetRecord(node);
  const { bytes, mimeType } = decodeDataUrl(node.src);
  const currentMimeType = getCurrentMimeType(mimeType, asset.currentMimeType);

  return {
    asset: {
      ...asset,
      currentMimeType,
      hasAlpha: currentMimeType !== "image/jpeg",
      originalMimeType: currentMimeType,
      preferredExportMimeType: currentMimeType,
    },
    entries: [
      {
        data: bytes,
        path: asset.ref,
      },
    ],
  };
};

const createTiledRasterPackageEntry = (
  node: Extract<DesignDocument["nodes"][number], { type: "image" }>,
  asset: RasterAssetDocument,
  getAssetBytes: CreatePunchPackageOptions["getAssetBytes"]
) => {
  if (asset.storage !== "tiled") {
    throw new Error("Expected a tiled raster asset.");
  }

  const tileSources = new Map(
    (node.tileSources || []).map((tileSource) => [tileSource.ref, tileSource])
  );
  const entries: Array<{ data: Uint8Array; path: string }> = [];

  if (asset.baseRef) {
    if (!node.src) {
      throw new Error(`Image node ${node.id} is missing raster base data.`);
    }

    entries.push({
      data: decodeDataUrl(node.src).bytes,
      path: asset.baseRef,
    });
  }

  for (const tile of asset.tiles) {
    const tileSource = tileSources.get(tile.ref);

    if (!tileSource) {
      throw new Error(`Image node ${node.id} is missing raster tile ${tile.ref}.`);
    }

    entries.push({
      data: getTileSourceBytes(node.id, tileSource, getAssetBytes),
      path: tile.ref,
    });
  }

  return {
    asset,
    entries,
  };
};

const createSparseTiledRasterPackageEntry = (
  node: Extract<DesignDocument["nodes"][number], { type: "image" }>,
  getAssetBytes: CreatePunchPackageOptions["getAssetBytes"]
) => {
  if (!node.src) {
    throw new Error(`Image node ${node.id} is missing raster base data.`);
  }

  const baseAsset = createRasterAssetRecord(node);
  const { bytes, mimeType } = decodeDataUrl(node.src);
  const currentMimeType = getCurrentMimeType(mimeType, baseAsset.currentMimeType);
  const baseRef = `assets/raster/${baseAsset.id}/base.${currentMimeType === "image/jpeg" ? "jpg" : "png"}`;
  const tileSources = node.tileSources || [];

  return {
    asset: {
      colorSpace: "srgb",
      currentMimeType: "image/png" as const,
      hasAlpha: true,
      height: baseAsset.height,
      id: baseAsset.id,
      kind: "raster" as const,
      name: baseAsset.name,
      originalMimeType: currentMimeType,
      preferredExportMimeType: currentMimeType,
      baseRef,
      storage: "tiled" as const,
      tileSize: 512,
      tiles: tileSources.map((tileSource) => ({
        col: tileSource.col,
        height: tileSource.height,
        mimeType: "image/png" as const,
        ref: tileSource.ref,
        row: tileSource.row,
        width: tileSource.width,
        x: tileSource.x,
        y: tileSource.y,
      })),
      width: baseAsset.width,
    },
    entries: [
      {
        data: bytes,
        path: baseRef,
      },
      ...tileSources.map((tileSource) => ({
        data: getTileSourceBytes(node.id, tileSource, getAssetBytes),
        path: tileSource.ref,
      })),
    ],
  };
};

export const isPunchPackageBytes = (contents: ArrayBuffer | Uint8Array) => {
  const bytes = contents instanceof Uint8Array ? contents : new Uint8Array(contents);

  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
};

export const createPunchPackage = (
  contents: string,
  { getAssetBytes }: CreatePunchPackageOptions = {}
) => {
  const document = parseDesignDocument(contents);
  const packageAssets: DesignDocument["assets"] = {};
  const assetEntries: Array<{ data: Uint8Array; path: string }> = [];
  const packagedNodes = document.nodes.map((node) => {
    if (node.type !== "image") {
      return node;
    }

    const existingAsset = document.assets[node.assetId];
    const packageEntry =
      existingAsset?.kind === "raster" && existingAsset.storage === "tiled"
        ? createTiledRasterPackageEntry(node, existingAsset, getAssetBytes)
        : node.tileSources?.length
          ? createSparseTiledRasterPackageEntry(node, getAssetBytes)
        : createSingleRasterPackageEntry(node);

    packageAssets[packageEntry.asset.id] = packageEntry.asset;
    assetEntries.push(...packageEntry.entries);

    return stripRuntimeImageFields(node);
  });
  const packageDocument = {
    assets: packageAssets,
    nodes: packagedNodes,
    version: document.version,
  };

  return createZipArchive([
    {
      data: textEncoder.encode(PUNCH_DOCUMENT_MIME_TYPE),
      path: MIMETYPE_PATH,
    },
    {
      data: textEncoder.encode(
        serializeDesignDocument(packageDocument as DesignDocument)
      ),
      path: DOCUMENT_PATH,
    },
    ...assetEntries,
  ]);
};

export const loadPunchPackageContents = (
  contents: ArrayBuffer | Uint8Array
) => {
  const bytes = contents instanceof Uint8Array ? contents : new Uint8Array(contents);
  const entries = readZipArchive(bytes);
  const mimetype = entries.get(MIMETYPE_PATH);

  if (mimetype && textDecoder.decode(mimetype) !== PUNCH_DOCUMENT_MIME_TYPE) {
    throw new Error("File is not a PunchPress document package.");
  }

  const documentEntry = entries.get(DOCUMENT_PATH);

  if (!documentEntry) {
    throw new Error("Punch package is missing document.json.");
  }

  const document = parseDesignDocument(textDecoder.decode(documentEntry));
  const hydratedNodes = document.nodes.map((node) => {
    if (node.type !== "image") {
      return node;
    }

    const asset = document.assets[node.assetId];

    if (asset?.kind !== "raster") {
      throw new Error(`Image node ${node.id} references a missing raster asset.`);
    }

    if (asset.storage === "tiled") {
      const baseEntry = asset.baseRef ? entries.get(asset.baseRef) : null;

      if (asset.baseRef && !baseEntry) {
        throw new Error(`Punch package is missing raster asset ${asset.baseRef}.`);
      }

      return {
        ...node,
        mimeType: asset.currentMimeType,
        src: baseEntry
          ? encodeDataUrl(baseEntry, asset.originalMimeType)
          : undefined,
        tileSources: asset.tiles.map((tile) => {
          const assetEntry = entries.get(tile.ref);

          if (!assetEntry) {
            throw new Error(`Punch package is missing raster asset ${tile.ref}.`);
          }

          return {
            col: tile.col,
            height: tile.height,
            ref: tile.ref,
            row: tile.row,
            src: encodeDataUrl(
              assetEntry,
              tile.mimeType || asset.currentMimeType
            ),
            width: tile.width,
            x: tile.x,
            y: tile.y,
          };
        }),
      };
    }

    const assetEntry = entries.get(asset.ref);

    if (!assetEntry) {
      throw new Error(`Punch package is missing raster asset ${asset.ref}.`);
    }

    return {
      ...node,
      mimeType: asset.currentMimeType,
      src: encodeDataUrl(assetEntry, asset.currentMimeType),
    };
  });

  return serializeDesignDocument({
    ...document,
    nodes: hydratedNodes,
  });
};
