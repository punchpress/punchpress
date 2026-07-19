import { decodeDataUrl, encodeDataUrl } from "@punchpress/punch-schema";

export type RasterAssetEntry = {
  bytes?: Uint8Array;
  dataUrl?: string;
  mimeType: string;
  /**
   * In-flight worker encode. The manifest ref exists as soon as the commit
   * chunk posts the pixels; bytes land when the worker responds. A sync
   * consumer that cannot wait (clipboard/export mid-encode) calls
   * `materialize` — the synchronous fallback encoder over the retained
   * pixels — and the first materialization wins so a ref always resolves to
   * one stable payload.
   */
  pending?: {
    materialize: () => string | null;
  };
};

const canCreateObjectUrls = () =>
  typeof URL !== "undefined" &&
  typeof URL.createObjectURL === "function" &&
  typeof Blob !== "undefined";

/**
 * Two independent FNV-1a passes plus the byte length: cheap enough to run
 * lazily on first URL resolution, and collision-safe in practice for
 * per-document tile counts.
 */
const getContentKey = (bytes: Uint8Array, mimeType: string) => {
  let firstHash = 0x811c9dc5;
  let secondHash = 0x811c9dc5 ^ 0x5bd1e995;

  for (const byte of bytes) {
    firstHash = Math.imul(firstHash ^ byte, 0x01000193) >>> 0;
    secondHash =
      Math.imul(secondHash ^ ((byte + 0x9e) & 0xff), 0x01000193) >>> 0;
  }

  return `${mimeType}:${bytes.length}:${firstHash.toString(36)}:${secondHash.toString(36)}`;
};

/**
 * Editor-owned byte store for encoded raster tile payloads. Node state holds
 * only tile manifests (refs plus rects); the bytes behind each ref live here,
 * outside zustand state and history snapshots.
 *
 * Entries are append-only for the session: history entries reference refs, so
 * undo/redo can always re-resolve pixels. The store only empties on document
 * load (or editor disposal), when no manifest can reference the old refs.
 */
export class RasterAssetStore {
  private entries = new Map<
    string,
    RasterAssetEntry & { contentKey?: string }
  >();
  private refUrls = new Map<string, string>();
  private contentUrls = new Map<string, string>();
  private pendingCount = 0;
  private pendingWaiters: Array<() => void> = [];

  put(ref: string, bytes: Uint8Array, mimeType: string) {
    // Object URLs may be shared across refs with identical payloads, so an
    // overwrite only drops this ref's resolution; the shared URLs themselves
    // are revoked at releaseAll.
    this.refUrls.delete(ref);
    this.entries.set(ref, { bytes, mimeType });
  }

  /**
   * Store an encoded tile as a not-yet-decoded data URL. Commit paths call
   * this instead of put(): nothing needs decoded bytes at commit time (they
   * are consumed at save/export), so the base64→byte decode is deferred to
   * first access via getBytes()/getObjectUrl() rather than paid on the
   * frame-budgeted drag path.
   */
  putDataUrl(ref: string, dataUrl: string, mimeType: string) {
    this.refUrls.delete(ref);
    this.entries.set(ref, { dataUrl, mimeType });
  }

  /**
   * Register a ref whose PNG bytes are being encoded off-thread. The entry
   * resolves like any other once `encodePromise` lands; until then a sync
   * accessor materializes through the fallback encoder. Save/export flows
   * call `flush()` first so the worker bytes (not the fallback) are what
   * persists.
   */
  putPending(
    ref: string,
    mimeType: string,
    encodePromise: Promise<Uint8Array>,
    materialize: () => string | null
  ) {
    this.refUrls.delete(ref);

    const entry: RasterAssetEntry & { contentKey?: string } = {
      mimeType,
      pending: { materialize },
    };

    this.entries.set(ref, entry);
    this.pendingCount += 1;

    const settle = () => {
      this.pendingCount -= 1;

      if (this.pendingCount === 0) {
        const waiters = this.pendingWaiters;

        this.pendingWaiters = [];

        for (const waiter of waiters) {
          waiter();
        }
      }
    };

    encodePromise.then(
      (bytes) => {
        // A sync consumer may have materialized meanwhile; first successful
        // materialization wins so the ref's payload never changes identity.
        // A failed materialization (retention cap) leaves the entry empty,
        // and the worker bytes still land.
        if (
          this.entries.get(ref) === entry &&
          !(entry.bytes || entry.dataUrl)
        ) {
          entry.bytes = bytes;
          entry.pending = undefined;
        }

        settle();
      },
      () => {
        // Worker failure: fall back to the synchronous encoder so the ref
        // still resolves.
        if (this.entries.get(ref) === entry && entry.pending) {
          this.materializePendingEntry(entry);
        }

        settle();
      }
    );
  }

