import { encodePngRgba } from "./raster-png";

/**
 * Dedicated encode worker: receives raw tile pixels, returns PNG bytes. No
 * canvas APIs at all — main-thread toDataURL burns the frame budget, and the
 * async canvas encode family (toBlob/convertToBlob, DOM or OffscreenCanvas)
 * intermittently kills the Chromium renderer when several same-origin pages
 * encode large commits concurrently, which the raster e2e suite exercises
 * directly.
 */

type EncodeRequest = {
  height: number;
  id: number;
  pixels: ArrayBuffer;
  width: number;
};

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<EncodeRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

scope.onmessage = async (event) => {
  const { height, id, pixels, width } = event.data;

  try {
    const bytes = await encodePngRgba(
      new Uint8Array(pixels),
      width,
      height
    );

    scope.postMessage({ bytes: bytes.buffer, id }, [bytes.buffer]);
  } catch (error) {
    scope.postMessage({
      error: error instanceof Error ? error.message : String(error),
      id,
    });
  }
};
