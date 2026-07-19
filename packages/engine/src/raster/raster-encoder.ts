import { hasRasterPngCodec } from "./raster-png";

/**
 * Main-thread client for the raster encode worker. Commit chunks copy tile
 * sub-rect pixels (already budgeted) and post them here; the PNG filter +
 * deflate + container work happens off-thread and resolves to encoded bytes.
 *
 * Unavailable in headless runtimes (no Worker/CompressionStream) and after a
 * worker error; callers fall back to the synchronous toDataURL path.
 */

type PendingEncode = {
  reject: (error: Error) => void;
  resolve: (bytes: Uint8Array) => void;
};

let worker: Worker | null = null;
let workerFailed = false;
let nextRequestId = 0;
const pendingEncodes = new Map<number, PendingEncode>();

const failAllPending = (message: string) => {
  workerFailed = true;

  for (const pending of pendingEncodes.values()) {
    pending.reject(new Error(message));
  }

  pendingEncodes.clear();
  worker?.terminate();
  worker = null;
};

const getWorker = () => {
  if (worker || workerFailed) {
    return worker;
  }

  try {
    worker = new Worker(new URL("./raster-encode-worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    workerFailed = true;
    return null;
  }

  worker.onmessage = (event: MessageEvent) => {
    const { bytes, error, id } = event.data as {
      bytes?: ArrayBuffer;
      error?: string;
      id: number;
    };
    const pending = pendingEncodes.get(id);

    if (!pending) {
      return;
    }

    pendingEncodes.delete(id);

    if (bytes) {
      pending.resolve(new Uint8Array(bytes));
    } else {
      pending.reject(new Error(error || "Raster encode worker failed."));
    }
  };
  worker.onerror = () => {
    failAllPending("Raster encode worker crashed.");
  };
  worker.onmessageerror = () => {
    failAllPending("Raster encode worker message failed.");
  };
  return worker;
};

export const isWorkerTileEncodeAvailable = () =>
  !workerFailed &&
  typeof Worker !== "undefined" &&
  typeof window !== "undefined" &&
  hasRasterPngCodec();

/**
 * Encode straight-alpha RGBA tile pixels to PNG bytes in the worker. A copy
 * of the pixel buffer is transferred so the caller keeps its own pixels for
 * the synchronous materialization fallback.
 */
export const encodeTilePixelsInWorker = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): Promise<Uint8Array> | null => {
  if (!isWorkerTileEncodeAvailable()) {
    return null;
  }

  const encodeWorker = getWorker();

  if (!encodeWorker) {
    return null;
  }

  nextRequestId += 1;

  const id = nextRequestId;
  const promise = new Promise<Uint8Array>((resolve, reject) => {
    pendingEncodes.set(id, { reject, resolve });
  });

  const transferPixels = pixels.buffer.slice(
    pixels.byteOffset,
    pixels.byteOffset + pixels.byteLength
  );

  encodeWorker.postMessage({ height, id, pixels: transferPixels, width }, [
    transferPixels,
  ]);
  return promise;
};
