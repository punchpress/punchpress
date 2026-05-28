const MAGNIFIC_SEARCH_LIMIT = 48;
export const ASSET_FORMAT_PREFERENCE = ["svg", "png", "jpg"] as const;

export type AssetFormat = (typeof ASSET_FORMAT_PREFERENCE)[number];

export interface MagnificAsset {
  id: string | number;
  image?: {
    source?: {
      url?: string;
    };
    type?: string;
  };
  meta?: {
    available_formats?: Record<string, unknown>;
  };
  title?: string;
}

export interface MagnificAssetSearchResult {
  data: MagnificAsset[];
  meta?: {
    current_page?: number;
    last_page?: number;
    total?: number;
  };
}

export interface ImportedAsset {
  dataUrl?: string;
  format: AssetFormat;
  mimeType?: "image/jpeg" | "image/png";
  svg?: string;
}

export const getMagnificAssetFormats = (asset: MagnificAsset) => {
  return Object.keys(asset.meta?.available_formats ?? {});
};

export const hasMagnificSvgFormat = (asset: MagnificAsset) => {
  return getMagnificAssetFormats(asset).includes("svg");
};

export const getMagnificPreferredAssetFormat = (
  asset: MagnificAsset
): AssetFormat | null => {
  const formats = getMagnificAssetFormats(asset);

  return (
    ASSET_FORMAT_PREFERENCE.find((format) => formats.includes(format)) ?? null
  );
};

export const searchMagnificAssets = async (
  term: string,
  page = 1
): Promise<MagnificAssetSearchResult> => {
  const params = new URLSearchParams({
    limit: String(MAGNIFIC_SEARCH_LIMIT),
    page: String(page),
    term,
  });

  for (const format of ASSET_FORMAT_PREFERENCE) {
    params.append("filters[formats][]", format);
  }

  const response = await fetch(`/api/assets/magnific/search?${params}`);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      response.status === 501
        ? "Asset search is not configured."
        : `Asset search failed with HTTP ${response.status}`
    );
  }

  return {
    data: Array.isArray(body.data) ? body.data : [],
    meta: body.meta,
  };
};

export const importMagnificAsset = async (
  assetId: string | number,
  format: AssetFormat
) => {
  const response = await fetch(
    `/api/assets/magnific/import/${encodeURIComponent(String(assetId))}/${format}`
  );
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      response.status === 501
        ? "Asset import is not configured."
        : `Asset import failed with HTTP ${response.status}`
    );
  }

  if (format === "svg" && typeof body.data?.svg !== "string") {
    throw new Error("Asset provider returned no SVG content.");
  }

  if (format !== "svg" && typeof body.data?.dataUrl !== "string") {
    throw new Error("Asset provider returned no image content.");
  }

  return {
    dataUrl: body.data?.dataUrl,
    format,
    mimeType: body.data?.mimeType,
    svg: body.data?.svg,
  } satisfies ImportedAsset;
};

export type Asset = MagnificAsset;
export type AssetSearchResult = MagnificAssetSearchResult;
export const getAssetFormats = getMagnificAssetFormats;
export const getPreferredAssetFormat = getMagnificPreferredAssetFormat;
export const hasSvgFormat = hasMagnificSvgFormat;
export const importAsset = importMagnificAsset;
export const searchAssets = searchMagnificAssets;
