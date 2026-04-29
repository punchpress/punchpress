export const getPathNodeContours = (node) => {
  if (node?.type !== "path") {
    return [];
  }

  return Array.isArray(node.contours) && node.contours.length > 0
    ? node.contours
    : [
        {
          closed: node.closed,
          segments: node.segments || [],
        },
      ];
};

export const getPathNodeContour = (node, contourIndex = 0) => {
  return getPathNodeContours(node)[contourIndex] || null;
};

export const getPathNodePrimaryContour = (node) => {
  return getPathNodeContour(node, 0);
};

export const getPathNodeContourCount = (node) => {
  return getPathNodeContours(node).length;
};

export const withPathNodeContours = (node, contours) => {
  const primaryContour = contours[0] || null;

  return {
    ...node,
    closed: primaryContour?.closed ?? false,
    contours,
    segments: primaryContour?.segments || [],
  };
};

export const normalizePathNodeContours = (node) => {
  if (node?.type !== "path") {
    return node;
  }

  const primaryContour = Array.isArray(node.contours)
    ? node.contours[0]
    : null;
  const hasLegacyContourPatch =
    Array.isArray(node.segments) &&
    (node.segments !== primaryContour?.segments ||
      (typeof node.closed === "boolean" && node.closed !== primaryContour.closed));
  const contours = hasLegacyContourPatch
    ? [
        {
          closed: typeof node.closed === "boolean" ? node.closed : true,
          segments: node.segments,
        },
      ]
    : getPathNodeContours(node);

  return withPathNodeContours(node, contours);
};
