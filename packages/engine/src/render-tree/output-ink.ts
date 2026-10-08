import { getNodeFrameFromGeometry } from "../nodes/node-capabilities";
import type { Bounds } from "../appearance/appearance-types";
import { getEffectRegion } from "../effects/effect-filter";
import { getLeafEffectInk } from "../effects/effect-ink";
import { getNodeEffects } from "../effects/effect-model";
import { getLeafEffectPresentation } from "../effects/effect-owner";
import {
  getNodeRotation,
  getNodeScaleX,
  getNodeScaleY,
} from "../nodes/text/model";

// What the ink reader needs to know about a document: the canvas reads the
// editor, export reads a parsed document and its built geometry.
export interface InkSource {
  getChildNodeIds: (nodeId: string) => readonly string[];
  getNode: (nodeId: string) => any;
  getRenderFrame: (nodeId: string) => { bounds: Bounds } | null | undefined;
  getRenderGeometry: (nodeId: string) => any;
  isVisible: (nodeId: string) => boolean;
}

export const getEditorInkSource = (editor): InkSource => ({
  getChildNodeIds: (nodeId) => editor.getChildNodeIds(nodeId),
  getNode: (nodeId) => editor.getNode(nodeId),
  getRenderFrame: (nodeId) => editor.getNodeRenderFrame(nodeId),
  getRenderGeometry: (nodeId) => editor.getNodeRenderGeometry(nodeId),
  isVisible: (nodeId) => editor.isNodeEffectivelyVisible(nodeId),
});

// Export's source: the exported nodes in paint order and their built
// geometry. Frames come from the same capability the editor uses.
export const getDocumentInkSource = (
  nodes: readonly any[],
  geometryById: Map<string, any>,
  getNode: (nodeId: string) => any
): InkSource => {
  const childIds = new Map<string, string[]>();

  for (const node of nodes) {
    const siblings = childIds.get(node.parentId);

    if (siblings) {
      siblings.push(node.id);
    } else {
      childIds.set(node.parentId, [node.id]);
    }
  }

  return {
    getChildNodeIds: (nodeId) => childIds.get(nodeId) ?? [],
    getNode,
    getRenderFrame: (nodeId) => {
      const node = getNode(nodeId);
      const geometry = geometryById.get(nodeId);

      return node && geometry
        ? getNodeFrameFromGeometry(node, geometry, "render")
        : null;
    },
    getRenderGeometry: (nodeId) => geometryById.get(nodeId) ?? null,
    isVisible: (nodeId) => getNode(nodeId)?.visible !== false,
  };
};

// World-space (stage) output ink: everything a node paints, including its own
// and its descendants' shadows, as an axis-aligned box. Conservative; feeds
// group filter regions. One reader per render-tree build or export, memoized
// by id.
export const createOutputInkReader = (source: InkSource) => {
  const cache = new Map<string, Bounds | null>();

  const read = (nodeId: string): Bounds | null => {
    if (cache.has(nodeId)) {
      return cache.get(nodeId) ?? null;
    }

    const node = source.getNode(nodeId);
    const ink =
      node?.type === "group" || node?.type === "artboard"
        ? readContainer(nodeId, node)
        : readLeaf(nodeId, node);

    cache.set(nodeId, ink);

    return ink;
  };

  const readContainer = (nodeId: string, node) => {
    const children = source
      .getChildNodeIds(nodeId)
      .filter((childId) => source.isVisible(childId))
      .map(read)
      .filter(Boolean) as Bounds[];
    const content = unionBounds(children);

    if (!content || node.type !== "group") {
      return content;
    }

    const effects = getNodeEffects(node).filter((effect) => {
      return effect.enabled && effect.opacity > 0;
    });

    return effects.length > 0 ? getEffectRegion(effects, content) : content;
  };

  const readLeaf = (nodeId: string, node) => {
    const frame = source.getRenderFrame(nodeId)?.bounds;

    if (!(node && frame)) {
      return null;
    }

    const geometry = source.getRenderGeometry(nodeId);
    const local = geometry?.bbox;

    if (!local) {
      return frame;
    }

    const presentation = getLeafEffectPresentation(node, geometry);
    const out = presentation
      ? getEffectRegion(presentation.effects, presentation.ink)
      : (getLeafEffectInk(node, geometry) ?? local);

    // The frame is the node-local box placed in the stage, then rotated and
    // scaled about its center.
    return transformAboutCenter(
      shiftBounds(out, frame.minX - local.minX, frame.minY - local.minY),
      frame,
      node
    );
  };

  return read;
};

const shiftBounds = (bounds: Bounds, dx: number, dy: number): Bounds => ({
  ...bounds,
  maxX: bounds.maxX + dx,
  maxY: bounds.maxY + dy,
  minX: bounds.minX + dx,
  minY: bounds.minY + dy,
});

const transformAboutCenter = (bounds: Bounds, frame: Bounds, node): Bounds => {
  const rotation = ((getNodeRotation(node) || 0) * Math.PI) / 180;
  const scaleX = getNodeScaleX(node) ?? 1;
  const scaleY = getNodeScaleY(node) ?? 1;

  if (rotation === 0 && scaleX === 1 && scaleY === 1) {
    return bounds;
  }

  const centerX = (frame.minX + frame.maxX) / 2;
  const centerY = (frame.minY + frame.maxY) / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const corners = [
    [bounds.minX, bounds.minY],
    [bounds.maxX, bounds.minY],
    [bounds.maxX, bounds.maxY],
    [bounds.minX, bounds.maxY],
  ].map(([x, y]) => {
    const localX = (x - centerX) * scaleX;
    const localY = (y - centerY) * scaleY;

    return {
      x: centerX + localX * cos - localY * sin,
      y: centerY + localX * sin + localY * cos,
    };
  });

  return toBounds(corners);
};

export const unionBounds = (boxes: readonly Bounds[]): Bounds | null => {
  if (boxes.length === 0) {
    return null;
  }

  return toBounds(
    boxes.flatMap((box) => [
      { x: box.minX, y: box.minY },
      { x: box.maxX, y: box.maxY },
    ])
  );
};

const toBounds = (points: readonly { x: number; y: number }[]): Bounds => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return { height: maxY - minY, maxX, maxY, minX, minY, width: maxX - minX };
};
