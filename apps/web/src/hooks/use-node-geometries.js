import { useMemo, useRef } from "react";
import { getLoadedFont } from "../editor/font-cache";
import { buildNodeGeometry, estimateBounds } from "../editor/warp-engine";

const getGeometrySignature = (node, fontRevision) => {
  return JSON.stringify({
    fontRevision,
    fontSize: node.fontSize,
    fontUrl: node.fontUrl,
    strokeWidth: node.strokeWidth,
    text: node.text,
    tracking: node.tracking,
    warp: node.warp,
  });
};

const getFallbackGeometry = (node) => {
  return {
    id: node.id,
    paths: [],
    bbox: estimateBounds(node),
    ready: false,
  };
};

export const useNodeGeometries = (fontCacheRef, fontRevision, nodes) => {
  const cacheRef = useRef(new Map());

  const geometries = useMemo(() => {
    const nextCache = new Map();

    const nextGeometries = nodes.map((node) => {
      const signature = getGeometrySignature(node, fontRevision);
      const cached = cacheRef.current.get(node.id);

      if (cached?.signature === signature) {
        nextCache.set(node.id, cached);
        return cached.geometry;
      }

      const font = getLoadedFont(node.fontUrl, fontCacheRef, fontRevision);

      if (!font) {
        if (cached?.geometry?.ready) {
          nextCache.set(node.id, cached);
          return cached.geometry;
        }

        const fallbackGeometry = getFallbackGeometry(node);
        nextCache.set(node.id, { geometry: fallbackGeometry, signature });
        return fallbackGeometry;
      }

      const builtGeometry = buildNodeGeometry(node, font);
      if (!builtGeometry.ready && cached?.geometry?.ready) {
        nextCache.set(node.id, cached);
        return cached.geometry;
      }

      const geometry = {
        id: node.id,
        paths: builtGeometry.paths,
        bbox: builtGeometry.bbox,
        ready: builtGeometry.ready,
      };

      nextCache.set(node.id, { geometry, signature });
      return geometry;
    });

    cacheRef.current = nextCache;
    return nextGeometries;
  }, [fontCacheRef, fontRevision, nodes]);

  return useMemo(() => {
    return new Map(geometries.map((geometry) => [geometry.id, geometry]));
  }, [geometries]);
};
