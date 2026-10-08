import { canAlignPaths } from "../appearance/appearance-render-plan";
import { getVisiblePaintExtent } from "../appearance/paint-extent";
import {
  getVectorChildPathNodes,
  getVectorPathComposition,
} from "../nodes/vector/vector-path-composition";
import { createHeadlessPaperCompiler } from "../primitives/headless-paper-compiler";
import {
  createPaintedHitRegion,
  withNodeGeometryBehavior,
} from "../primitives/node-geometry";

const PAINT_NODE_TYPES = new Set(["path", "shape", "text"]);
const FLATNESS = 1.5;

const paperCompiler = createHeadlessPaperCompiler();

// Whether a node visibly paints at a world point: some enabled fill or stroke
// layer with non-zero opacity covers it. Reuses the node's engine hit regions
// (fill rule, stroke alignment and reach, the interaction tolerance) with the
// extent narrowed to visible layers. Nodes without an appearance stack
// (images, rasters) paint their own content and keep their hit regions.
export const isNodePaintedAt = (editor, nodeId, point) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return false;
  }

  if (node.type === "vector") {
    return getVectorPathComposition(node) === "independent"
      ? getVectorChildPathNodes(editor, node.id).some((pathNode) => {
          return (
            editor.isNodeEffectivelyVisible(pathNode.id) &&
            isNodePaintedAt(editor, pathNode.id, point)
          );
        })
      : isComposedVectorPaintedAt(editor, node.id, point);
  }

  if (!PAINT_NODE_TYPES.has(node.type)) {
    return editor.hitTestNodePoint(nodeId, point);
  }

  const paths = editor.getNodeRenderGeometry(nodeId)?.paths || [];
  const paint = getVisiblePaintExtent(node, canAlignPaths(paths));

  if (!hasPaint(paint)) {
    return false;
  }

  return editor.hitTestNodePoint(nodeId, point, { paint });
};

// Compound and boolean vectors paint one compiled result with the style
// child's stack, so test that result: clicks pass through cutouts and
// fill-rule holes, and strokes follow the result's alignment.
export const isComposedVectorPaintedAt = (editor, vectorNodeId, point) => {
  const geometry = editor.getNodeRenderGeometry(vectorNodeId);
  const entries = (geometry?.paths || []).filter((entry) => entry.d);

  // An empty result (e.g. a disjoint intersection) paints nothing.
  if (!(geometry?.bbox && entries.length > 0)) {
    return false;
  }

  return entries.some((entry) => {
    const styleNode = editor.getNode(entry.styleNodeId);
    const paint = getVisiblePaintExtent(
      styleNode,
      entry.hasClosedContour !== false
    );

    if (!(styleNode && hasPaint(paint))) {
      return false;
    }

    const region = createPaintedHitRegion({
      contours: getFlattenedContours(entry.d),
      fill: paint.filled ? "paint" : null,
      fillRule: entry.fillRule === "evenodd" ? "evenodd" : "nonzero",
      insideReach: paint.insideReach,
      outsideReach: paint.outsideReach,
      stroke: "paint",
    });

    return withNodeGeometryBehavior({
      bbox: geometry.bbox,
      hitRegions: [region],
    }).hitTestPoint(point);
  });
};

const hasPaint = (paint) => {
  return paint.filled || paint.insideReach > 0 || paint.outsideReach > 0;
};

// Compiled results are world-space path data; flatten them into the polygon
// contours the engine hit regions test.
const getFlattenedContours = (d: string) => {
  return paperCompiler.run((scope) => {
    const item = scope.PathItem.create(d);
    const paths = item.className === "CompoundPath" ? item.children : [item];

    return paths
      .filter((path) => path.segments.length > 0)
      .map((path) => {
        path.flatten(FLATNESS);

        return {
          closed: path.closed,
          points: path.segments.map((segment) => ({
            x: segment.point.x,
            y: segment.point.y,
          })),
        };
      });
  });
};
