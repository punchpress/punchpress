import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
} from "@punchpress/punch-schema";
import { createHeadlessPaperCompiler } from "../../primitives/headless-paper-compiler";
import { format } from "../../primitives/math";
import {
  getNodeRotation,
  getNodeScaleX,
  getNodeScaleY,
  getNodeX,
  getNodeY,
} from "../text/model";
import {
  BOOLEAN_PATH_COMPOSITIONS,
  getVectorBooleanMethodName,
  getVectorPathComposition,
} from "./vector-path-composition";

const getWorldBounds = (node, bbox) => {
  if (!bbox) {
    return null;
  }

  return {
    height: bbox.height,
    maxX: getNodeX(node) + bbox.maxX,
    maxY: getNodeY(node) + bbox.maxY,
    minX: getNodeX(node) + bbox.minX,
    minY: getNodeY(node) + bbox.minY,
    width: bbox.width,
  };
};

const unionBounds = (boundsList) => {
  const firstBounds = boundsList[0];

  if (!firstBounds) {
    return null;
  }

  return boundsList.slice(1).reduce(
    (bounds, currentBounds) => ({
      height:
        Math.max(bounds.maxY, currentBounds.maxY) -
        Math.min(bounds.minY, currentBounds.minY),
      maxX: Math.max(bounds.maxX, currentBounds.maxX),
      maxY: Math.max(bounds.maxY, currentBounds.maxY),
      minX: Math.min(bounds.minX, currentBounds.minX),
      minY: Math.min(bounds.minY, currentBounds.minY),
      width:
        Math.max(bounds.maxX, currentBounds.maxX) -
        Math.min(bounds.minX, currentBounds.minX),
    }),
    firstBounds
  );
};

const buildNodeSvgTransform = (node, bbox) => {
  const transforms: string[] = [];
  const x = getNodeX(node) || 0;
  const y = getNodeY(node) || 0;

  if (x || y) {
    transforms.push(`translate(${format(x)} ${format(y)})`);
  }

  const rotation = getNodeRotation(node) || 0;
  const scaleX = getNodeScaleX(node) ?? 1;
  const scaleY = getNodeScaleY(node) ?? 1;

  if (!(bbox && (rotation || scaleX !== 1 || scaleY !== 1))) {
    return transforms.length > 0 ? transforms.join(" ") : null;
  }

  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;

  transforms.push(`translate(${format(centerX)} ${format(centerY)})`);

  if (rotation) {
    transforms.push(`rotate(${format(rotation)})`);
  }

  if (scaleX !== 1 || scaleY !== 1) {
    transforms.push(`scale(${format(scaleX)} ${format(scaleY)})`);
  }

  transforms.push(`translate(${format(-centerX)} ${format(-centerY)})`);

  return transforms.join(" ");
};

const getPathStyle = (node) => {
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
};

const toRenderEntries = (pathNode, geometry) => {
  if (!(geometry?.paths?.length > 0 && geometry.bbox)) {
    return [];
  }

  const transform = buildNodeSvgTransform(pathNode, geometry.bbox);
  const style = getPathStyle(pathNode);

  return geometry.paths.map((path, index) => ({
    closed: path.closed,
    d: path.d,
    fill: style.fill,
    fillRule: style.fillRule,
    key: `${pathNode.id}-${index}`,
    stroke: style.stroke,
    strokeLineCap: style.strokeLineCap,
    strokeLineJoin: style.strokeLineJoin,
    strokeMiterLimit: style.strokeMiterLimit,
    strokeWidth: style.strokeWidth,
    transform,
  }));
};

const paperCompiler = createHeadlessPaperCompiler();

