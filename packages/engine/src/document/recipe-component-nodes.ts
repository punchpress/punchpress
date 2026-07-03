import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { createDefaultGroupNode } from "../nodes/group/model";
import { createId } from "../nodes/text/model";
import { getArtboardParentPatch } from "../placement/artboard-parent";
import { getSelectionBounds } from "../selection/selection-bounds";

/**
 * Converts a parsed recipe (DesignDocument) into a flat node array suitable
 * for `editor.insertNodes`: artboards are stripped, all surviving top-level
 * nodes are reparented under one fresh group, and every node gets a fresh id
 * so repeated inserts never collide. Content is re-centered on
 * `targetCenter`.
 *
 * Node transforms are canvas-space (see `toWorldFrame` /
 * `toTransformedWorldFrame` in `nodes/node-frame-utils.ts`, which read a
 * node's own `transform.x/y` with no parent-chain composition) — so artboard
 * children keep valid coordinates once the artboard node itself is dropped.
 */

const isArtboardNode = (node) => node.type === "artboard";

const getArtboardContentBoxes = (nodes) => {
  return nodes
    .filter(isArtboardNode)
    .map((artboard) => ({
      maxX: artboard.transform.x + artboard.width,
      maxY: artboard.transform.y + artboard.height,
      minX: artboard.transform.x,
      minY: artboard.transform.y,
    }));
};

const getApproximateContentBox = (nodes) => {
  const positioned = nodes.filter(
    (node) => node.transform && typeof node.transform.x === "number"
  );

  if (positioned.length === 0) {
    return null;
  }

  const xs = positioned.map((node) => node.transform.x);
  const ys = positioned.map((node) => node.transform.y);

  return {
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    minX: Math.min(...xs),
    minY: Math.min(...ys),
  };
};

// Determines the content box used to center the recipe on drop.
// Single-artboard recipes use the artboard frame exactly; anything else
// (no artboard, or multiple artboards) falls back to an approximation from
// node transform x/y min/max — this ignores node size, so it's only a rough
// center for multi-artboard or artboard-less recipes.
const getContentBox = (nodes) => {
  const artboardBoxes = getArtboardContentBoxes(nodes);

  if (artboardBoxes.length === 1) {
    return artboardBoxes[0];
  }

  return getApproximateContentBox(nodes);
};

const getBoxCenter = (box) => {
  return {
    x: box.minX + (box.maxX - box.minX) / 2,
    y: box.minY + (box.maxY - box.minY) / 2,
  };
};

const hasEmptyImageSrc = (node) => {
  return node.type === "image" && !node.src;
};

/**
 * Converts a recipe document into component nodes for insertion into the
 * current document as a single frameless group.
 *
 * Returns `{ nodes, skippedImageCount }`. `nodes` is empty when there is no
 * content left to insert (e.g. an artboard-only recipe with no children).
 */
export const recipeToComponentNodes = (
  document,
  { targetCenter }: { targetCenter?: { x: number; y: number } | null } = {}
) => {
  const survivors = document.nodes.filter((node) => !isArtboardNode(node));
  const contentBox = getContentBox(document.nodes);
  const center = targetCenter || { x: 0, y: 0 };
  const offset = contentBox
    ? {
        x: center.x - getBoxCenter(contentBox).x,
        y: center.y - getBoxCenter(contentBox).y,
      }
    : { x: 0, y: 0 };

  let skippedImageCount = 0;
  const skippedNodeIds = new Set();

  for (const node of survivors) {
    if (hasEmptyImageSrc(node)) {
      skippedImageCount += 1;
      skippedNodeIds.add(node.id);
    }
  }

  const keptSurvivors = survivors.filter((node) => !skippedNodeIds.has(node.id));

  if (keptSurvivors.length === 0) {
    return { nodes: [], skippedImageCount };
  }

  const artboardIds = new Set(
    document.nodes.filter(isArtboardNode).map((node) => node.id)
  );
  const idMap = new Map(keptSurvivors.map((node) => [node.id, createId()]));
  const groupNode = createDefaultGroupNode("Group");

  const remappedNodes = keptSurvivors.map((node) => {
    const isTopLevel = artboardIds.has(node.parentId) ||
      node.parentId === ROOT_PARENT_ID;
    const mappedParentId = idMap.get(node.parentId);
    const parentId = isTopLevel
      ? groupNode.id
      : mappedParentId || ROOT_PARENT_ID;

    return {
      ...node,
      id: idMap.get(node.id),
      parentId,
      transform: node.transform
        ? {
            ...node.transform,
            x: node.transform.x + offset.x,
            y: node.transform.y + offset.y,
          }
        : node.transform,
    };
  });

  return {
    nodes: [groupNode, ...remappedNodes],
    skippedImageCount,
  };
};

// Recentering waits for measurable bounds because text bounds depend on font
// loading; shapes/vectors measure synchronously on the first attempt.
const RECENTER_FRAME_BUDGET = 60;

const recenterInsertedGroup = (editor, groupId, targetCenter, attempt = 0) => {
  if (!editor.getNode(groupId)) {
    return;
  }

  const bounds = getSelectionBounds(editor, [groupId]);
  const measurable = Boolean(
    bounds && (bounds.maxX - bounds.minX > 1 || bounds.maxY - bounds.minY > 1)
  );

  if (measurable) {
    const delta = {
      x: targetCenter.x - (bounds.minX + (bounds.maxX - bounds.minX) / 2),
      y: targetCenter.y - (bounds.minY + (bounds.maxY - bounds.minY) / 2),
    };

    if (Math.abs(delta.x) > 0.5 || Math.abs(delta.y) > 0.5) {
      const isGroupStillSelected =
        editor.selectedNodeIds.length === 1 &&
        editor.selectedNodeIds[0] === groupId;

      // moveSelectionBy is the sanctioned group-move (shifts descendants);
      // if the user already changed selection, leave the content where it is
      // rather than yanking their new selection around.
      if (isGroupStillSelected) {
        editor.moveSelectionBy(delta);
      }
    }

    return;
  }

  editor.selectionBoundsCache = null;

  if (attempt < RECENTER_FRAME_BUDGET && typeof window !== "undefined") {
    window.requestAnimationFrame(() => {
      recenterInsertedGroup(editor, groupId, targetCenter, attempt + 1);
    });
  }
};

/**
 * Inserts component nodes produced by `recipeToComponentNodes` at a drop
 * point: the group is parented into the topmost artboard under the point
 * (matching how placement tools parent new nodes), and the content is
 * recentered on the point using measured bounds once they are available.
 */
export const insertComponentNodes = (editor, nodes, { targetCenter }) => {
  if (nodes.length === 0) {
    return;
  }

  const [groupNode, ...rest] = nodes;
  const parentPatch = targetCenter
    ? getArtboardParentPatch(editor, targetCenter)
    : null;
  const insertedGroup = parentPatch
    ? { ...groupNode, ...parentPatch }
    : groupNode;

  editor.insertNodes([insertedGroup, ...rest]);

  if (targetCenter) {
    recenterInsertedGroup(editor, insertedGroup.id, targetCenter);
  }
};