  private materializePendingEntry(entry: RasterAssetEntry) {
    if (!entry.pending) {
      return;
    }

    const dataUrl = entry.pending.materialize();

    entry.pending = undefined;

    if (dataUrl) {
      entry.dataUrl = dataUrl;
    }
  }

  get hasPendingEncodes() {
    return this.pendingCount > 0;
  }

  /** Resolves once every in-flight encode has landed. Save must await this. */
  flush(): Promise<void> {
    if (this.pendingCount === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.pendingWaiters.push(resolve);
    });
  }

  get(ref: string): RasterAssetEntry | null {
    return this.entries.get(ref) || null;
  }

  has(ref: string) {
    return this.entries.has(ref);
  }

  get size() {
    return this.entries.size;
  }

  /**
   * Cached decoded bytes for a ref. Decodes lazily from a stored data URL on
   * first access and caches the result on the entry; a ref stored via put()
   * already has bytes and returns them with no decode. Null for unknown refs.
   */
  getBytes(ref: string): Uint8Array | null {
    const entry = this.entries.get(ref);

    if (!entry) {
      return null;
    }

    if (entry.pending) {
      this.materializePendingEntry(entry);
    }

    if (!entry.bytes) {
      if (!entry.dataUrl) {
        return null;
      }

      entry.bytes = decodeDataUrl(entry.dataUrl).bytes;
    }

    return entry.bytes;
  }

  /**
   * Lazily created, cached object URL for a ref's bytes. URLs are deduped by
   * byte content, so refs with identical payloads share one decoded resource
   * — thousands of DOM fallback tiles must not force thousands of decodes.
   * Null when the ref is unknown or the runtime has no object-URL support
   * (headless).
   */
  getObjectUrl(ref: string) {
    const cachedUrl = this.refUrls.get(ref);

    if (cachedUrl) {
      return cachedUrl;
    }

    const entry = this.entries.get(ref);

    if (!(entry && canCreateObjectUrls())) {
      return null;
    }

    // Render paths must not force a main-thread encode: a pending ref simply
    // has no URL yet (the store surface renders the merged tile meanwhile).
    if (entry.pending) {
      return null;
    }

    const bytes = this.getBytes(ref);

    if (!bytes) {
      return null;
    }

    entry.contentKey ??= getContentKey(bytes, entry.mimeType);

    let url = this.contentUrls.get(entry.contentKey);

    if (!url) {
      url = URL.createObjectURL(new Blob([bytes], { type: entry.mimeType }));
      this.contentUrls.set(entry.contentKey, url);
    }

    this.refUrls.set(ref, url);
    return url;
  }

  /**
   * Data URL for a ref's bytes, for self-contained payloads (clipboard,
   * export markup) that must outlive this session's object URLs. Returns the
   * stored data URL directly (no decode) when the entry hasn't been decoded
   * yet.
   */
  getDataUrl(ref: string) {
    const entry = this.entries.get(ref);

    if (!entry) {
      return null;
    }

    if (entry.pending) {
      this.materializePendingEntry(entry);
    }

    if (entry.dataUrl) {
      return entry.dataUrl;
    }

    return entry.bytes ? encodeDataUrl(entry.bytes, entry.mimeType) : null;
  }

  releaseAll() {
    for (const url of this.contentUrls.values()) {
      URL.revokeObjectURL(url);
    }

    this.refUrls.clear();
    this.contentUrls.clear();
    this.entries.clear();
  }
}
