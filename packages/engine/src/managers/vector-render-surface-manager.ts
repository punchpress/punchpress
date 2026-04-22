import { getNodeGeometrySignature } from "../nodes/node-capabilities";
import { getVectorChildPathNodes } from "../nodes/vector/vector-path-composition";
import { buildVectorRenderGeometry } from "../nodes/vector/vector-render-geometry";

const getPreviewAdjustedPathNode = (pathNode, preview) => {
  if (!preview?.nodeIds.includes(pathNode.id)) {
    return pathNode;
  }

  return {
    ...pathNode,
    transform: {
      ...pathNode.transform,
      x: (pathNode.transform.x || 0) + preview.delta.x,
      y: (pathNode.transform.y || 0) + preview.delta.y,
    },
  };
};

const getVectorRenderPreview = (editor, childPathNodes) => {
  const preview = editor.selectionDragPreview;

  if (!(preview?.delta && preview.nodeIds?.length > 0)) {
    return null;
  }

  const visibleChildPathIds = childPathNodes
    .filter((pathNode) => pathNode.visible !== false)
    .map((pathNode) => pathNode.id);
  const previewedChildPathIds = visibleChildPathIds.filter((pathNodeId) => {
    return preview.nodeIds.includes(pathNodeId);
  });

  if (previewedChildPathIds.length === 0) {
    return null;
  }

  const coversWholeVector =
    visibleChildPathIds.length > 0 &&
    visibleChildPathIds.every((pathNodeId) => {
      return preview.nodeIds.includes(pathNodeId);
    });

  if (coversWholeVector) {
    return null;
  }

  return {
    delta: {
      x: preview.delta.x,
      y: preview.delta.y,
    },
    nodeIds: previewedChildPathIds,
  };
};

const getVectorRenderSurfaceSignature = (
  editor,
  vectorNode,
  childPathNodes,
  preview
) => {
  return JSON.stringify({
    childPaths: childPathNodes.map((pathNode) => ({
      geometry: getNodeGeometrySignature(pathNode, editor.fontRevision),
      id: pathNode.id,
      transform: pathNode.transform,
      visible: pathNode.visible !== false,
    })),
    preview: preview
      ? {
          delta: preview.delta,
          nodeIds: preview.nodeIds,
        }
      : null,
    vector: {
      compoundWrapper: Boolean(vectorNode.compoundWrapper),
      id: vectorNode.id,
      pathComposition: vectorNode.pathComposition || "independent",
    },
  });
};

const pruneCache = (cache, liveVectorNodeIds) => {
  for (const nodeId of cache.keys()) {
    if (!liveVectorNodeIds.has(nodeId)) {
      cache.delete(nodeId);
    }
  }
};

export class VectorRenderSurfaceManager {
  constructor(buildSurface = buildVectorRenderGeometry) {
    this.buildSurface = buildSurface;
    this.durableCache = new Map();
    this.lastNodes = null;
    this.previewCache = new Map();
  }

  syncNodes(nodes) {
    if (this.lastNodes === nodes) {
      return;
    }

    const liveVectorNodeIds = new Set(
      nodes.filter((node) => node.type === "vector").map((node) => node.id)
    );

    pruneCache(this.durableCache, liveVectorNodeIds);
    pruneCache(this.previewCache, liveVectorNodeIds);
    this.lastNodes = nodes;
  }

  getById(editor, nodeId) {
    this.syncNodes(editor.nodes);

    const vectorNode = editor.getNode(nodeId);

    if (vectorNode?.type !== "vector") {
      this.durableCache.delete(nodeId);
      this.previewCache.delete(nodeId);
      return null;
    }

    const childPathNodes = getVectorChildPathNodes(editor, nodeId);

    if (childPathNodes.length === 0) {
      this.durableCache.delete(nodeId);
      this.previewCache.delete(nodeId);
      return null;
    }

    const preview = getVectorRenderPreview(editor, childPathNodes);
    const previewAdjustedChildPathNodes = childPathNodes.map((pathNode) => {
      return getPreviewAdjustedPathNode(pathNode, preview);
    });
    const signature = getVectorRenderSurfaceSignature(
      editor,
      vectorNode,
      previewAdjustedChildPathNodes,
      preview
    );
    const cache = preview ? this.previewCache : this.durableCache;
    const cached = cache.get(nodeId);

    if (cached?.signature === signature) {
      return cached.geometry;
    }

    const geometry = this.buildSurface(
      vectorNode,
      previewAdjustedChildPathNodes,
      (pathNode) => editor.getNodeGeometry(pathNode.id)
    );

    cache.set(nodeId, {
      geometry,
      signature,
    });

    if (!preview) {
      this.previewCache.delete(nodeId);
    }

    return geometry;
  }
}
