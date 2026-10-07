import { ROOT_PARENT_ID } from "./constants";

interface TreeNode {
  id: string;
  parentId?: string | null;
}

// Canonical paint order: preorder, so every node is followed immediately by its
// whole subtree, with siblings in their current relative order. Returns the
// same array when it is already canonical. Every input occurrence is kept
// exactly once: nodes under a missing parent start their own subtree in place,
// and occurrences unreachable from any root (parent cycles) or repeating an id
// are appended in input order, so validation can still report them.
export const canonicalizeTreeOrder = <TNode extends TreeNode>(
  nodes: readonly TNode[]
): TNode[] => {
  const firstIndexById = new Map<string, number>();

  for (const [index, node] of nodes.entries()) {
    if (!firstIndexById.has(node.id)) {
      firstIndexById.set(node.id, index);
    }
  }

  const childIndexesByParent = new Map<number, number[]>();
  const rootIndexes: number[] = [];

  for (const [index, node] of nodes.entries()) {
    const parentIndex =
      node.parentId && node.parentId !== ROOT_PARENT_ID
        ? firstIndexById.get(node.parentId)
        : undefined;

    if (parentIndex === undefined || firstIndexById.get(node.id) !== index) {
      rootIndexes.push(index);
      continue;
    }

    const siblings = childIndexesByParent.get(parentIndex);

    if (siblings) {
      siblings.push(index);
    } else {
      childIndexesByParent.set(parentIndex, [index]);
    }
  }

  const order: number[] = [];
  const visited = new Uint8Array(nodes.length);
  const stack = [...rootIndexes].reverse();

  while (stack.length > 0) {
    const index = stack.pop() as number;

    if (visited[index]) {
      continue;
    }

    visited[index] = 1;
    order.push(index);

    const children = childIndexesByParent.get(index);

    if (children) {
      for (let child = children.length - 1; child >= 0; child -= 1) {
        stack.push(children[child]);
      }
    }
  }

  for (let index = 0; index < nodes.length; index += 1) {
    if (!visited[index]) {
      order.push(index);
    }
  }

  return order.every((index, position) => index === position)
    ? (nodes as TNode[])
    : order.map((index) => nodes[index]);
};

// Ids that sit on a parent cycle. Valid documents have none.
export const findParentCycleIds = (nodes: readonly TreeNode[]) => {
  const parentById = new Map(nodes.map((node) => [node.id, node.parentId]));
  const cycleIds = new Set<string>();
  const settled = new Set<string>();

  for (const node of nodes) {
    const path: string[] = [];
    const onPath = new Set<string>();
    let current: string | null | undefined = node.id;

    while (
      current &&
      current !== ROOT_PARENT_ID &&
      parentById.has(current) &&
      !settled.has(current)
    ) {
      if (onPath.has(current)) {
        for (const id of path.slice(path.indexOf(current))) {
          cycleIds.add(id);
        }

        break;
      }

      onPath.add(current);
      path.push(current);
      current = parentById.get(current);
    }

    for (const id of path) {
      settled.add(id);
    }
  }

  return [...cycleIds];
};
