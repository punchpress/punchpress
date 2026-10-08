import type { RenderItem, RenderTree } from "./render-tree";

interface RenderTreeIndex {
  // Paint position per item.
  order: Map<string, number>;
  // The nearest enclosing layer per item, or null at the top level.
  parentLayerIds: Map<string, string | null>;
  placedKinds: Map<string, "shell" | "surface">;
}

const indexByTree = new WeakMap<RenderTree, RenderTreeIndex>();

// Items are keyed by kind and id (`layer:g`, `surface:g`, `shell:a`), since a
// dense group is both a layer and its own surface. Built once per tree.
export const getRenderTreeIndex = (tree: RenderTree): RenderTreeIndex => {
  const cached = indexByTree.get(tree);

  if (cached) {
    return cached;
  }

  const index: RenderTreeIndex = {
    order: new Map(),
    parentLayerIds: new Map(),
    placedKinds: new Map(),
  };

  const visit = (items: RenderItem[], parentLayerId: string | null) => {
    for (const item of items) {
      const key = `${item.kind}:${item.nodeId}`;

      index.order.set(key, index.order.size);
      index.parentLayerIds.set(key, parentLayerId);

      if (item.kind === "layer") {
        visit(item.children, item.nodeId);
      } else {
        index.placedKinds.set(item.nodeId, item.kind);
      }
    }
  };

  visit(tree.items, null);
  indexByTree.set(tree, index);

  return index;
};
