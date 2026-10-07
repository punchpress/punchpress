import type paper from "paper/dist/paper-core.js";
import { finishEditingIfNeeded } from "../../editing/editing-actions";
import { buildNodeCapabilityGeometry } from "../../nodes/node-capabilities";
import { createDefaultPathNode } from "../../nodes/path/model";
import {
  getPathNodeContours,
  withPathNodeContours,
} from "../../nodes/path/path-contours";
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

const isClosedPathNode = (pathNode) => {
  return getPathNodeContours(pathNode).every((contour) => contour.closed);
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
  matrix,
  point,
  handle
) => {
  const transformedPoint = matrix.transform(point);
  const transformedHandlePoint = matrix.transform(point.add(handle));

  return transformedHandlePoint.subtract(transformedPoint);
};

const createContourFromPaperPath = (path, center) => {
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

const getPaperResultPaths = (item) => {
  if (item.className === "CompoundPath") {
    return item.children.filter((child) => {
      return child.className === "Path" && child.segments.length > 0;
    });
  }

  if (item.className === "Path") {
    const path = item as any;
    return path.segments.length > 0 ? [path] : [];
  }

  return [];
};

// The whole stack of the style source carries over to the result.
const getStyleTemplateFromNode = (editor, node) => {
  if (node?.type === "path") {
    return { appearance: node.appearance, fillRule: node.fillRule };
  }

  if (node?.type === "shape") {
    return { appearance: node.appearance, fillRule: "nonzero" };
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
      return isClosedPathNode(node) ? { node, pathNodes: [node] } : null;
    }

    if (node.type === "shape") {
      return { node, pathNodes: [] };
    }

    const pathNodes = editor
      .getChildNodeIds(node.id)
      .map((nodeId) => editor.getNode(nodeId))
      .filter((childNode) => childNode?.type === "path");

    if (
      !(pathNodes.length > 0 && pathNodes.every(isClosedPathNode))
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
  scope,
  item,
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

const createPaperItemFromLeafNode = (scope, node) => {
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

const createPaperItemFromSource = (scope, source) => {
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
  sourceItems
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

const createResultNodes = (editor, resultItem, selection) => {
  const { parentId, styleTemplate } = selection;
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

    return withPathNodeContours(
      {
        ...baseNode,
        appearance: styleTemplate.appearance,
        fillRule: styleTemplate.fillRule,
        transform: pathTransform,
      },
      [contour]
    );
  });

  if (parentNode?.type === "vector") {
    return pathNodes;
  }

  const bottomOperand = selection.sources[0]?.node;
  const vectorNode = {
    ...createDefaultVectorContainerNode(),
    compoundWrapper: false,
    id: resultVectorId,
    // The result keeps the bottom vector operand's layer name.
    ...(bottomOperand?.type === "vector" && bottomOperand.name
      ? { name: bottomOperand.name }
      : {}),
    parentId,
    pathComposition: paths.length > 1 ? "compound-fill" : "independent",
  };

  return [vectorNode, ...pathNodes];
};

// Pairs path operands with result paths under the same parent, bottom first,
// so recreated paths keep the operands' generated layer labels.
const getOperandLabelReplacements = (selection, resultNodes) => {
  const operands = selection.sources
    .map((source) => source.node)
    .filter((node) => node.type === "path");
  const results = resultNodes.filter((node) => {
    return node.type === "path" && node.parentId === selection.parentId;
  });

  return results.slice(0, operands.length).map((toNode, index) => ({
    fromNodeId: operands[index].id,
    toNode,
  }));
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

    return createResultNodes(editor, resultItem, selection);
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

    editor.nodeTree.inheritGeneratedLayerLabels(
      editor.nodes,
      getOperandLabelReplacements(selection, resultNodes)
    );
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
