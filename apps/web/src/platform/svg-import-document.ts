import {
  ARTBOARD_HEIGHT,
  ARTBOARD_WIDTH,
  createDefaultGroupNode,
  createDefaultPathNode,
  round,
  withPathNodeContours,
} from "@punchpress/engine";
import paper from "paper/dist/paper-core.js";

const SUPPORTED_ITEM_CLASSES = new Set(["CompoundPath", "Path", "Shape"]);
const SVG_SOURCE_NODE_NAME_KEY = "svgSourceNodeName";
const SVG_SOURCE_ITEM_NAME_KEY = "svgSourceItemName";
const SVG_SOURCE_OPACITY_KEY = "svgSourceOpacity";
const RGB_STORAGE_COLOR_REGEX = /^rgb\((\d+),(\d+),(\d+)\)$/;
type ImportedSvgNode =
  | ReturnType<typeof createDefaultGroupNode>
  | ReturnType<typeof createDefaultPathNode>;

interface ImportSvgToNodesOptions {
  targetCenter?: {
    x: number;
    y: number;
  } | null;
}

const roundCoordinate = (value: number) => round(value, 3);

const clampOpacity = (value: unknown) => {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 1;
};

const parseSvgOpacity = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const opacity = Number.parseFloat(value);

  return Number.isFinite(opacity) ? clampOpacity(opacity) : null;
};

const roundHandle = (point: { x: number; y: number }) => {
  return {
    x: roundCoordinate(point.x),
    y: roundCoordinate(point.y),
  };
};

const isSolidColor = (color: paper.Color | null | undefined) => {
  return !color || color.type !== "gradient";
};

const toHexChannel = (value: number) => {
  return Math.round(value).toString(16).padStart(2, "0");
};

const parseRgbStorageColor = (value: string) => {
  const match = value.match(RGB_STORAGE_COLOR_REGEX);

  if (!match) {
    return null;
  }

  return `#${toHexChannel(Number(match[1]))}${toHexChannel(Number(match[2]))}${toHexChannel(Number(match[3]))}`;
};

const toStorageColor = (color: paper.Color | null | undefined) => {
  if (!color) {
    return null;
  }

  const value = color.toCSS(false);

  return parseRgbStorageColor(value) || value;
};

const getSvgSourceNodeName = (item: paper.Item) => {
  const data = item.data as Record<string, unknown> | undefined;
  const value = data?.[SVG_SOURCE_NODE_NAME_KEY];

  return typeof value === "string" ? value : null;
};

const getSvgSourceItemName = (item: paper.Item) => {
  const data = item.data as Record<string, unknown> | undefined;
  const value = data?.[SVG_SOURCE_ITEM_NAME_KEY];

  return typeof value === "string" ? value : null;
};

const getSvgSourceOpacity = (item: paper.Item) => {
  const data = item.data as Record<string, unknown> | undefined;
  const value = data?.[SVG_SOURCE_OPACITY_KEY];

  return typeof value === "number" ? value : null;
};

const getSvgElementOpacity = (node: Element) => {
  const opacity = parseSvgOpacity(node.getAttribute("opacity"));

  if (opacity !== null) {
    return opacity;
  }

  const styleOpacity = node
    .getAttribute("style")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("opacity:"))
    ?.split(":")
    .at(1)
    ?.trim();

  return parseSvgOpacity(styleOpacity);
};

