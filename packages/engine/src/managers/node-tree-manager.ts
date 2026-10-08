import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import {
  getNodeParentId,
  hasEditableVectorContours,
  isArtboardNode,
  isContainerNode,
  isContentContainerNode,
} from "../nodes/node-tree";
import { NodeRevisionIndex } from "./node-revision-index";

const getGeneratedLayerLabelKey = (node) => {
  if (!node) {
    return null;
  }

  const parentId = getNodeParentId(node);

  if (node.type === "shape") {
    return `${parentId}:shape:${node.shape}`;
  }

  return `${parentId}:${node.type}`;
};

export interface NodeTreeManager {
  childIdsByParent: any;
  generatedLayerLabelIndexById: Map<string, number>;
  generatedLayerLabelKeyById: Map<string, string>;
  generatedLayerLabelNextIndexByKey: Map<string, number>;
  layerMetaById: any;
  nodes: any;
  nodesById: any;
  revisions: NodeRevisionIndex;
}

export class NodeTreeManager {
  constructor() {
    this.childIdsByParent = new Map();
    this.generatedLayerLabelIndexById = new Map();
    this.generatedLayerLabelKeyById = new Map();
    this.generatedLayerLabelNextIndexByKey = new Map();
    this.layerMetaById = new Map();
    this.nodes = null;
    this.nodesById = new Map();
    this.revisions = new NodeRevisionIndex();
  }

  sync(nodes) {
    if (this.nodes === nodes) {
      return;
    }

    for (const node of nodes) {
      const key = getGeneratedLayerLabelKey(node);

      if (!key || this.generatedLayerLabelKeyById.get(node.id) === key) {
        continue;
      }

      const nextIndex =
        (this.generatedLayerLabelNextIndexByKey.get(key) || 0) + 1;
      this.generatedLayerLabelKeyById.set(node.id, key);
      this.generatedLayerLabelIndexById.set(node.id, nextIndex);
      this.generatedLayerLabelNextIndexByKey.set(key, nextIndex);
    }

    const childIdsByParent = new Map();
    const nodesById = new Map();

    for (const node of nodes) {
      nodesById.set(node.id, node);

      const parentId = getNodeParentId(node);
      const childIds = childIdsByParent.get(parentId) || [];
      childIds.push(node.id);
      childIdsByParent.set(parentId, childIds);
    }

    const layerMetaById = new Map();

    for (const childIds of childIdsByParent.values()) {
      const containerIds = childIds.filter((nodeId) => {
        return isContainerNode(nodesById.get(nodeId));
      });

      childIds.forEach((nodeId, siblingIndex) => {
        const containerIndex = containerIds.indexOf(nodeId);

        layerMetaById.set(nodeId, {
          containerIndex,
          containerLayerIndex:
            containerIndex >= 0
              ? containerIds.length - 1 - containerIndex
              : -1,
          isBackmost: siblingIndex === 0,
          isFrontmost: siblingIndex === childIds.length - 1,
          layerIndex: childIds.length - 1 - siblingIndex,
          siblingIndex,
        });
      });
    }

    this.revisions.update({
      childIdsByParent,
      nodesById,
      previousChildIdsByParent: this.childIdsByParent,
      previousNodesById: this.nodesById,
    });
    this.childIdsByParent = childIdsByParent;
    this.layerMetaById = layerMetaById;
    this.nodes = nodes;
    this.nodesById = nodesById;
  }

  getNode(nodes, nodeId) {
    if (!nodeId) {
      return null;
    }

    this.sync(nodes);

    return this.nodesById.get(nodeId) || null;
  }

  getChildNodeIds(nodes, parentId = ROOT_PARENT_ID) {
    this.sync(nodes);

    return this.childIdsByParent.get(parentId) || [];
  }

  getDescendantLeafNodeIds(nodes, nodeId) {
    this.sync(nodes);

    const descendantLeafNodeIds: string[] = [];

    const visit = (parentId) => {
      for (const childNodeId of this.childIdsByParent.get(parentId) || []) {
        const childNode = this.nodesById.get(childNodeId);

        if (!childNode) {
          continue;
        }

        if (isContainerNode(childNode)) {
          visit(childNodeId);
          continue;
        }

        descendantLeafNodeIds.push(childNodeId);
      }
    };

    visit(nodeId);

    return descendantLeafNodeIds;
  }

  isDescendantOf(nodes, nodeId, ancestorId) {
    if (!(nodeId && ancestorId) || nodeId === ancestorId) {
      return nodeId === ancestorId;
    }

    this.sync(nodes);

    let currentNode = this.nodesById.get(nodeId);

    while (currentNode && getNodeParentId(currentNode) !== ROOT_PARENT_ID) {
      const parentNode = this.nodesById.get(getNodeParentId(currentNode));

      if (!parentNode) {
        return false;
      }

      if (parentNode.id === ancestorId) {
        return true;
      }

      currentNode = parentNode;
    }

    return false;
  }

  // Content containers expand to their descendant leaves; vectors with
  // editable contours of their own stay themselves.
  getEffectiveSelectionNodeIds(nodes, nodeIds) {
    this.sync(nodes);

    const effectiveNodeIds: string[] = [];

    for (const nodeId of nodeIds) {
      const node = this.nodesById.get(nodeId);

      if (!node) {
        continue;
      }

      if (isContentContainerNode(node) && !hasEditableVectorContours(node)) {
        effectiveNodeIds.push(...this.getDescendantLeafNodeIds(nodes, nodeId));
        continue;
      }

      effectiveNodeIds.push(nodeId);
    }

    return [...new Set(effectiveNodeIds)];
  }

  // Inside a focused group, its descendants are their own targets and
  // outside nodes resolve to their root ancestor. Otherwise a click targets
  // the top-level ancestor, stopping beneath an artboard.
  getSelectionTargetNodeId(nodes, nodeId, focusedGroupId) {
    if (!nodeId) {
      return null;
    }

    this.sync(nodes);

    const targetNode = this.nodesById.get(nodeId);

    if (!targetNode) {
      return null;
    }

    if (focusedGroupId) {
      return nodeId === focusedGroupId ||
        this.isDescendantOf(nodes, nodeId, focusedGroupId)
        ? nodeId
        : this.getRootAncestorId(targetNode);
    }

    let currentNode = targetNode;

    while (getNodeParentId(currentNode) !== ROOT_PARENT_ID) {
      const parentNode = this.nodesById.get(getNodeParentId(currentNode));

      if (!parentNode) {
        break;
      }

      if (isArtboardNode(parentNode)) {
        return currentNode.id;
      }

      currentNode = parentNode;
    }

    return currentNode.id;
  }

  getArtRevision(nodes, nodeId) {
    this.sync(nodes);

    return this.revisions.getArtRevision(this.nodesById, nodeId);
  }

  getLayerMeta(nodes, nodeId) {
    this.sync(nodes);

    return this.layerMetaById.get(nodeId) || null;
  }

  getRootAncestorId(node) {
    let currentNode = node;

    while (getNodeParentId(currentNode) !== ROOT_PARENT_ID) {
      const parentNode = this.nodesById.get(getNodeParentId(currentNode));

      if (!parentNode) {
        break;
      }

      currentNode = parentNode;
    }

    return currentNode.id;
  }

  resetGeneratedLayerLabels() {
    this.generatedLayerLabelIndexById.clear();
    this.generatedLayerLabelKeyById.clear();
    this.generatedLayerLabelNextIndexByKey.clear();
  }

  getGeneratedLayerLabelIndex(nodes, nodeId) {
    this.sync(nodes);

    return this.generatedLayerLabelIndexById.get(nodeId) || 1;
  }
}
