import type { RenderItem, RenderLayer, RenderTree } from "./render-tree";
import {
  isCommittedPlacement,
  resolvePlacedPreviewNodeIds,
} from "./preview-shell-placement";
import { getRenderTreeIndex } from "./render-tree-index";

// A moving presentation root for one gesture. `layer` moves a group's (or a
// dragged artboard's) presentation wrapper, carrying its effect layers and
// every shell beneath it; `shell` and `surface` move one placed node.
export interface PreviewTarget {
  kind: "layer" | "shell" | "surface";
  nodeId: string;
}

export interface PreviewPresentationPlan {
  // Stationary layers holding moving content: their effect input changes in
  // their own coordinate space.
  affectedLayerIds: ReadonlySet<string>;
  // Layers carried by a moving layer target (the target and every layer
  // below it): their effect input is unchanged in their own space.
  carriedLayerIds: ReadonlySet<string>;
  // Placed shells and surfaces that move, as targets or under one.
  movedPlacedNodeIds: ReadonlySet<string>;
  // Disjoint moving roots in paint order.
  targets: readonly PreviewTarget[];
}

interface PresentationPreview {
  delta?: unknown;
  effectiveNodeIdSet?: ReadonlySet<string>;
  nodeIds?: readonly string[];
  resize?: unknown;
  rotate?: unknown;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

const EMPTY_PLAN: PreviewPresentationPlan = {
  affectedLayerIds: EMPTY_SET,
  carriedLayerIds: EMPTY_SET,
  movedPlacedNodeIds: EMPTY_SET,
  targets: [],
};

interface CachedPlan {
  effectiveNodeIdSet: ReadonlySet<string> | undefined;
  isMove: boolean;
  nodes: unknown;
  pathEditingNodeId: string | null;
  plan: PreviewPresentationPlan;
  previewNodeIds: readonly string[];
  tree: RenderTree;
}

const cacheByEditor = new WeakMap<object, CachedPlan>();

// Resolves which presentation roots a transform preview moves. Membership is
// fixed for a gesture, so delta-only updates reuse one plan; the plan follows
// the render tree, the document, path editing, and the transform kind.
export const getPreviewPresentationPlan = (
  editor,
  preview: PresentationPreview | null
): PreviewPresentationPlan => {
  const previewNodeIds = preview?.nodeIds || [];
  const tree: RenderTree = editor.getRenderTree();

  if (!(tree.placedNodeIds.length > 0 && previewNodeIds.length > 0)) {
    return EMPTY_PLAN;
  }

  const isMove = Boolean(preview?.delta && !preview.resize && !preview.rotate);
  const pathEditingNodeId = editor.pathEditingNodeId ?? null;
  const cached = cacheByEditor.get(editor);

  if (
    cached &&
    cached.tree === tree &&
    cached.nodes === editor.nodes &&
    cached.previewNodeIds === previewNodeIds &&
    cached.effectiveNodeIdSet === preview?.effectiveNodeIdSet &&
    cached.pathEditingNodeId === pathEditingNodeId &&
    cached.isMove === isMove
  ) {
    return cached.plan;
  }

  const plan = resolvePlan(editor, tree, {
    committedNodeIdSet: preview?.effectiveNodeIdSet || new Set(previewNodeIds),
    isMove,
    previewNodeIds,
  });

  cacheByEditor.set(editor, {
    effectiveNodeIdSet: preview?.effectiveNodeIdSet,
    isMove,
    nodes: editor.nodes,
    pathEditingNodeId,
    plan,
    previewNodeIds,
    tree,
  });

  return plan;
};

interface PlanInputs {
  committedNodeIdSet: ReadonlySet<string>;
  isMove: boolean;
  previewNodeIds: readonly string[];
}

const resolvePlan = (
  editor,
  tree: RenderTree,
  { committedNodeIdSet, isMove, previewNodeIds }: PlanInputs
): PreviewPresentationPlan => {
  const index = getRenderTreeIndex(tree);
  const carriedLayerIds = new Set<string>();
  const movedPlacedNodeIds = new Set<string>();
  const targets: PreviewTarget[] = [];

  // Translation moves whole groups as one presentation root. Resize and
  // rotation keep per-shell previews.
  if (isMove) {
    for (const layer of getCoveredLayerRoots(
      editor,
      tree,
      previewNodeIds,
      committedNodeIdSet
    )) {
      targets.push({ kind: "layer", nodeId: layer.nodeId });
      collectCarried(layer, carriedLayerIds, movedPlacedNodeIds);
    }
  }

  const remainingNodeIds =
    movedPlacedNodeIds.size > 0
      ? tree.placedNodeIds.filter((nodeId) => !movedPlacedNodeIds.has(nodeId))
      : tree.placedNodeIds;

  for (const nodeId of resolvePlacedPreviewNodeIds(
    editor,
    remainingNodeIds,
    previewNodeIds,
    committedNodeIdSet
  )) {
    targets.push({ kind: index.placedKinds.get(nodeId) ?? "shell", nodeId });
    movedPlacedNodeIds.add(nodeId);
  }

  if (targets.length === 0) {
    return EMPTY_PLAN;
  }

  targets.sort((left, right) => {
    return (
      (index.order.get(getTargetKey(left)) ?? 0) -
      (index.order.get(getTargetKey(right)) ?? 0)
    );
  });

  const affectedLayerIds = new Set<string>();

  for (const target of targets) {
    let layerId = index.parentLayerIds.get(getTargetKey(target)) ?? null;

    while (layerId && !affectedLayerIds.has(layerId)) {
      affectedLayerIds.add(layerId);
      layerId = index.parentLayerIds.get(`layer:${layerId}`) ?? null;
    }
  }

  return { affectedLayerIds, carriedLayerIds, movedPlacedNodeIds, targets };
};

// Walks the tree in paint order and keeps the highest layer that is a
// requested group (or sits below one) or a dragged artboard, and whose every
// rendered contribution the gesture commits. An artboard moves only when it
// is dragged itself; independently selected leaves never infer a root.
const getCoveredLayerRoots = (
  editor,
  tree: RenderTree,
  previewNodeIds: readonly string[],
  committedNodeIdSet: ReadonlySet<string>
) => {
  const requestedNodeIdSet = new Set(previewNodeIds);
  const getCoverage = createLayerCoverage(editor, committedNodeIdSet);
  const roots: RenderLayer[] = [];

  const visit = (items: RenderItem[], isUnderRequested: boolean) => {
    for (const item of items) {
      if (item.kind !== "layer") {
        continue;
      }

      const isRequested = requestedNodeIdSet.has(item.nodeId);
      const isCandidate =
        editor.getNode(item.nodeId)?.type === "artboard"
          ? isRequested
          : isRequested || isUnderRequested;

      if (isCandidate && getCoverage(item) === "covered") {
        roots.push(item);
        continue;
      }

      visit(item.children, isUnderRequested || isRequested);
    }
  };

  visit(tree.items, false);

  return roots;
};

type LayerCoverage = "covered" | "empty" | "partial";

// Whether the gesture commits every shell and surface beneath a layer.
// Layers with nothing placed beneath them never block or form a root.
const createLayerCoverage = (
  editor,
  committedNodeIdSet: ReadonlySet<string>
) => {
  const coverageByLayer = new Map<RenderLayer, LayerCoverage>();
  const pathEditingNodeId = editor.pathEditingNodeId ?? null;

  const getCoverage = (layer: RenderLayer): LayerCoverage => {
    const cached = coverageByLayer.get(layer);

    if (cached) {
      return cached;
    }

    let coverage: LayerCoverage = "empty";

    // A contour edit moves points, never the whole vector or its groups.
    if (
      pathEditingNodeId &&
      editor.isDescendantOf(pathEditingNodeId, layer.nodeId)
    ) {
      coverage = "partial";
    } else {
      for (const child of layer.children) {
        const childCoverage = getChildCoverage(child);

        if (childCoverage === "partial") {
          coverage = "partial";
          break;
        }

        if (childCoverage === "covered") {
          coverage = "covered";
        }
      }
    }

    coverageByLayer.set(layer, coverage);

    return coverage;
  };

  const getChildCoverage = (child: RenderItem): LayerCoverage => {
    if (child.kind === "layer") {
      return getCoverage(child);
    }

    return isCommittedPlacement(editor, child.nodeId, committedNodeIdSet)
      ? "covered"
      : "partial";
  };

  return getCoverage;
};

const collectCarried = (
  layer: RenderLayer,
  carriedLayerIds: Set<string>,
  movedPlacedNodeIds: Set<string>
) => {
  carriedLayerIds.add(layer.nodeId);

  for (const child of layer.children) {
    if (child.kind === "layer") {
      collectCarried(child, carriedLayerIds, movedPlacedNodeIds);
    } else {
      movedPlacedNodeIds.add(child.nodeId);
    }
  }
};

const getTargetKey = (target: PreviewTarget) => {
  return `${target.kind}:${target.nodeId}`;
};
