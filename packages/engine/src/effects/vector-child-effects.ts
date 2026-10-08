// Paths inside a vector have no effects (the vector owns the shadow). Every
// document write passes through here, so reparenting, pasting, and compound
// creation can never leave effects on a vector child; the array passes
// through unchanged when nothing needs stripping.
interface NodeFields {
  effects?: unknown;
  id: string;
  parentId: string;
  type?: string;
}

export const withoutVectorChildEffects = <TNode extends object>(
  nodes: TNode[]
): TNode[] => {
  const fields = nodes as unknown as NodeFields[];
  let vectorIds: Set<string> | null = null;
  let next: TNode[] | null = null;

  for (const [index, node] of fields.entries()) {
    if (node.type !== "path" || node.effects === undefined) {
      continue;
    }

    vectorIds ??= new Set(
      fields
        .filter((entry) => entry.type === "vector")
        .map((entry) => entry.id)
    );

    if (vectorIds.has(node.parentId)) {
      next ??= [...nodes];

      const stripped = { ...node };

      delete stripped.effects;
      next[index] = stripped as unknown as TNode;
    }
  }

  return next ?? nodes;
};
