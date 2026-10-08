import type {
  Appearance,
  AppearanceDraw,
  AppearanceObject,
  AppearancePass,
  AppearancePath,
} from "./appearance-types";
import { getNodeAppearance } from "./node-appearance";
import { getPaintPrimaryColor } from "./paint";

interface GeometryPath extends AppearancePath {
  styleNodeId?: string;
}

interface PaintGeometry {
  paintBox?: AppearanceObject["paintBox"];
  paths?: readonly GeometryPath[] | null;
}

interface CachedObjects {
  objects: readonly AppearanceObject[];
  styleNodes: readonly unknown[];
}

const objectsByPaths = new WeakMap<readonly GeometryPath[], CachedObjects>();
const drawsByAppearance = new WeakMap<Appearance, readonly AppearanceDraw[]>();
const pairedPassesByDraws = new WeakMap<
  readonly AppearanceDraw[],
  readonly AppearancePass[]
>();
const separatePassesByDraws = new WeakMap<
  readonly AppearanceDraw[],
  readonly AppearancePass[]
>();

// Groups a node's geometry paths into painted objects. Leaf nodes paint every
// path with their own stack; vector render entries name the child path whose
// stack paints them (`styleNodeId`), and that child's opacity becomes the
// object's group opacity. Node opacity is applied by the caller.
export const buildAppearanceObjects = (
  node,
  geometry: PaintGeometry | null | undefined,
  getNode: (nodeId: string) => unknown
): readonly AppearanceObject[] => {
  const paths = geometry?.paths;

  if (!(node && paths?.length)) {
    return [];
  }

  const styleNodeIds = getStyleNodeIds(node.id, paths);
  const styleNodes = styleNodeIds.map((styleNodeId) => {
    return styleNodeId === node.id ? node : getNode(styleNodeId);
  });
  const cached = objectsByPaths.get(paths);

  if (cached && haveSameNodes(cached.styleNodes, styleNodes)) {
    return cached.objects;
  }

  const pathsByStyleNodeId = groupPathsByStyleNode(node.id, paths);
  const objects = styleNodeIds.flatMap((styleNodeId, index) => {
    const styleNode = styleNodes[index] as { opacity?: number } | undefined;

    if (!styleNode) {
      return [];
    }

    const objectPaths = pathsByStyleNodeId.get(styleNodeId) ?? [];
    const draws = getAppearanceDraws(getNodeAppearance(styleNode));
    const childPaintBox = objectPaths.find((path) => path.paintBox)?.paintBox;

    return [
      {
        draws,
        key: `${node.id}:${styleNodeId}`,
        opacity:
          styleNodeId === node.id
            ? 1
            : typeof styleNode.opacity === "number"
              ? styleNode.opacity
              : 1,
        paintBox: childPaintBox ?? geometry?.paintBox ?? null,
        paintSpace: childPaintBox ? ("path" as const) : ("node" as const),
        passes: getAppearancePasses(draws, objectPaths.length === 1),
        paths: objectPaths,
        styleNodeId,
      },
    ];
  });

  objectsByPaths.set(paths, { objects, styleNodes });

  return objects;
};

// Enabled, visible layers in paint order: fills bottom→top, then strokes.
export const getAppearanceDraws = (
  appearance: Appearance
): readonly AppearanceDraw[] => {
  const cached = drawsByAppearance.get(appearance);

  if (cached) {
    return cached;
  }

  const draws: AppearanceDraw[] = [];

  for (const layer of appearance.fills) {
    if (layer.enabled && layer.opacity > 0) {
      draws.push({
        kind: "fill",
        layerId: layer.id,
        opacity: layer.opacity,
        paint: layer.paint,
      });
    }
  }

  for (const layer of appearance.strokes) {
    if (layer.enabled && layer.opacity > 0 && layer.width > 0) {
      draws.push({
        cap: layer.cap,
        join: layer.join,
        kind: "stroke",
        layerId: layer.id,
        miterLimit: layer.miterLimit,
        opacity: layer.opacity,
        paint: layer.paint,
        width: layer.width,
      });
    }
  }

  drawsByAppearance.set(appearance, draws);

  return draws;
};

// A fill may share an element with the stroke right after it only when the
// object paints a single geometry path. With several paths (text glyphs,
// multi-contour vectors), every fill must paint under every stroke, so each
// draw gets its own pass across all paths.
export const getAppearancePasses = (
  draws: readonly AppearanceDraw[],
  canPair: boolean
): readonly AppearancePass[] => {
  const cache = canPair ? pairedPassesByDraws : separatePassesByDraws;
  const cached = cache.get(draws);

  if (cached) {
    return cached;
  }

  const passes: AppearancePass[] = [];

  for (const draw of draws) {
    const previous = passes.at(-1);

    if (
      canPair &&
      draw.kind === "stroke" &&
      previous?.fill &&
      !previous.stroke
    ) {
      previous.stroke = draw;
      previous.key = `${previous.key}+${draw.layerId}`;
      continue;
    }

    passes.push({
      fill: draw.kind === "fill" ? draw : null,
      key: draw.layerId,
      stroke: draw.kind === "stroke" ? draw : null,
    });
  }

  cache.set(draws, passes);

  return passes;
};

// The first enabled fill and stroke as plain colors (a gradient shows its first
// stop), for surfaces that can only paint one color each: the
// unavailable-font `<text>` fallback.
export const getPrimaryPaint = (appearance: Appearance) => {
  const draws = getAppearanceDraws(appearance);
  const fill = draws.find((draw) => draw.kind === "fill");
  const stroke = draws.find((draw) => draw.kind === "stroke");

  return {
    fill: fill ? getPaintPrimaryColor(fill.paint) : "none",
    fillOpacity: fill?.opacity ?? 1,
    stroke: stroke ? getPaintPrimaryColor(stroke.paint) : "none",
    strokeOpacity: stroke?.opacity ?? 1,
    strokeWidth: stroke?.kind === "stroke" ? stroke.width : 0,
  };
};

const getStyleNodeIds = (nodeId: string, paths: readonly GeometryPath[]) => {
  const ids = new Set<string>();

  for (const path of paths) {
    ids.add(path.styleNodeId ?? nodeId);
  }

  return [...ids];
};

const groupPathsByStyleNode = (
  nodeId: string,
  paths: readonly GeometryPath[]
) => {
  const buckets = new Map<string, GeometryPath[]>();

  for (const path of paths) {
    const styleNodeId = path.styleNodeId ?? nodeId;
    const bucket = buckets.get(styleNodeId);

    if (bucket) {
      bucket.push(path);
    } else {
      buckets.set(styleNodeId, [path]);
    }
  }

  return buckets;
};

const haveSameNodes = (a: readonly unknown[], b: readonly unknown[]) => {
  return a.length === b.length && a.every((node, index) => node === b[index]);
};
