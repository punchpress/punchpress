import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
} from "@punchpress/punch-schema";
import type paper from "paper/dist/paper-core.js";
import { finishEditingIfNeeded } from "../../editing/editing-actions";
import { buildNodeCapabilityGeometry } from "../../nodes/node-capabilities";
import { createDefaultPathNode } from "../../nodes/path/model";
import {
  getNodeRotation,
  getNodeScaleX,
  getNodeScaleY,
  getNodeX,
  getNodeY,
} from "../../nodes/text/model";
import {
  createDefaultVectorContainerNode,
  createDefaultVectorNode,
} from "../../nodes/vector/model";
import { createHeadlessPaperCompiler } from "../../primitives/headless-paper-compiler";
import { round } from "../../primitives/math";

const BOOLEAN_OPERATIONS = [
  "unite",
  "subtract",
  "intersect",
  "exclude",
] as const;

type BooleanOperation = (typeof BOOLEAN_OPERATIONS)[number];

const paperCompiler = createHeadlessPaperCompiler();

const isBooleanOperation = (value: string): value is BooleanOperation => {
  return BOOLEAN_OPERATIONS.includes(value as BooleanOperation);
};

const isBooleanSourceNode = (node) => {
  return (
    node?.type === "path" || node?.type === "shape" || node?.type === "vector"
  );
};

const roundCoordinate = (value: number) => {
  return round(value, 3);
};

const roundHandle = (point: { x: number; y: number }) => {
  return {
    x: roundCoordinate(point.x),
    y: roundCoordinate(point.y),
  };
};

const transformHandle = (
  matrix: paper.Matrix,
  point: paper.Point,
  handle: paper.Point
) => {
  const transformedPoint = matrix.transform(point);
  const transformedHandlePoint = matrix.transform(point.add(handle));

  return transformedHandlePoint.subtract(transformedPoint);
};

const createContourFromPaperPath = (path: paper.Path, center: paper.Point) => {
  const matrix = path.globalMatrix;

  return {
    closed: path.closed,
    segments: path.segments.map((segment) => {
      const transformedPoint = matrix.transform(segment.point);
      const handleIn = transformHandle(matrix, segment.point, segment.handleIn);
      const handleOut = transformHandle(
        matrix,
        segment.point,
        segment.handleOut
      );

      return {
        handleIn: roundHandle(handleIn),
        handleOut: roundHandle(handleOut),
        point: roundHandle(transformedPoint.subtract(center)),
        pointType: segment.isSmooth() ? "smooth" : "corner",
      };
    }),
  };
};

const getPaperResultPaths = (item: paper.Item) => {
  if (item.className === "CompoundPath") {
    return item.children.filter((child): child is paper.Path => {
      return child.className === "Path" && child.segments.length > 0;
    });
  }

  if (item.className === "Path") {
    const path = item as paper.Path;
    return path.segments.length > 0 ? [path] : [];
  }

  return [];
};

const getStyleTemplateFromNode = (editor, node) => {
  if (node?.type === "path") {
    return {
      fill: node.fill,
      fillRule: node.fillRule,
      stroke: node.stroke,
      strokeLineCap: node.strokeLineCap ?? DEFAULT_VECTOR_STROKE_LINE_CAP,
      strokeLineJoin: node.strokeLineJoin ?? DEFAULT_VECTOR_STROKE_LINE_JOIN,
      strokeMiterLimit:
        node.strokeMiterLimit ?? DEFAULT_VECTOR_STROKE_MITER_LIMIT,
      strokeWidth: node.strokeWidth,
    };
  }

  if (node?.type === "shape") {
    return {
      fill: node.fill,
      fillRule: "nonzero",
      stroke: node.stroke,
      strokeLineCap: DEFAULT_VECTOR_STROKE_LINE_CAP,
      strokeLineJoin: DEFAULT_VECTOR_STROKE_LINE_JOIN,
      strokeMiterLimit: DEFAULT_VECTOR_STROKE_MITER_LIMIT,
      strokeWidth: node.strokeWidth,
    };
  }

  if (node?.type === "vector") {
    const childPathNodes = editor
      .getChildNodeIds(node.id)
      .map((nodeId) => editor.getNode(nodeId))
      .filter((childNode) => childNode?.type === "path");

    return getStyleTemplateFromNode(editor, childPathNodes.at(-1) || null);
  }

  return null;
};

