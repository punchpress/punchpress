import { ROOT_PARENT_ID } from "@punchpress/punch-schema";

const DENSE_GROUP_LEAF_THRESHOLD = 300;
const LARGE_GROUP_AREA_THRESHOLD = 3_000_000;
const LARGE_GROUP_LEAF_THRESHOLD = 24;

// One compositing boundary per group and artboard. A layer is always present,
// even at opacity 1, so toggling opacity never re-parents its descendants.
export interface RenderLayer {
  children: RenderItem[];
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

  const tree = buildRenderTree(editor, inputs);

  cacheByEditor.set(editor, { inputs, tree });

  return tree;
};

const buildRenderTree = (editor, inputs: RenderTreeInputs): RenderTree => {
  const expandedGroupIds = getExpandedGroupIds(editor, inputs);
  const placedNodeIds: string[] = [];

  const visit = (parentId: string): RenderItem[] => {
    return editor.getChildNodeIds(parentId).flatMap((nodeId) => {
      const node = editor.getNode(nodeId);

      if (!node || node.visible === false) {
        return [];
      }

      if (node.type === "group" || node.type === "artboard") {
        if (
          node.type === "group" &&
          !expandedGroupIds.has(node.id) &&
          isDenseGroup(editor, node.id)
        ) {
          placedNodeIds.push(node.id);

          return [
            {
              children: [{ kind: "surface", nodeId: node.id }],
              kind: "layer",
              nodeId: node.id,
              opacity: getOpacity(node),
            } satisfies RenderLayer,
          ];
        }

        return [
          {
            children: visit(node.id),
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

const isDenseGroup = (editor, nodeId: string) => {
  const leafCount = editor.getDescendantLeafNodeIds(nodeId).length;

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
