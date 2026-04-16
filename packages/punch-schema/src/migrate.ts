import { PUNCH_DOCUMENT_VERSION, ROOT_PARENT_ID } from "./constants";
import { UnsupportedDocumentVersionError } from "./errors";
import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
} from "./vector-stroke-style";

const V16_DOCUMENT_VERSION = "1.6";
const DEFAULT_VECTOR_NAME = "Vector";
const DEFAULT_VECTOR_TRANSFORM = Object.freeze({
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  x: 0,
  y: 0,
});

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const getParentId = (value: unknown) => {
  return typeof value === "string" && value.length > 0 ? value : ROOT_PARENT_ID;
};

const getVisible = (value: unknown) => {
  return value !== false;
};

const getNodeId = (node: Record<string, unknown>, fallback: string) => {
  return typeof node.id === "string" && node.id.length > 0 ? node.id : fallback;
};

const getNodeName = (value: unknown, fallback: string) => {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
};

const getTransform = (value: unknown, fallback = DEFAULT_VECTOR_TRANSFORM) => {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  return {
    rotation: isFiniteNumber(value.rotation)
      ? value.rotation
      : fallback.rotation,
    scaleX: isFiniteNumber(value.scaleX) ? value.scaleX : fallback.scaleX,
    scaleY: isFiniteNumber(value.scaleY) ? value.scaleY : fallback.scaleY,
    x: isFiniteNumber(value.x) ? value.x : fallback.x,
    y: isFiniteNumber(value.y) ? value.y : fallback.y,
  };
};

const getNullableColor = (value: unknown) => {
  return typeof value === "string" && value.length > 0 ? value : null;
};

const getFillRule = (value: unknown) => {
  return value === "evenodd" ? "evenodd" : "nonzero";
};

const getStrokeLineCap = (value: unknown) => {
  return value === "butt" || value === "round" || value === "square"
    ? value
    : DEFAULT_VECTOR_STROKE_LINE_CAP;
};

const getStrokeLineJoin = (value: unknown) => {
  return value === "miter" || value === "round" || value === "bevel"
    ? value
    : DEFAULT_VECTOR_STROKE_LINE_JOIN;
};

const getStrokeMiterLimit = (value: unknown) => {
  return isFiniteNumber(value) ? value : DEFAULT_VECTOR_STROKE_MITER_LIMIT;
};

const getStrokeWidth = (value: unknown) => {
  return isFiniteNumber(value) ? value : 0;
};

const getPointType = (value: unknown) => {
  return value === "smooth" ? "smooth" : "corner";
};

const getHandle = (value: unknown) => {
  if (!isRecord(value)) {
    return { x: 0, y: 0 };
  }

  return {
    x: isFiniteNumber(value.x) ? value.x : 0,
    y: isFiniteNumber(value.y) ? value.y : 0,
  };
};

const getSegments = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((segment) => {
      return {
        handleIn: getHandle(segment.handleIn),
        handleOut: getHandle(segment.handleOut),
        point: getHandle(segment.point),
        pointType: getPointType(segment.pointType),
      };
    });
};

const createUniquePathId = (
  existingIds: Set<string>,
  vectorId: string,
  contourIndex: number
) => {
  let suffix = contourIndex + 1;
  let candidateId = `${vectorId}-path-${suffix}`;

  while (existingIds.has(candidateId)) {
    suffix += 1;
    candidateId = `${vectorId}-path-${suffix}`;
  }

  existingIds.add(candidateId);

  return candidateId;
};

const isLegacyVectorNode = (node: Record<string, unknown>) => {
  return node.type === "vector" && Array.isArray(node.contours);
};

const migrateLegacyVectorNode = (
  node: Record<string, unknown>,
  existingIds: Set<string>,
  vectorIndex: number
) => {
  const vectorId = getNodeId(node, `vector-${vectorIndex}`);
  const vectorName = getNodeName(node.name, `${DEFAULT_VECTOR_NAME} ${vectorIndex}`);
  const pathTransform = getTransform(node.transform);
  const nextNodes: Record<string, unknown>[] = [
    {
      id: vectorId,
      name: vectorName,
      parentId: getParentId(node.parentId),
      transform: { ...DEFAULT_VECTOR_TRANSFORM },
      type: "vector",
      visible: getVisible(node.visible),
    },
  ];

  existingIds.add(vectorId);

  for (const [contourIndex, contour] of node.contours.entries()) {
    if (!isRecord(contour)) {
      continue;
    }

    const segments = getSegments(contour.segments);

    if (segments.length === 0) {
      continue;
    }

    nextNodes.push({
      closed: contour.closed !== false,
      fill: getNullableColor(node.fill),
      fillRule: getFillRule(node.fillRule),
      id: createUniquePathId(existingIds, vectorId, contourIndex),
      parentId: vectorId,
      segments,
      stroke: getNullableColor(node.stroke),
      strokeLineCap: getStrokeLineCap(node.strokeLineCap),
      strokeLineJoin: getStrokeLineJoin(node.strokeLineJoin),
      strokeMiterLimit: getStrokeMiterLimit(node.strokeMiterLimit),
      strokeWidth: getStrokeWidth(node.strokeWidth),
      transform: pathTransform,
      type: "path",
      visible: true,
    });
  }

  return nextNodes;
};

const migrateV16Document = (value: Record<string, unknown>) => {
  const nodes = Array.isArray(value.nodes) ? value.nodes : [];
  const existingIds = new Set(
    nodes
      .filter(isRecord)
      .map((node) => node.id)
      .filter((nodeId): nodeId is string => {
        return typeof nodeId === "string" && nodeId.length > 0;
    })
  );
  let nextVectorIndex = 1;

  return {
    ...value,
    version: PUNCH_DOCUMENT_VERSION,
    nodes: nodes.flatMap((node) => {
      if (!isRecord(node)) {
        return [node];
      }

      if (!isLegacyVectorNode(node)) {
        const nextNode = {
          ...node,
          parentId: getParentId(node.parentId),
          visible: getVisible(node.visible),
        };

        if (node.type !== "vector") {
          return [nextNode];
        }

        return [
          {
            ...nextNode,
            name: getNodeName(node.name, DEFAULT_VECTOR_NAME),
            transform: getTransform(node.transform),
          },
        ];
      }

      const migratedNodes = migrateLegacyVectorNode(
        node,
        existingIds,
        nextVectorIndex
      );
      nextVectorIndex += 1;

      return migratedNodes;
    }),
  };
};

export const migrateDocument = (value: unknown) => {
  if (!isRecord(value)) {
    throw new UnsupportedDocumentVersionError(
      "Document must be a JSON object."
    );
  }

  if (value.version === PUNCH_DOCUMENT_VERSION) {
    return value;
  }

  if (value.version === V16_DOCUMENT_VERSION) {
    return migrateV16Document(value);
  }

  if (typeof value.version !== "string" || value.version.length === 0) {
    throw new UnsupportedDocumentVersionError(
      "Document is missing a supported version."
    );
  }

  throw new UnsupportedDocumentVersionError(
    `Unsupported document version: ${value.version}`
  );
};
