import {
  buildNodeCapabilityGeometry,
  getNodeGeometrySignature,
} from "../nodes/node-capabilities";

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
      const signature = getNodeGeometrySignature(node, fontRevision);
      const cached = this.cache.get(node.id);

      if (!signature) {
        nextCache.set(node.id, { geometry: null, signature });
        geometryById.set(node.id, null);
        continue;
      }

      if (cached?.signature === signature) {
        nextCache.set(node.id, cached);
        geometryById.set(node.id, cached.geometry);
        continue;
      }

      const font =
        "font" in node ? this.fontManager.getLoadedFont(node.font) : null;
      const builtGeometry = buildNodeCapabilityGeometry(node, font);

      if (!builtGeometry) {
        nextCache.set(node.id, { geometry: null, signature });
        geometryById.set(node.id, null);
        continue;
      }

      if (!builtGeometry.ready && cached?.geometry?.ready) {
        nextCache.set(node.id, cached);
        geometryById.set(node.id, cached.geometry);
        continue;
      }

      nextCache.set(node.id, { geometry: builtGeometry, signature });
      geometryById.set(node.id, builtGeometry);
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
