import {
  buildNodeGeometry,
  estimateBounds,
} from "../shapes/warp-text/warp-engine";

const getGeometrySignature = (node, fontRevision) => {
  return JSON.stringify({
    fontRevision,
    font: node.font,
    fontSize: node.fontSize,
    strokeWidth: node.strokeWidth,
    text: node.text,
    tracking: node.tracking,
    warp: node.warp,
  });
};

const getFallbackGeometry = (node) => {
  return {
    bbox: estimateBounds(node),
    id: node.id,
    paths: [],
    ready: false,
  };
};

export class GeometryManager {
  constructor(fontManager) {
    this.fontManager = fontManager;
    this.cache = new Map();
    this.lastNodes = null;
    this.lastRevision = -1;
    this.lastGeometryById = new Map();
  }

  getAll(nodes, fontRevision) {
    if (this.lastNodes === nodes && this.lastRevision === fontRevision) {
      return this.lastGeometryById;
    }

    const nextCache = new Map();
    const geometryById = new Map();

    for (const node of nodes) {
      const signature = getGeometrySignature(node, fontRevision);
      const cached = this.cache.get(node.id);

      if (cached?.signature === signature) {
        nextCache.set(node.id, cached);
        geometryById.set(node.id, cached.geometry);
        continue;
      }

      const font = this.fontManager.getLoadedFont(node.font);
      if (!font) {
        if (cached?.geometry?.ready) {
          nextCache.set(node.id, cached);
          geometryById.set(node.id, cached.geometry);
          continue;
        }

        const geometry = getFallbackGeometry(node);
        nextCache.set(node.id, { geometry, signature });
        geometryById.set(node.id, geometry);
        continue;
      }

      const builtGeometry = buildNodeGeometry(node, font);
      if (!builtGeometry.ready && cached?.geometry?.ready) {
        nextCache.set(node.id, cached);
        geometryById.set(node.id, cached.geometry);
        continue;
      }

      const geometry = {
        bbox: builtGeometry.bbox,
        id: node.id,
        paths: builtGeometry.paths,
        ready: builtGeometry.ready,
      };

      nextCache.set(node.id, { geometry, signature });
      geometryById.set(node.id, geometry);
    }

    this.cache = nextCache;
    this.lastNodes = nodes;
    this.lastRevision = fontRevision;
    this.lastGeometryById = geometryById;

    return geometryById;
  }

  getById(nodes, fontRevision, nodeId) {
    return this.getAll(nodes, fontRevision).get(nodeId) || null;
  }
}
