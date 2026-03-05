import { useMemo } from "react";
import { getLoadedFont } from "../editor/font-cache";
import { buildNodeGeometry, estimateBounds } from "../editor/warp-engine";

export const useNodeGeometries = (fontCacheRef, fontRevision, nodes) => {
  const geometries = useMemo(() => {
    return nodes.map((node) => {
      const font = getLoadedFont(node.fontUrl, fontCacheRef, fontRevision);

      if (!font) {
        return {
          id: node.id,
          paths: [],
          bbox: estimateBounds(node),
          ready: false,
        };
      }

      const geometry = buildNodeGeometry(node, font);
      return {
        id: node.id,
        paths: geometry.paths,
        bbox: geometry.bbox,
        ready: geometry.ready,
      };
    });
  }, [fontCacheRef, fontRevision, nodes]);

  return useMemo(() => {
    return new Map(geometries.map((geometry) => [geometry.id, geometry]));
  }, [geometries]);
};
