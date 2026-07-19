import { createPunchPackage, decodeDataUrl } from "@punchpress/punch-schema";

/**
 * Main-thread client for the package worker. Callers resolve the editor's
 * raster asset bytes up front (after flushing pending worker encodes) and
 * hand them over with the serialized document; the zip work happens
 * off-thread. Falls back to synchronous packaging when workers are
 * unavailable (headless, save-on-quit teardown).
 */

export interface PunchPackageAssetPayload {
  bytes?: Uint8Array;
  dataUrl?: string;
  mimeType: string;
  ref: string;
}

interface PendingPackage {
  reject: (error: Error) => void;
  resolve: (bytes: Uint8Array) => void;
}

let worker: Worker | null = null;
let workerFailed = false;
let nextRequestId = 0;
const pendingPackages = new Map<number, PendingPackage>();

const failAllPending = (message: string) => {
  workerFailed = true;

  for (const pending of pendingPackages.values()) {
    pending.reject(new Error(message));
  }

  pendingPackages.clear();
  worker?.terminate();
  worker = null;
};

const getWorker = () => {
  if (worker || workerFailed || typeof Worker === "undefined") {
    return worker;
  }

  try {
    worker = new Worker(new URL("./punch-package-worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    workerFailed = true;
    return null;
  }

  worker.onmessage = (event: MessageEvent) => {
    const { bytes, error, id } = event.data as {
      bytes?: Uint8Array;
      error?: string;
      id: number;
    };
    const pending = pendingPackages.get(id);

    if (!pending) {
      return;
    }

    pendingPackages.delete(id);

    if (bytes) {
      pending.resolve(bytes);
    } else {
      pending.reject(new Error(error || "Punch package worker failed."));
    }
  };
  worker.onerror = () => failAllPending("Punch package worker crashed.");
  worker.onmessageerror = () =>
    failAllPending("Punch package worker message failed.");
  return worker;
};

/**
 * Every raster asset payload the serialized document's manifests reference,
 * resolved from the editor's asset store. Flush pending encodes first so the
 * worker-encoded bytes are what persists. Entries the store holds as
 * not-yet-decoded data URLs pass through as-is — the base64→byte decode
 * happens in the package worker, not here.
 */
export const collectRasterAssetPayloads = (
  editor
): PunchPackageAssetPayload[] => {
  const payloads: PunchPackageAssetPayload[] = [];

  for (const node of editor.nodes || []) {
    if (node.type !== "image") {
      continue;
    }

    for (const tileSource of node.tileSources || []) {
      const entry = editor.rasterAssets?.get(tileSource.ref);

      if (!entry) {
        continue;
      }

      if (entry.bytes) {
        payloads.push({
          bytes: entry.bytes,
          mimeType: entry.mimeType,
          ref: tileSource.ref,
        });
        continue;
      }

      const dataUrl = editor.rasterAssets.getDataUrl(tileSource.ref);

      if (dataUrl) {
        payloads.push({
          dataUrl,
          mimeType: entry.mimeType,
          ref: tileSource.ref,
        });
      }
    }
  }

  return payloads;
};

/**
 * Package a serialized document off the main thread. Asset byte buffers are
 * structured-cloned to the worker (the asset store keeps its copies); the
 * package bytes transfer back.
 */
export const createPunchPackageBytes = (
  contents: string,
  assets: PunchPackageAssetPayload[]
): Promise<Uint8Array> => {
  const packageWorker = getWorker();

  if (!packageWorker) {
    const assetsByRef = new Map(assets.map((asset) => [asset.ref, asset]));

    return Promise.resolve(
      createPunchPackage(contents, {
        getAssetBytes: (ref) => {
          const asset = assetsByRef.get(ref);

          if (!asset) {
            return null;
          }

          asset.bytes ??= asset.dataUrl
            ? decodeDataUrl(asset.dataUrl).bytes
            : undefined;
          return asset.bytes
            ? { bytes: asset.bytes, mimeType: asset.mimeType }
            : null;
        },
      })
    );
  }

  nextRequestId += 1;

  const id = nextRequestId;
  const promise = new Promise<Uint8Array>((resolve, reject) => {
    pendingPackages.set(id, { reject, resolve });
  });

  packageWorker.postMessage({ assets, contents, id });
  return promise;
};
