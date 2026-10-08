import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import type { Bounds } from "../appearance/appearance-types";
import {
  type EffectPresentation,
  getEffectPresentation,
} from "../effects/effect-filter";
import { getNodeEffects } from "../effects/effect-model";
import { isContainerNode } from "../nodes/node-tree";
import {
  createOutputInkReader,
  getEditorInkSource,
  unionBounds,
} from "./output-ink";

const DENSE_GROUP_LEAF_THRESHOLD = 300;
const LARGE_GROUP_AREA_THRESHOLD = 3_000_000;
const LARGE_GROUP_LEAF_THRESHOLD = 24;

// One compositing boundary per group and artboard. A layer is always present,
// even at opacity 1, so toggling opacity never re-parents its descendants.
export interface RenderLayer {
  children: RenderItem[];
  // Artboards holding a shadowed group clip here, in stage coordinates, so
  // group shadows stop at the artboard edge.
  clip: Bounds | null;
  // A group's own shadows, composited over its children's stage-space ink.
  effects: EffectPresentation | null;
  kind: "layer";
  nodeId: string;
  opacity: number;
}

// `shell`: one node painted in its own placed shell (leaves, vectors, images).
// `surface`: a dense group painted as one SVG surface with nested groups.
export interface RenderLeaf {
  kind: "shell" | "surface";
  nodeId: string;
}

export type RenderItem = RenderLayer | RenderLeaf;

export interface RenderTree {
  items: RenderItem[];
  // Shell and surface ids in paint order; the only placed DOM targets.
  placedNodeIds: string[];
}

interface RenderTreeInputs {
  editingNodeId: string | null;
  focusedGroupId: string | null;
  fontRevision: number;
  nodes: readonly unknown[];
  pathEditingNodeId: string | null;
}

const cacheByEditor = new WeakMap<
  object,
  { inputs: RenderTreeInputs; tree: RenderTree }
>();

// The engine-owned paint tree the canvas mounts. It depends only on durable
// document state plus focus and editing ancestry, so previews (which do not
// write the store) keep it referentially stable.
export const getRenderTree = (editor): RenderTree => {
  const state = editor.getState();
  const inputs: RenderTreeInputs = {
    editingNodeId: state.editingNodeId ?? null,
    focusedGroupId: state.focusedGroupId ?? null,
    fontRevision: state.fontRevision ?? 0,
    nodes: state.nodes,
    pathEditingNodeId: state.pathEditingNodeId ?? null,
  };

  const cached = cacheByEditor.get(editor);

  if (
    cached &&
    (Object.keys(inputs) as (keyof RenderTreeInputs)[]).every((key) => {
      return cached.inputs[key] === inputs[key];
    })
  ) {
    return cached.tree;
  }

  const builtTree = buildRenderTree(editor, inputs);
  // Most document edits change a node's content, not paint order or layer
  // opacity. Keeping the tree identity lets the canvas skip re-placing shells,
  // and keeping each unchanged layer and the placed ids lets a structural
  // edit re-render and re-place only what changed.
  const tree = cached ? shareRenderTree(cached.tree, builtTree) : builtTree;

  cacheByEditor.set(editor, { inputs, tree });

  return tree;
};

const shareRenderTree = (
  previous: RenderTree,
  next: RenderTree
): RenderTree => {
  const previousItems = new Map<string, RenderItem>();

  const index = (items: RenderItem[]) => {
    for (const item of items) {
      previousItems.set(getItemKey(item), item);

      if (item.kind === "layer") {
        index(item.children);
      }
    }
  };

  index(previous.items);

  const items = shareItems(previous.items, next.items, previousItems);

  if (items === previous.items) {
    return previous;
  }

  return {
    items,
    placedNodeIds: haveSameIds(previous.placedNodeIds, next.placedNodeIds)
      ? previous.placedNodeIds
      : next.placedNodeIds,
  };
};

// Replaces each built item with the previous item for the same node when
// they are equivalent, so unchanged subtrees keep their identity.
const shareItems = (
  previous: RenderItem[],
  next: RenderItem[],
  previousItems: Map<string, RenderItem>
): RenderItem[] => {
  const items = next.map((item) => {
    return shareItem(previousItems.get(getItemKey(item)), item, previousItems);
  });

  return previous.length === items.length &&
    items.every((item, position) => item === previous[position])
    ? previous
    : items;
};

const shareItem = (
  previous: RenderItem | undefined,
  next: RenderItem,
  previousItems: Map<string, RenderItem>
): RenderItem => {
  if (!previous || previous.kind !== next.kind) {
    return next.kind === "layer"
      ? {
          ...next,
          children: shareItems([], next.children, previousItems),
        }
      : next;
  }

  if (previous.kind !== "layer" || next.kind !== "layer") {
    return previous;
  }

  const children = shareItems(previous.children, next.children, previousItems);

  if (
    children === previous.children &&
    previous.opacity === next.opacity &&
    haveSameValue(previous.clip, next.clip) &&
    haveSameValue(previous.effects, next.effects)
  ) {
    return previous;
  }

  return { ...next, children };
};

// A dense group is both a layer and its own surface, so items are keyed by
// kind as well as node id.
const getItemKey = (item: RenderItem) => `${item.kind}:${item.nodeId}`;

const haveSameIds = (previous: string[], next: string[]) => {
  return (
    previous.length === next.length &&
    next.every((nodeId, position) => nodeId === previous[position])
  );
};