const getBooleanSourceSelection = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  const selectedNodes = editor.nodes.filter((node) => {
    return nodeIds.includes(node.id);
  });

  if (selectedNodes.length < 2) {
    return null;
  }

  const firstNode = selectedNodes[0];

  if (
    !(
      firstNode &&
      selectedNodes.every((node) => {
        return (
          isBooleanSourceNode(node) && node.parentId === firstNode.parentId
        );
      })
    )
  ) {
    return null;
  }

  const sources = selectedNodes.map((node) => {
    if (node.type === "path") {
      return node.closed ? { node, pathNodes: [node] } : null;
    }

    if (node.type === "shape") {
      return { node, pathNodes: [] };
    }

    const pathNodes = editor
      .getChildNodeIds(node.id)
      .map((nodeId) => editor.getNode(nodeId))
      .filter((childNode) => childNode?.type === "path");

    if (
      !(pathNodes.length > 0 && pathNodes.every((pathNode) => pathNode.closed))
    ) {
      return null;
    }

    return {
      node,
      pathNodes,
    };
  });

  if (sources.some((source) => !source)) {
    return null;
  }

  const styleSourceNode = selectedNodes.at(-1) || null;
  const styleTemplate = getStyleTemplateFromNode(editor, styleSourceNode);

  if (!styleTemplate) {
    return null;
  }

  return {
    parentId: firstNode.parentId,
    sources,
    styleTemplate,
  };
};

const applyLeafNodeTransform = (
  scope: paper.PaperScope,
  item: paper.Item,
  node,
  bbox
) => {
  const center = new scope.Point(
    (bbox.minX + bbox.maxX) / 2,
    (bbox.minY + bbox.maxY) / 2
  );
  const rotation = getNodeRotation(node) || 0;
  const scaleX = getNodeScaleX(node) ?? 1;
  const scaleY = getNodeScaleY(node) ?? 1;

  if (rotation) {
    item.rotate(rotation, center);
  }

  if (scaleX !== 1 || scaleY !== 1) {
    item.scale(scaleX, scaleY, center);
  }

  item.translate(new scope.Point(getNodeX(node), getNodeY(node)));
};

const createPaperItemFromLeafNode = (scope: paper.PaperScope, node) => {
  const geometry = buildNodeCapabilityGeometry(node, null);

  if (!(geometry?.bbox && geometry.paths.length > 0)) {
    return null;
  }

  const pathItems = geometry.paths
    .map((path) => scope.PathItem.create(path.d))
    .filter(Boolean);

  if (pathItems.length === 0) {
    return null;
  }

  const item =
    pathItems.length === 1
      ? pathItems[0]
      : pathItems.reduce((compoundPath, pathItem) => {
          pathItem.addTo(compoundPath);
          return compoundPath;
        }, new scope.CompoundPath());

  item.fillRule =
    node.type === "path" && node.fillRule === "evenodd" ? "evenodd" : "nonzero";
  applyLeafNodeTransform(scope, item, node, geometry.bbox);
  return item;
};

const createPaperItemFromSource = (scope: paper.PaperScope, source) => {
  if (source.node.type === "path" || source.node.type === "shape") {
    return createPaperItemFromLeafNode(scope, source.node);
  }

  const childItems = source.pathNodes
    .map((pathNode) => createPaperItemFromLeafNode(scope, pathNode))
    .filter(Boolean);

  if (childItems.length === 0) {
    return null;
  }

  if (childItems.length === 1) {
    return childItems[0];
  }

  const compoundPath = new scope.CompoundPath();

  for (const childItem of childItems) {
    childItem.addTo(compoundPath);
  }

  compoundPath.fillRule = source.pathNodes.some(
    (pathNode) => pathNode.fillRule === "evenodd"
  )
    ? "evenodd"
    : "nonzero";

  return compoundPath;
};

