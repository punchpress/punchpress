import { isVectorPathPointRole } from "@punchpress/engine";

const HIT_TEST_OPTIONS = {
  fill: true,
  stroke: true,
  tolerance: 10,
};

export const findPathBodyHit = (paths, point) => {
  const directPathHit = paths.find((path) => path.hitTest(point));

  if (directPathHit) {
    return directPathHit;
  }

  return paths.find((path) => path.closed && path.contains(point)) || null;
};

export const getInteractiveHit = (scope, point) => {
  const hits = scope.project.hitTestAll(point, HIT_TEST_OPTIONS);

  return (
    hits.find((hit) => isVectorPathPointRole(hit?.item?.data?.role)) ||
    hits.find((hit) => hit?.item?.data?.role === "path") ||
    null
  );
};

export const getDragModifierState = (nativeEvent, role) => {
  const isHandle = role === "handle-in" || role === "handle-out";

  return {
    constrainAngle: Boolean(isHandle && nativeEvent?.shiftKey),
    preserveSmoothCoupling: !(isHandle && nativeEvent?.altKey),
  };
};
