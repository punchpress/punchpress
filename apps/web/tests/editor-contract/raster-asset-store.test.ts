import { describe, expect, test } from "bun:test";
import { encodeDataUrl } from "@punchpress/punch-schema";
import { RasterAssetStore } from "../../../../packages/engine/src/raster/raster-asset-store";

const createBytes = (length: number, seed = 7) => {
  const bytes = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    bytes[index] = (index * seed + 3) % 256;
  }

  return bytes;
};

const BLOB_URL_PATTERN = /^blob:/;

const canCreateObjectUrls =
  typeof URL !== "undefined" && typeof URL.createObjectURL === "function";

describe("RasterAssetStore", () => {
  test("round-trips bytes and mime type by ref", () => {
    const store = new RasterAssetStore();
    const bytes = createBytes(4096);

    store.put("assets/raster/node-1/tiles/1_0_0.png", bytes, "image/png");

    expect(store.has("assets/raster/node-1/tiles/1_0_0.png")).toBe(true);
    expect(store.has("assets/raster/node-1/tiles/1_0_1.png")).toBe(false);

    const entry = store.get("assets/raster/node-1/tiles/1_0_0.png");

    expect(entry?.mimeType).toBe("image/png");
    expect(entry?.bytes).toEqual(bytes);
  });

  test("data URLs round-trip the stored bytes", () => {
    const store = new RasterAssetStore();
    const bytes = createBytes(257);

    store.put("ref-a", bytes, "image/png");

    const dataUrl = store.getDataUrl("ref-a");

    expect(dataUrl?.startsWith("data:image/png;base64,")).toBe(true);
    expect(store.getDataUrl("missing-ref")).toBeNull();

    const decoded = Uint8Array.from(
      atob(dataUrl?.slice("data:image/png;base64,".length) || ""),
      (char) => char.charCodeAt(0)
    );

    expect(decoded).toEqual(bytes);
  });

  test("putDataUrl defers decode until getBytes, then caches the decoded array", () => {
    const store = new RasterAssetStore();
    const bytes = createBytes(512);
    const dataUrl = encodeDataUrl(bytes, "image/png");

    store.putDataUrl("ref-a", dataUrl, "image/png");

    expect(store.has("ref-a")).toBe(true);
    // The entry holds the raw data URL until something asks for bytes.
    expect(store.get("ref-a")?.bytes).toBeUndefined();
    expect(store.get("ref-a")?.dataUrl).toBe(dataUrl);

    const firstBytes = store.getBytes("ref-a");

    expect(firstBytes).toEqual(bytes);

    const secondBytes = store.getBytes("ref-a");

    // Second access returns the same cached array, not a fresh decode.
    expect(secondBytes).toBe(firstBytes);
    expect(store.getBytes("missing-ref")).toBeNull();
  });

  test("getDataUrl returns the stored data URL for a dataUrl-only entry with no decode", () => {
    const store = new RasterAssetStore();
    const bytes = createBytes(128, 3);
    const dataUrl = encodeDataUrl(bytes, "image/png");

    store.putDataUrl("ref-a", dataUrl, "image/png");

    expect(store.getDataUrl("ref-a")).toBe(dataUrl);
    // Reading the data URL must not have triggered a decode.
    expect(store.get("ref-a")?.bytes).toBeUndefined();
  });

  // Object-URL behavior is guarded: it only runs where the runtime provides
  // URL.createObjectURL (Bun does; a bare headless runtime may not).
  test.if(canCreateObjectUrls)(
    "object URLs are lazily created, cached, and released",
    () => {
      const store = new RasterAssetStore();

      store.put("ref-a", createBytes(64), "image/png");

      expect(store.getObjectUrl("missing-ref")).toBeNull();

      const firstUrl = store.getObjectUrl("ref-a");

      expect(firstUrl).toMatch(BLOB_URL_PATTERN);
      expect(store.getObjectUrl("ref-a")).toBe(firstUrl);

      // Identical payloads share one decoded resource across refs.
      store.put("ref-same-bytes", createBytes(64), "image/png");
      expect(store.getObjectUrl("ref-same-bytes")).toBe(firstUrl);

      // Re-putting a ref with different bytes invalidates its cached URL.
      store.put("ref-a", createBytes(64, 11), "image/png");

      const secondUrl = store.getObjectUrl("ref-a");

      expect(secondUrl).toMatch(BLOB_URL_PATTERN);
      expect(secondUrl).not.toBe(firstUrl);

      store.releaseAll();

      expect(store.has("ref-a")).toBe(false);
      expect(store.getObjectUrl("ref-a")).toBeNull();
      expect(store.size).toBe(0);
    }
  );

  test.if(canCreateObjectUrls)(
    "getObjectUrl decodes a dataUrl-only entry lazily and caches bytes",
    () => {
      const store = new RasterAssetStore();
      const bytes = createBytes(64, 5);
      const dataUrl = encodeDataUrl(bytes, "image/png");

      store.putDataUrl("ref-a", dataUrl, "image/png");
      expect(store.get("ref-a")?.bytes).toBeUndefined();

      const url = store.getObjectUrl("ref-a");

      expect(url).toMatch(BLOB_URL_PATTERN);
      // Resolving the object URL forced the decode, which is now cached.
      expect(store.get("ref-a")?.bytes).toEqual(bytes);
      expect(store.getObjectUrl("ref-a")).toBe(url);
    }
  );

  test("pending encodes resolve to the worker bytes and flush() awaits them", async () => {
    const store = new RasterAssetStore();
    const workerBytes = createBytes(96, 11);
    let resolveEncode: (bytes: Uint8Array) => void = () => undefined;
    const encodePromise = new Promise<Uint8Array>((resolve) => {
      resolveEncode = resolve;
    });

    store.putPending("ref-pending", "image/png", encodePromise, () => null);

    expect(store.has("ref-pending")).toBe(true);
    expect(store.hasPendingEncodes).toBe(true);
    // Render paths never force a main-thread encode for a pending ref.
    expect(store.getObjectUrl("ref-pending")).toBeNull();

    const flushed = store.flush();

    resolveEncode(workerBytes);
    await flushed;

    expect(store.hasPendingEncodes).toBe(false);
    expect(store.getBytes("ref-pending")).toEqual(workerBytes);
  });

  test("a sync consumer materializes a pending ref through the fallback encoder, and the first materialization wins", async () => {
    const store = new RasterAssetStore();
    const fallbackBytes = createBytes(48, 3);
    const fallbackDataUrl = encodeDataUrl(fallbackBytes, "image/png");
    let resolveEncode: (bytes: Uint8Array) => void = () => undefined;
    const encodePromise = new Promise<Uint8Array>((resolve) => {
      resolveEncode = resolve;
    });

    store.putPending(
      "ref-pending",
      "image/png",
      encodePromise,
      () => fallbackDataUrl
    );

    // Sync access cannot wait for the worker: it materializes now.
    expect(store.getBytes("ref-pending")).toEqual(fallbackBytes);

    // The worker result must not change the ref's payload afterwards.
    resolveEncode(createBytes(96, 11));
    await store.flush();

    expect(store.getBytes("ref-pending")).toEqual(fallbackBytes);
  });

  test("a failed worker encode falls back to the sync encoder", async () => {
    const store = new RasterAssetStore();
    const fallbackBytes = createBytes(32, 9);
    const fallbackDataUrl = encodeDataUrl(fallbackBytes, "image/png");

    store.putPending(
      "ref-pending",
      "image/png",
      Promise.reject(new Error("worker crashed")),
      () => fallbackDataUrl
    );

    await store.flush();

    expect(store.hasPendingEncodes).toBe(false);
    expect(store.getBytes("ref-pending")).toEqual(fallbackBytes);
  });
});
