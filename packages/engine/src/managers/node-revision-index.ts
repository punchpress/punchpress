import { getNodeParentId } from "../nodes/node-tree";

// Tracks which nodes changed between node-tree syncs so render clients can
// invalidate one node's art instead of every node on any document change.
// Revisions come from one monotonic counter, so the max of several revisions
// changes whenever any of them does.
export class NodeRevisionIndex {
  nodeRevisionById = new Map<string, number>();
  revision = 0;
  subtreeRevisionById = new Map<string, number>();

  update({
    childIdsByParent,
    nodesById,
    previousChildIdsByParent,
    previousNodesById,
  }) {
    const changedIds: string[] = [];

    for (const [nodeId, node] of nodesById) {
      if (previousNodesById.get(nodeId) !== node) {
        changedIds.push(nodeId);
      }
    }

    for (const [parentId, childIds] of childIdsByParent) {
      if (!haveSameIds(previousChildIdsByParent.get(parentId), childIds)) {
        changedIds.push(parentId);
      }
    }

    for (const [parentId, childIds] of previousChildIdsByParent) {
      if (!childIdsByParent.has(parentId)) {
        changedIds.push(parentId);
      }

      for (const childId of childIds) {
        if (!nodesById.has(childId)) {
          this.nodeRevisionById.delete(childId);
          this.subtreeRevisionById.delete(childId);
        }
      }
    }

    if (changedIds.length === 0) {
      return;
    }

    const revision = ++this.revision;

    for (const nodeId of changedIds) {
      // A deleted container is listed when its child list disappears; its
      // entries were released above.
      if (!nodesById.has(nodeId)) {
        continue;
      }

      if (previousNodesById.get(nodeId) !== nodesById.get(nodeId)) {
        this.nodeRevisionById.set(nodeId, revision);
      }

      this.bumpSubtree(nodesById, nodeId, revision);
    }
  }

  // Changes when the node, any descendant, any child order beneath it, or any
  // ancestor node changes. Ancestors carry visibility, clipping, and artboard
  // frames that descendant art reads.
  getArtRevision(nodesById, nodeId) {
    let revision = this.subtreeRevisionById.get(nodeId) ?? 0;
    let node = nodesById.get(nodeId);

    while (node) {
      const parentId = getNodeParentId(node);
      revision = Math.max(revision, this.nodeRevisionById.get(parentId) ?? 0);
      node = nodesById.get(parentId);
    }

    return revision;
  }

  private bumpSubtree(nodesById, nodeId, revision) {
    let currentId = nodeId;

    while (
      currentId &&
      nodesById.has(currentId) &&
      this.subtreeRevisionById.get(currentId) !== revision
    ) {
      this.subtreeRevisionById.set(currentId, revision);
      currentId = getNodeParentId(nodesById.get(currentId));
    }
  }
}

const haveSameIds = (previousIds: string[] | undefined, ids: string[]) => {
  if (previousIds?.length !== ids.length) {
    return false;
  }

  return ids.every((id, index) => previousIds[index] === id);
};
