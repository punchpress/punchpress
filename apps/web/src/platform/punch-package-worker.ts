import { createPunchPackage, decodeDataUrl } from "@punchpress/punch-schema";

/**
 * Package worker: zips a serialized document plus resolved raster asset
 * bytes into a .punch package off the main thread. Packaging is pure TS
 * (zip + manifest projection) and was landing multi-second synchronous
 * frames on autosave once fully-brushed documents reached thousands of tile
 * payloads.
 */

interface PackageRequest {
  assets: Array<{
    bytes?: Uint8Array;
    dataUrl?: string;
    mimeType: string;
    ref: string;
  }>;
  contents: string;
  id: number;
}

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<PackageRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

scope.onmessage = (event) => {
  const { assets, contents, id } = event.data;

  try {
    const assetsByRef = new Map(assets.map((asset) => [asset.ref, asset]));
    const bytes = createPunchPackage(contents, {
      getAssetBytes: (ref) => {
        const asset = assetsByRef.get(ref);

        if (!asset) {
          return null;
        }

        // Not-yet-decoded data URL entries decode here, off the main thread.
        asset.bytes ??= asset.dataUrl
          ? decodeDataUrl(asset.dataUrl).bytes
          : undefined;
        return asset.bytes
          ? { bytes: asset.bytes, mimeType: asset.mimeType }
          : null;
      },
    });

    scope.postMessage({ bytes, id }, [bytes.buffer]);
  } catch (error) {
    scope.postMessage({
      error: error instanceof Error ? error.message : String(error),
      id,
    });
  }
};