const performBooleanOperation = (
  operation: BooleanOperation,
  sourceItems: paper.PathItem[]
) => {
  const [firstItem, ...restItems] = sourceItems;

  if (!firstItem) {
    return null;
  }

  if (operation === "subtract") {
    return restItems.reduce((resultItem, item) => {
      return resultItem.subtract(item);
    }, firstItem);
  }

  let methodName: "unite" | "intersect" | "exclude" = "exclude";

  if (operation === "unite") {
    methodName = "unite";
  } else if (operation === "intersect") {
    methodName = "intersect";
  }

  return restItems.reduce((resultItem, item) => {
    return resultItem[methodName](item);
  }, firstItem);
};

const createResultNodes = (
  editor,
  resultItem: paper.Item,
  parentId: string,
  styleTemplate
) => {
  const paths = getPaperResultPaths(resultItem);

  if (paths.length === 0) {
    return [];
  }

  const parentNode = parentId ? editor.getNode(parentId) : null;
  const resultVectorId =
    parentNode?.type === "vector"
      ? parentNode.id
      : createDefaultVectorNode().id;
  const center = resultItem.bounds.center;
  const pathTransform = {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x: roundCoordinate(center.x),
    y: roundCoordinate(center.y),
  };
  const pathNodes = paths.map((path) => {
    const contour = createContourFromPaperPath(path, center);
    const baseNode = createDefaultPathNode(resultVectorId);

    return {
      ...baseNode,
      closed: contour.closed,
      fill: styleTemplate.fill,
      fillRule: styleTemplate.fillRule,
      segments: contour.segments,
      stroke: styleTemplate.stroke,
      strokeLineCap: styleTemplate.strokeLineCap,
      strokeLineJoin: styleTemplate.strokeLineJoin,
      strokeMiterLimit: styleTemplate.strokeMiterLimit,
      strokeWidth: styleTemplate.strokeWidth,
      transform: pathTransform,
    };
  });

  if (parentNode?.type === "vector") {
    return pathNodes;
  }

  const vectorNode = {
    ...createDefaultVectorContainerNode(),
    compoundWrapper: false,
    id: resultVectorId,
    parentId,
    pathComposition: paths.length > 1 ? "compound-fill" : "independent",
  };

  return [vectorNode, ...pathNodes];
};

export const canApplyBooleanOperation = (
  editor,
  operation: string,
  nodeIds = editor.selectedNodeIds
) => {
  if (!isBooleanOperation(operation)) {
    return false;
  }

  return Boolean(getBooleanSourceSelection(editor, nodeIds));
};

export const applyBooleanOperation = (
  editor,
  operation: string,
  nodeIds = editor.selectedNodeIds
) => {
  if (!isBooleanOperation(operation)) {
    return false;
  }

  const selection = getBooleanSourceSelection(editor, nodeIds);

  if (!selection) {
    return false;
  }

  finishEditingIfNeeded(editor);
  editor.stopPathEditing();

  const resultNodes = paperCompiler.run((scope) => {
    const sourceItems = selection.sources
      .map((source) => createPaperItemFromSource(scope, source))
      .filter(Boolean);

    if (sourceItems.length !== selection.sources.length) {
      return [];
    }

    const resultItem = performBooleanOperation(operation, sourceItems);

    if (!resultItem) {
      return [];
    }

    return createResultNodes(
      editor,
      resultItem,
      selection.parentId,
      selection.styleTemplate
    );
  });

  if (resultNodes.length === 0) {
    return false;
  }

  editor.run(() => {
    if (
      selection.parentId &&
      editor.getNode(selection.parentId)?.type === "vector"
    ) {
      editor.getState().updateNodeById(selection.parentId, (node) => {
        if (node.type !== "vector") {
          return node;
        }

        return {
          ...node,
          compoundWrapper: false,
          pathComposition:
            resultNodes.length > 1 ? "compound-fill" : "independent",
        };
      });
    }

    editor.getState().replaceNodeBlocks(nodeIds, resultNodes);

    if (
      selection.parentId &&
      editor.getNode(selection.parentId)?.type === "vector"
    ) {
      editor.setSelectedNodes([selection.parentId]);
    }
  });

  return true;
};