const getItemOpacity = (item: paper.Item) => {
  return getSvgSourceOpacity(item) ?? clampOpacity(item.opacity);
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

const getSvgElementImportName = (node: Element) => {
  const nameAttributes = ["inkscape:label", "data-name", "id", "name"];

  for (const attribute of nameAttributes) {
    const value = node.getAttribute(attribute)?.trim();

    if (value) {
      return value;
    }
  }

  return null;
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

const createContourFromPath = (path: paper.Path, center: paper.Point) => {
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

  return Boolean(
    getItemFillColor(item) || (getItemStrokeColor(item) && strokeWidth > 0)
  );
};

const createPathNodeFromItem = (
  item: paper.Item,
  importedCenter: paper.Point,
  parentId: string,
  targetCenter: { x: number; y: number }
) => {
  const fillColor = getItemFillColor(item);
  const strokeColor = getItemStrokeColor(item);

  if (!(isSolidColor(fillColor) && isSolidColor(strokeColor))) {
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
  const basePathNode = createDefaultPathNode(parentId);

  return [
    withPathNodeContours(
      {
        ...basePathNode,
        fill: toStorageColor(fillColor),
        fillRule: item.fillRule === "evenodd" ? "evenodd" : "nonzero",
        opacity: getItemOpacity(item),
        parentId,
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
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: roundCoordinate(center.x - importedCenter.x + targetCenter.x),
          y: roundCoordinate(center.y - importedCenter.y + targetCenter.y),
        },
        visible: true,
      },
      paths.map((path) => createContourFromPath(path, center))
    ),
  ];
};

const isImportableContainerItem = (item: paper.Item) => {
  return item.className === "Group" || item.className === "Layer";
};

const canImportItem = (item: paper.Item | null): item is paper.Item => {
  return Boolean(
    item &&
      item.visible !== false &&
      !item.clipMask &&
      !item.guide &&
      !item.locked
  );
};

const getImportedGroupName = (item: paper.Item) => {
  return getSvgSourceItemName(item) || item.name || "Group";
};

const createImportedNodeTree = ({
  importedCenter,
  item,
  parentId,
  rootItem,
  targetCenter,
}: {
  importedCenter: paper.Point;
  item: paper.Item | null;
  parentId: string;
  rootItem: paper.Item | null;
  targetCenter: { x: number; y: number };
}): ImportedSvgNode[] => {
  if (!canImportItem(item)) {
    return [];
  }

  if (isImportableContainerItem(item)) {
    const shouldPreserveGroup =
      item !== rootItem && getSvgSourceNodeName(item) !== "svg";
    const groupNode = shouldPreserveGroup
      ? createDefaultGroupNode(getImportedGroupName(item))
      : null;
    const childParentId = groupNode?.id || parentId;
    const childNodes = item.children.flatMap((child) => {
      return createImportedNodeTree({
        importedCenter,
        item: child,
        parentId: childParentId,
        rootItem,
        targetCenter,
      });
    });

    if (!(groupNode && childNodes.length > 0)) {
      return childNodes;
    }

    return [
      {
        ...groupNode,
        opacity: getItemOpacity(item),
        parentId,
      },
      ...childNodes,
    ];
  }

  if (!SUPPORTED_ITEM_CLASSES.has(item.className)) {
    return [];
  }

  return (
    createPathNodeFromItem(item, importedCenter, parentId, targetCenter) || []
  );
};

export const importSvgToNodes = (
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
          [SVG_SOURCE_ITEM_NAME_KEY]:
            node instanceof Element ? getSvgElementImportName(node) : null,
          [SVG_SOURCE_NODE_NAME_KEY]: node.nodeName.toLowerCase(),
          [SVG_SOURCE_OPACITY_KEY]:
            node instanceof Element ? getSvgElementOpacity(node) : null,
        };
      },
    });
    const importedGroup = createDefaultGroupNode("Imported SVG");

    if (!importedItem) {
      throw new Error("No supported SVG path artwork found.");
    }

    const importedCenter = importedItem.bounds.center;
    const targetCenter = options.targetCenter || {
      x: ARTBOARD_WIDTH / 2,
      y: ARTBOARD_HEIGHT / 2,
    };
    const nodes = createImportedNodeTree({
      importedCenter,
      item: importedItem,
      parentId: importedGroup.id,
      rootItem: importedItem,
      targetCenter,
    });

    if (nodes.length === 0) {
      throw new Error("No supported SVG path artwork found.");
    }

    return [importedGroup, ...nodes];
  } finally {
    scope.project.clear();
  }
};
