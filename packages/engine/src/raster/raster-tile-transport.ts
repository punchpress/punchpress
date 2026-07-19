import type { RasterAssetStore } from "./raster-asset-store";

/**
 * Tile pixels travel through interchange forms (loaded documents, hydrated
 * package contents, clipboard payloads) as inline `src` data URLs on tile
 * manifest entries. Editor state never holds those payloads: absorbing an
 * inbound payload moves the bytes into the raster asset store and strips the
 * `src`, and inlining materializes a self-contained payload back out of the
 * store for transports that must outlive this session's object URLs.
 */

type TransportTileSource = {
  ref: string;
  src?: string;
  [key: string]: unknown;
};

type TransportNode = {
  type?: string;
  tileSources?: TransportTileSource[];
  [key: string]: unknown;
};

export const absorbInlineTileSources = <Node extends TransportNode>(
  assets: RasterAssetStore,
  nodes: Node[]
): Node[] => {
  return nodes.map((node) => {
    if (node.type !== "image" || !node.tileSources?.length) {
      return node;
    }

    if (!node.tileSources.some((tileSource) => tileSource.src)) {
      return node;
    }

    return {
      ...node,
      tileSources: node.tileSources.map((tileSource) => {
        if (!tileSource.src) {
          return tileSource;
        }

        if (!assets.has(tileSource.ref)) {
          // Store the payload as-is: document load absorbs thousands of
          // tiles, and the base64→byte decode defers to first access
          // (save/export on the worker side, or tile hydration).
          const mimeType =
            /^data:([^;,]+)/.exec(tileSource.src)?.[1] || "image/png";

          assets.putDataUrl(tileSource.ref, tileSource.src, mimeType);
        }

        const { src: _src, ...manifestTileSource } = tileSource;

        return manifestTileSource;
      }),
    };
  });
};

export const inlineTileSources = <Node extends TransportNode>(
  assets: RasterAssetStore,
  nodes: Node[]
): Node[] => {
  return nodes.map((node) => {
    if (node.type !== "image" || !node.tileSources?.length) {
      return node;
    }

    return {
      ...node,
      tileSources: node.tileSources.map((tileSource) => {
        if (tileSource.src) {
          return tileSource;
        }

        const dataUrl = assets.getDataUrl(tileSource.ref);

        return dataUrl ? { ...tileSource, src: dataUrl } : tileSource;
      }),
    };
  });
};
