import { buildAppearanceObjects } from "./appearance-render-plan";

// The painted object that renders `nodeId`'s stack. A compound or boolean
// vector paints its compiled result with a child's stack, so the parent
// vector's objects are checked first.
export const getRenderedAppearanceObject = (editor, nodeId: string) => {
  const node = editor.getNode(nodeId);
  const parent = node ? editor.getNode(node.parentId) : null;
  const ownerIds = parent?.type === "vector" ? [parent.id, nodeId] : [nodeId];

  for (const ownerId of ownerIds) {
    const object = buildAppearanceObjects(
      editor.getNode(ownerId),
      editor.getNodeRenderGeometry(ownerId),
      (id) => editor.getNode(id)
    ).find((candidate) => candidate.styleNodeId === nodeId);

    if (object) {
      return object;
    }
  }

  return null;
};
