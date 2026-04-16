import {
  ARTBOARD_HEIGHT,
  ARTBOARD_WIDTH,
  createDefaultPathNode,
  createDefaultVectorNode,
  round,
} from "@punchpress/engine";
import {
  type PathNodeDocument,
  type VectorNodeDocument,
} from "@punchpress/punch-schema";
import paper from "paper/dist/paper-core";

const SUPPORTED_ITEM_CLASSES = new Set(["CompoundPath", "Path", "Shape"]);
const SVG_SOURCE_NODE_NAME_KEY = "svgSourceNodeName";

interface ImportSvgToNodesOptions {
  targetCenter?: {
    x: number;
    y: number;
  } | null;
}

const roundCoordinate = (value: number) => round(value, 3);

const roundHandle = (point: { x: number; y: number }) => {
  return {
    x: roundCoordinate(point.x),
    y: roundCoordinate(point.y),
  };
};

const isSolidColor = (color: paper.Color | null | undefined) => {
  return !color || color.type !== "gradient";
};

const toStorageColor = (color: paper.Color | null | undefined) => {
  return color ? color.toCSS(false) : null;
};

const getSvgSourceNodeName = (item: paper.Item) => {
  const data = item.data as Record<string, unknown> | undefined;
  const value = data?.[SVG_SOURCE_NODE_NAME_KEY];

  return typeof value === "string" ? value : null;
};

const getItemFillColor = (item: paper.Item) => {
  if (getSvgSourceNodeName(item) === "line") {
    return null;
  }

  return item.hasFill() ? item.fillColor : null;
};

const getItemStrokeColor = (item: paper.Item) => {
  return item.hasStroke() ? item.strokeColor : null;
};

const parseSvgRoot = (source: string) => {
  if (typeof DOMParser === "undefined") {
    throw new Error("SVG import requires DOMParser support.");
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(source.trim(), "image/svg+xml");
  const root = document.documentElement;

  if (!root || root.nodeName.toLowerCase() !== "svg") {
    throw new Error("Invalid SVG document.");
  }

  return root as unknown as SVGElement;
};

const createPaperScope = () => {
  const scope = new paper.PaperScope();

  scope.setup(new paper.Size(1, 1));

  return scope;
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

const createContourFromPath = (
  path: paper.Path,
  center: paper.Point
): Pick<PathNodeDocument, "closed" | "segments"> => {
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

const collectImportableItems = (item: paper.Item | null): paper.Item[] => {
  if (
    !item ||
    item.visible === false ||
    item.clipMask ||
    item.guide ||
    item.locked
  ) {
    return [];
  }

  if (item.className === "Group" || item.className === "Layer") {
    return item.children.flatMap((child) => collectImportableItems(child));
  }

  if (!SUPPORTED_ITEM_CLASSES.has(item.className)) {
    return [];
  }

  return [item];
};

const getPathChildren = (item: paper.Item) => {
  if (item.className === "CompoundPath") {
    return item.children.filter((child): child is paper.Path => {
      return child.className === "Path" && child.segments.length > 0;
    });
  }

  if (item.className === "Shape") {
    const path = (item as paper.Shape).toPath(false);
    return path.segments.length > 0 ? [path] : [];
  }

  if (item.className === "Path") {
    const path = item as paper.Path;
    return path.segments.length > 0 ? [path] : [];
  }

  return [];
};

const hasVisiblePaint = (item: paper.Item) => {
  const strokeWidth = item.strokeWidth || 0;

  return Boolean(getItemFillColor(item) || (getItemStrokeColor(item) && strokeWidth > 0));
};

const createVectorNodesFromItem = (
  item: paper.Item,
  importedCenter: paper.Point,
  targetCenter: { x: number; y: number }
) => {
  const fillColor = getItemFillColor(item);
  const strokeColor = getItemStrokeColor(item);

  if (!isSolidColor(fillColor) || !isSolidColor(strokeColor)) {
    return null;
  }

  if (!hasVisiblePaint(item)) {
    return null;
  }

  const paths = getPathChildren(item);

  if (paths.length === 0) {
    return null;
  }

  const center = item.bounds.center;
  const vectorNode = createDefaultVectorNode();
  const pathTransform = {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x: roundCoordinate(center.x - importedCenter.x + targetCenter.x),
    y: roundCoordinate(center.y - importedCenter.y + targetCenter.y),
  };
  const pathNodes = paths.map((path) => {
    const baseNode = createDefaultPathNode(vectorNode.id);
    const contour = createContourFromPath(path, center);

    return {
      ...baseNode,
      closed: contour.closed,
      fill: toStorageColor(fillColor),
      fillRule: item.fillRule === "evenodd" ? "evenodd" : "nonzero",
      segments: contour.segments,
      stroke: toStorageColor(strokeColor),
      strokeLineCap:
        item.strokeCap === "round" || item.strokeCap === "square"
          ? item.strokeCap
          : "butt",
      strokeLineJoin:
        item.strokeJoin === "bevel" || item.strokeJoin === "round"
          ? item.strokeJoin
          : "miter",
      strokeMiterLimit: roundCoordinate(item.miterLimit || 0),
      strokeWidth: roundCoordinate(item.strokeWidth || 0),
      transform: pathTransform,
    } satisfies PathNodeDocument;
  });

  return [
    {
      ...vectorNode,
      name: item.name || vectorNode.name,
    } satisfies VectorNodeDocument,
    ...pathNodes,
  ];
};

export const importSvgToNodes = async (
  source: string,
  options: ImportSvgToNodesOptions = {}
) => {
  const scope = createPaperScope();

  try {
    const root = parseSvgRoot(source);
    const importedItem = scope.project.importSVG(root, {
      applyMatrix: true,
      expandShapes: true,
      insert: false,
      onImport: (node, item) => {
        item.data = {
          ...item.data,
          [SVG_SOURCE_NODE_NAME_KEY]: node.nodeName.toLowerCase(),
        };
      },
    });
    const importableItems = collectImportableItems(importedItem);

    if (importableItems.length === 0) {
      throw new Error("No supported SVG path artwork found.");
    }

    const importedCenter = importedItem.bounds.center;
    const targetCenter = options.targetCenter || {
      x: ARTBOARD_WIDTH / 2,
      y: ARTBOARD_HEIGHT / 2,
    };
    const nodes = importableItems.flatMap((item) => {
      return createVectorNodesFromItem(item, importedCenter, targetCenter) || [];
    });

    if (nodes.length === 0) {
      throw new Error("No supported SVG path artwork found.");
    }

    return nodes;
  } finally {
    scope.project.clear();
  }
};
