import {
  getNodeLocalMatrix,
  invertMatrix,
  multiplyMatrix,
} from "@punchpress/engine";

export const getRasterWorkingSurfaceRelativeMatrix = (
  durableNode,
  workingSurface
) => {
  if (!(durableNode?.type === "image" && workingSurface?.transform)) {
    return null;
  }

  const workingNode = {
    ...durableNode,
    height: workingSurface.height,
    transform: workingSurface.transform,
    width: workingSurface.width,
  };
  const durableMatrix = getNodeLocalMatrix(
    durableNode,
    getImageBounds(durableNode)
  );
  const inverseDurableMatrix = invertMatrix(durableMatrix);

  if (!inverseDurableMatrix) {
    return null;
  }

  return multiplyMatrix(
    inverseDurableMatrix,
    getNodeLocalMatrix(workingNode, getImageBounds(workingNode))
  );
};

const getImageBounds = (node) => ({
  height: node.height,
  maxX: node.width,
  maxY: node.height,
  minX: 0,
  minY: 0,
  width: node.width,
});