const buildRenderTree = (editor, inputs: RenderTreeInputs): RenderTree => {
  const expandedGroupIds = getExpandedGroupIds(editor, inputs);
  const facts = createSubtreeFacts(editor);
  const placedNodeIds: string[] = [];
  const readInk = createOutputInkReader(getEditorInkSource(editor));
  const getLayerEffects = (node) => {
    const effects = getNodeEffects(node);

    if (node.type !== "group" || !hasActiveEffects(effects)) {
      return null;
    }

    const content = unionBounds(
      editor.getChildNodeIds(node.id).map(readInk).filter(Boolean) as Bounds[]
    );

    return getEffectPresentation(effects, content);
  };
  const getLayerClip = (node) => {
    return node.type === "artboard" && facts.hasShadowedGroup(node.id)
      ? (editor.getNodeRenderFrame(node.id)?.bounds ?? null)
      : null;
  };

  const visit = (parentId: string): RenderItem[] => {
    return editor.getChildNodeIds(parentId).flatMap((nodeId) => {
      const node = editor.getNode(nodeId);

      if (!node || node.visible === false) {
        return [];
      }

      if (node.type === "group" || node.type === "artboard") {
        // A dense surface paints nested groups as plain SVG groups, so a
        // group holding shadowed groups stays expanded.
        if (
          node.type === "group" &&
          !expandedGroupIds.has(node.id) &&
          isDenseGroup(editor, facts.getLeafCount(node.id), node.id) &&
          !facts.hasShadowedGroup(node.id)
        ) {
          placedNodeIds.push(node.id);

          return [
            {
              children: [{ kind: "surface", nodeId: node.id }],
              clip: null,
              effects: getLayerEffects(node),
              kind: "layer",
              nodeId: node.id,
              opacity: getOpacity(node),
            } satisfies RenderLayer,
          ];
        }

        return [
          {
            children: visit(node.id),
            clip: getLayerClip(node),
            effects: getLayerEffects(node),
            kind: "layer",
            nodeId: node.id,
            opacity: getOpacity(node),
          } satisfies RenderLayer,
        ];
      }

      if (node.type === "empty") {
        return [];
      }

      placedNodeIds.push(node.id);

      return [{ kind: "shell", nodeId: node.id } satisfies RenderLeaf];
    });
  };

  return { items: visit(ROOT_PARENT_ID), placedNodeIds };
};

// Groups that must show their children as individual shells: the focused
// group itself (drill-in), and every group on the path to the text or path
// being edited, whose artwork must paint in its own tree slot. Focus alone
// keeps dense ancestors collapsed; deep hit testing still reaches into them.
const getExpandedGroupIds = (editor, inputs: RenderTreeInputs) => {
  const expanded = new Set<string>();

  if (inputs.focusedGroupId) {
    expanded.add(inputs.focusedGroupId);
  }

  for (const nodeId of [inputs.editingNodeId, inputs.pathEditingNodeId]) {
    let current = nodeId ? editor.getNode(nodeId) : null;

    while (current) {
      if (current.type === "group") {
        expanded.add(current.id);
      }

      current =
        current.parentId && current.parentId !== ROOT_PARENT_ID
          ? editor.getNode(current.parentId)
          : null;
    }
  }

  return expanded;
};

const isDenseGroup = (editor, leafCount: number, nodeId: string) => {
  if (leafCount > DENSE_GROUP_LEAF_THRESHOLD) {
    return true;
  }

  if (leafCount <= LARGE_GROUP_LEAF_THRESHOLD) {
    return false;
  }

  const bounds = editor.getNodeRenderFrame(nodeId)?.bounds;

  return (
    (bounds?.width || 0) * (bounds?.height || 0) > LARGE_GROUP_AREA_THRESHOLD
  );
};

const getOpacity = (node) => {
  return typeof node.opacity === "number" ? node.opacity : 1;
};

const hasActiveEffects = (effects) => {
  return effects.some((effect) => effect.enabled && effect.opacity > 0);
};

// Per-build subtree facts, memoized so nested groups are walked once instead
// of once per ancestor.
const createSubtreeFacts = (editor) => {
  const leafCounts = new Map<string, number>();
  const shadowedGroups = new Map<string, boolean>();

  // Descendants that are not containers, matching getDescendantLeafNodeIds.
  const getLeafCount = (nodeId: string): number => {
    let count = leafCounts.get(nodeId);

    if (count === undefined) {
      count = 0;

      for (const childId of editor.getChildNodeIds(nodeId)) {
        count += isContainerNode(editor.getNode(childId))
          ? getLeafCount(childId)
          : 1;
      }

      leafCounts.set(nodeId, count);
    }

    return count;
  };

  // Whether any group strictly below `nodeId` has shadows.
  const hasShadowedGroup = (nodeId: string): boolean => {
    let shadowed = shadowedGroups.get(nodeId);

    if (shadowed === undefined) {
      shadowed = editor.getChildNodeIds(nodeId).some((childId) => {
        const child = editor.getNode(childId);

        return (
          child?.type === "group" &&
          (hasActiveEffects(getNodeEffects(child)) || hasShadowedGroup(childId))
        );
      });
      shadowedGroups.set(nodeId, shadowed);
    }

    return shadowed;
  };

  return { getLeafCount, hasShadowedGroup };
};

// Clips and effect presentations are small plain values rebuilt per build.
const haveSameValue = (previous: unknown, next: unknown) => {
  return previous === next || JSON.stringify(previous) === JSON.stringify(next);
};