const applyPathNodeTransform = (scope, item, node, bbox) => {
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

const createPaperItemFromPathNode = (scope, pathNode, geometry) => {
  if (!(geometry?.paths?.length > 0 && geometry.bbox)) {
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

  item.fillRule = pathNode.fillRule === "evenodd" ? "evenodd" : "nonzero";
  applyPathNodeTransform(scope, item, pathNode, geometry.bbox);

  return item;
};

const expandBounds = (bounds, strokeWidth = 0) => {
  if (!bounds) {
    return null;
  }

  const strokeInset = Math.max(0, strokeWidth) / 2;

  return {
    height: bounds.height + strokeInset * 2,
    maxX: bounds.maxX + strokeInset,
    maxY: bounds.maxY + strokeInset,
    minX: bounds.minX - strokeInset,
    minY: bounds.minY - strokeInset,
    width: bounds.width + strokeInset * 2,
  };
};

const toBounds = (bounds) => {
  if (!bounds) {
    return null;
  }

  return {
    height: bounds.height,
    maxX: bounds.right,
    maxY: bounds.bottom,
    minX: bounds.left,
    minY: bounds.top,
    width: bounds.width,
  };
};

const getPaperResultPaths = (item) => {
  if (item.className === "CompoundPath") {
    return item.children.filter((child) => {
      return child.className === "Path" && child.segments.length > 0;
    });
  }

  if (item.className === "Path" && item.segments.length > 0) {
    return [item];
  }

  return [];
};

const getPaperPathSelectionPoints = (paths) => {
  return paths.flatMap((path) => {
    return path.segments.flatMap((segment) => {
      const points = [
        {
          x: segment.point.x,
          y: segment.point.y,
        },
      ];

      if (segment.handleIn.x || segment.handleIn.y) {
        points.push({
          x: segment.point.x + segment.handleIn.x,
          y: segment.point.y + segment.handleIn.y,
        });
      }

      if (segment.handleOut.x || segment.handleOut.y) {
        points.push({
          x: segment.point.x + segment.handleOut.x,
          y: segment.point.y + segment.handleOut.y,
        });
      }

      return points;
    });
  });
};

const buildCompoundFillEntries = (vectorNode, pathNodes, getPathGeometry) => {
  return paperCompiler.run((scope) => {
    const sourceItems = pathNodes
      .map((pathNode) => {
        return createPaperItemFromPathNode(
          scope,
          pathNode,
          getPathGeometry(pathNode)
        );
      })
      .filter(Boolean);

    if (sourceItems.length !== pathNodes.length) {
      return null;
    }

    const boundsItem = new scope.Group();

    for (const item of sourceItems) {
      item.clone().addTo(boundsItem);
    }

    const resultPaths = sourceItems.flatMap((item) =>
      getPaperResultPaths(item)
    );
    const style = getPathStyle(pathNodes.at(-1) || pathNodes[0]);
    const bounds = expandBounds(toBounds(boundsItem.bounds), style.strokeWidth);

    if (!(bounds && resultPaths.length > 0)) {
      return null;
    }

    return {
      bounds,
      entries: [
        {
          closed: resultPaths.every((path) => path.closed),
          d: resultPaths
            .map((path) => path.pathData || path.getPathData())
            .join(" "),
          fill: style.fill,
          fillRule: style.fillRule,
          key: `${vectorNode.id}-compound-fill`,
          stroke: style.stroke,
          strokeLineCap: style.strokeLineCap,
          strokeLineJoin: style.strokeLineJoin,
          strokeMiterLimit: style.strokeMiterLimit,
          strokeWidth: style.strokeWidth,
          transform: null,
        },
      ],
      selectionPoints: getPaperPathSelectionPoints(resultPaths),
    };
  });
};

const buildBooleanCompoundEntries = (
  vectorNode,
  pathNodes,
  getPathGeometry,
  pathComposition
) => {
  return paperCompiler.run((scope) => {
    const sourceItems = pathNodes
      .map((pathNode) => {
        return createPaperItemFromPathNode(
          scope,
          pathNode,
          getPathGeometry(pathNode)
        );
      })
      .filter(Boolean);

    if (sourceItems.length !== pathNodes.length) {
      return null;
    }

    const [firstItem, ...restItems] = sourceItems;

    if (!firstItem) {
      return null;
    }

    const methodName = getVectorBooleanMethodName(pathComposition);
    const resultItem = restItems.reduce((currentItem, item) => {
      return currentItem[methodName](item);
    }, firstItem);
    const style = getPathStyle(pathNodes.at(-1) || pathNodes[0]);
    const bounds = expandBounds(toBounds(resultItem.bounds), style.strokeWidth);
    const entries = getPaperResultPaths(resultItem).map((path, index) => ({
      closed: path.closed,
      d: path.pathData || path.getPathData(),
      fill: style.fill,
      fillRule: style.fillRule,
      key: `${vectorNode.id}-boolean-${index}`,
      stroke: style.stroke,
      strokeLineCap: style.strokeLineCap,
      strokeLineJoin: style.strokeLineJoin,
      strokeMiterLimit: style.strokeMiterLimit,
      strokeWidth: style.strokeWidth,
      transform: null,
    }));
    const selectionPoints = getPaperPathSelectionPoints(
      getPaperResultPaths(resultItem)
    );

    return bounds && entries.length > 0
      ? { bounds, entries, selectionPoints }
      : null;
  });
};

const appendDefaultRenderEntries = (
  pathNodes,
  bounds,
  readyEntries,
  getPathGeometry
) => {
  for (const pathNode of pathNodes) {
    const geometry = getPathGeometry(pathNode);
    const worldBounds = getWorldBounds(pathNode, geometry?.bbox || null);

    if (worldBounds) {
      bounds.push(worldBounds);
    }

    readyEntries.push(...toRenderEntries(pathNode, geometry));
  }
};

export const buildVectorRenderGeometry = (
  vectorNode,
  pathNodes,
  getPathGeometry
) => {
  const visiblePathNodes = pathNodes.filter((node) => node.visible !== false);

  if (visiblePathNodes.length === 0) {
    return null;
  }

  const pathComposition = getVectorPathComposition(vectorNode) || "independent";

  if (pathComposition === "compound-fill") {
    const compoundResult = buildCompoundFillEntries(
      vectorNode,
      visiblePathNodes,
      getPathGeometry
    );

    if (!compoundResult) {
      return null;
    }

    return {
      bbox: compoundResult.bounds,
      guide: null,
      paths: compoundResult.entries,
      ready: true,
      selectionBounds: compoundResult.bounds,
      selectionPoints: compoundResult.selectionPoints,
    };
  }

  if (BOOLEAN_PATH_COMPOSITIONS.has(pathComposition)) {
    const compoundResult = buildBooleanCompoundEntries(
      vectorNode,
      visiblePathNodes,
      getPathGeometry,
      pathComposition
    );

    if (!compoundResult) {
      return null;
    }

    return {
      bbox: compoundResult.bounds,
      guide: null,
      paths: compoundResult.entries,
      ready: true,
      selectionBounds: compoundResult.bounds,
      selectionPoints: compoundResult.selectionPoints,
    };
  }

  const bounds = [] as NonNullable<ReturnType<typeof getWorldBounds>>[];
  const readyEntries = [] as ReturnType<typeof toRenderEntries>;

  appendDefaultRenderEntries(
    visiblePathNodes,
    bounds,
    readyEntries,
    getPathGeometry
  );

  const bbox = unionBounds(bounds);

  if (!bbox) {
    return null;
  }

  return {
    bbox,
    guide: null,
    paths: readyEntries,
    ready: true,
    selectionBounds: bbox,
  };
};
