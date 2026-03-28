const VECTOR_PATH_POINT_ROLES = ["anchor", "handle-in", "handle-out"] as const;

export const isVectorPathPointRole = (role: string | null | undefined) => {
  return VECTOR_PATH_POINT_ROLES.includes(
    role as (typeof VECTOR_PATH_POINT_ROLES)[number]
  );
};

export const getVectorPathCursorMode = ({
  isBodyHit = false,
  isDraggingBody = false,
  isInsertHit = false,
  role = null,
}: {
  isBodyHit?: boolean;
  isDraggingBody?: boolean;
  isInsertHit?: boolean;
  role?: string | null;
}) => {
  if (isDraggingBody) {
    return "body";
  }

  if (isVectorPathPointRole(role)) {
    return "point";
  }

  if (isInsertHit) {
    return "insert";
  }

  if (isBodyHit) {
    return "body";
  }

  return null;
};
