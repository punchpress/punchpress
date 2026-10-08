import { buildAppearanceObjects } from "./appearance-render-plan";
import type { AppearancePath } from "./appearance-types";

type StyledPath = AppearancePath & { styleNodeId?: string };

// The painted object that renders `nodeId`'s stack. A compound or boolean
// vector paints its compiled result with a child's stack, so the parent
// vector's objects are checked first.
export const getRenderedAppearanceObject = (editor, nodeId: string) => {
  for (const ownerId of getAppearanceOwnerIds(editor, nodeId)) {
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

// The geometry paths painted with `nodeId`'s stack: the paths of its rendered
// object, read without building paint objects or passes.
export const getRenderedAppearancePaths = (editor, nodeId: string) => {
  for (const ownerId of getAppearanceOwnerIds(editor, nodeId)) {
    const paths: readonly StyledPath[] | undefined = editor.getNode(ownerId)
      ? editor.getNodeRenderGeometry(ownerId)?.paths
      : undefined;
    const owned = paths?.filter((path) => {
      return (path.styleNodeId ?? ownerId) === nodeId;
    });

    if (owned?.length) {
      return owned;
    }
  }

  return null;
};

const getAppearanceOwnerIds = (editor, nodeId: string) => {
  const node = editor.getNode(nodeId);
  const parent = node ? editor.getNode(node.parentId) : null;

  return parent?.type === "vector" ? [parent.id, nodeId] : [nodeId];
};
