import {
  createDefaultArtboardNode,
  type Editor,
  type Effect,
  incrementPerfCounter,
  PERF_COUNTERS,
} from "@punchpress/engine";
import { saveDesignDocument } from "@punchpress/punch-schema";
import { importSvgToNodes } from "../../platform/svg-import-document";
import { createDropShadow } from "./drop-shadow-benchmark-scene";

// Every fixture is an imported SVG in a print artboard: an import wrapper
// group, sections, 4 subgroups per section, 6 clusters per subgroup, and
// multi-contour path leaves.
// `dense`: 4 large sections. Unfocused, the wrapper paints as one dense
// surface; focusing the wrapper or a section keeps the other sections dense.
// `expanded`: 16 small sections directly in the artboard (no wrapper), so
// every leaf gets its own shell. `shadow` and `shadows`: the 16-section layout
// with one (CSS drop-shadow) or two (SVG filter graph) shadows on every
// section, which keeps the wrapper and sections expanded.
export type GroupActionFixture = "dense" | "expanded" | "shadow" | "shadows";

const SVG_SIZE = 4000;
const SUBGROUP_GRID = 2;
const CLUSTER_COLUMNS = 3;
const CLUSTER_ROWS = 2;
const SUBGROUPS_PER_SECTION = SUBGROUP_GRID * SUBGROUP_GRID;
const CLUSTERS_PER_SUBGROUP = CLUSTER_COLUMNS * CLUSTER_ROWS;
const FILLS = ["#1f6feb", "#ff7a00", "#2da44e", "#d1242f", "#8250df"];

export interface GroupActionScene {
  artboardId: string;
  // Section groups in paint order; each holds subgroups, which hold clusters
  // of multi-contour path leaves.
  sectionIds: string[];
  wrapperId: string | null;
}

export const loadGroupActionScene = async (
  editor: Editor,
  { fixture, nodeCount }: { fixture: GroupActionFixture; nodeCount: number },
  waitForFrame: () => Promise<number>
): Promise<GroupActionScene> => {
  const artboard = createDefaultArtboardNode("Print");
  const [wrapper, ...imported] = importSvgToNodes(
    createGroupActionSvg(nodeCount, fixture === "dense" ? 2 : 4),
    { targetCenter: { x: 2250, y: 2700 } }
  );
  const keepWrapper = fixture !== "expanded";
  const nodes = keepWrapper
    ? [{ ...wrapper, parentId: artboard.id }, ...imported]
    : imported.map((node) =>
        node.parentId === wrapper.id ? { ...node, parentId: artboard.id } : node
      );
  const sectionParentId = keepWrapper ? wrapper.id : artboard.id;

  editor.loadDocument(saveDesignDocument([artboard, ...nodes]).contents);
  editor.cancelPendingViewportFocus();

  const sectionIds = editor.getChildNodeIds(sectionParentId);

  if (fixture === "shadow" || fixture === "shadows") {
    applySectionShadows(editor, sectionIds, fixture === "shadows" ? 2 : 1);
  }

  editor.resetHistory();
  await waitForLeavesReady(editor, waitForFrame);

  return {
    artboardId: artboard.id,
    sectionIds,
    wrapperId: keepWrapper ? wrapper.id : null,
  };
};

// Keeps the whole artboard on screen; Zach's large imports are worked on
// zoomed out like this.
export const showWholeArtboard = (editor: Editor, artboardId: string) => {
  const bounds = editor.getSelectionBounds([artboardId]);
  const rect = editor.hostRef?.getBoundingClientRect();
  const width = rect?.width ?? 1280;
  const height = rect?.height ?? 800;

  if (!bounds) {
    throw new Error("Group action scene has no artboard bounds.");
  }

  const zoom = Math.min(
    width / (bounds.maxX - bounds.minX),
    height / (bounds.maxY - bounds.minY)
  );
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  editor.moveViewportTo({
    x: centerX - width / zoom / 2,
    y: centerY - height / zoom / 2,
    zoom: zoom * 0.9,
  });
};

// Fixture shape counters, recorded once per run.
export const recordGroupActionStats = (
  editor: Editor,
  affectedNodeIds: string[]
) => {
  const leaves = editor.nodes.filter((node) => node.type === "path");
  const contourCount = leaves.reduce((sum, node) => {
    return sum + ((node as { contours?: unknown[] }).contours?.length ?? 0);
  }, 0);
  const affectedLeafIds = new Set(
    affectedNodeIds.flatMap((nodeId) => {
      return editor.isGroupNode(nodeId)
        ? editor.getDescendantLeafNodeIds(nodeId)
        : [nodeId];
    })
  );
  const filterOwners = editor.nodes.filter((node) => {
    return (node as { effects?: Effect[] }).effects?.some(
      (effect) => effect.enabled
    );
  }).length;

  incrementPerfCounter(
    PERF_COUNTERS.groupActionsTotalNodes,
    editor.nodes.length
  );
  incrementPerfCounter(PERF_COUNTERS.groupActionsLeafNodes, leaves.length);
  incrementPerfCounter(
    PERF_COUNTERS.groupActionsGroupNodes,
    editor.nodes.filter((node) => node.type === "group").length
  );
  incrementPerfCounter(PERF_COUNTERS.groupActionsContours, contourCount);
  incrementPerfCounter(PERF_COUNTERS.groupActionsDepth, getTreeDepth(editor));
  incrementPerfCounter(
    PERF_COUNTERS.groupActionsPlacedSurfaces,
    editor.getRenderTree().placedNodeIds.length
  );
  incrementPerfCounter(PERF_COUNTERS.groupActionsFilterOwners, filterOwners);
  incrementPerfCounter(
    PERF_COUNTERS.groupActionsAffectedLeaves,
    affectedLeafIds.size
  );
};

// sectionGrid² sections × 4 subgroups × 6 clusters; the leaf count per
// cluster scales so the whole document lands near `nodeCount` nodes.
const createGroupActionSvg = (nodeCount: number, sectionGrid: number) => {
  const sectionCount = sectionGrid * sectionGrid;
  const sectionSize = SVG_SIZE / sectionGrid;
  const clusterCount =
    sectionCount * SUBGROUPS_PER_SECTION * CLUSTERS_PER_SUBGROUP;
  const groupCount =
    sectionCount + sectionCount * SUBGROUPS_PER_SECTION + clusterCount;
  const leavesPerCluster = Math.max(
    1,
    Math.round((nodeCount - groupCount - 2) / clusterCount)
  );
  const sections: string[] = [];

  for (let section = 0; section < sectionCount; section += 1) {
    const sectionX = (section % sectionGrid) * sectionSize;
    const sectionY = Math.floor(section / sectionGrid) * sectionSize;
    const subgroups: string[] = [];

    for (let subgroup = 0; subgroup < SUBGROUPS_PER_SECTION; subgroup += 1) {
      const subgroupSize = sectionSize / SUBGROUP_GRID;
      const subgroupX = sectionX + (subgroup % SUBGROUP_GRID) * subgroupSize;
      const subgroupY =
        sectionY + Math.floor(subgroup / SUBGROUP_GRID) * subgroupSize;
      const clusters: string[] = [];

      for (let cluster = 0; cluster < CLUSTERS_PER_SUBGROUP; cluster += 1) {
        const cellWidth = subgroupSize / CLUSTER_COLUMNS;
        const cellHeight = subgroupSize / CLUSTER_ROWS;
        const cellX = subgroupX + (cluster % CLUSTER_COLUMNS) * cellWidth;
        const cellY =
          subgroupY + Math.floor(cluster / CLUSTER_COLUMNS) * cellHeight;
        const leaves = Array.from({ length: leavesPerCluster }, (_, leaf) => {
          return createLeafPath(
            { height: cellHeight, width: cellWidth, x: cellX, y: cellY },
            leaf,
            leavesPerCluster
          );
        });

        clusters.push(
          `<g id="cluster-${section}-${subgroup}-${cluster}">${leaves.join("")}</g>`
        );
      }

      subgroups.push(
        `<g id="subgroup-${section}-${subgroup}">${clusters.join("")}</g>`
      );
    }

    sections.push(`<g id="section-${section}">${subgroups.join("")}</g>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}">${sections.join("")}</svg>`;
};

// A compound path with three contours: a curved blob, a square hole, and a
// triangle, like the multi-contour artwork an SVG import produces.
const createLeafPath = (
  cell: { height: number; width: number; x: number; y: number },
  leaf: number,
  leafCount: number
) => {
  const columns = Math.ceil(Math.sqrt(leafCount));
  const rows = Math.ceil(leafCount / columns);
  const width = cell.width / columns;
  const height = cell.height / rows;
  const size = Math.min(width, height) * 0.8;
  const x = cell.x + (leaf % columns) * width + (width - size) / 2;
  const y = cell.y + Math.floor(leaf / columns) * height + (height - size) / 2;
  const half = size / 2;
  const cx = x + half;
  const cy = y + half;
  const k = half * 0.55;
  const blob = `M${cx},${y}C${cx + k},${y} ${x + size},${cy - k} ${x + size},${cy}C${x + size},${cy + k} ${cx + k},${y + size} ${cx},${y + size}C${cx - k},${y + size} ${x},${cy + k} ${x},${cy}C${x},${cy - k} ${cx - k},${y} ${cx},${y}Z`;
  const hole = `M${cx - half * 0.3},${cy - half * 0.3}h${half * 0.6}v${half * 0.6}h${-half * 0.6}Z`;
  const triangle = `M${cx},${cy - half * 0.8}l${half * 0.15},${half * 0.25}h${-half * 0.3}Z`;
  const fill = FILLS[leaf % FILLS.length];

  return `<path fill="${fill}" fill-rule="evenodd" d="${blob}${hole}${triangle}"/>`;
};

const applySectionShadows = (
  editor: Editor,
  sectionIds: string[],
  shadowCount: number
) => {
  const effects = Array.from({ length: shadowCount }, (_, index) => {
    return createDropShadow(`section-shadow-${index}`, {
      blur: 24,
      x: 8 + index * 12,
      y: 8 + index * 12,
    });
  });

  if (!editor.setEffects(effects, sectionIds)) {
    throw new Error("Unable to shadow the group action sections.");
  }
};

const getTreeDepth = (editor: Editor) => {
  const visit = (parentId: string): number => {
    const childIds = editor.getChildNodeIds(parentId);

    return childIds.length === 0
      ? 0
      : 1 + Math.max(...childIds.map((childId) => visit(childId)));
  };

  return visit(editor.nodes.find((node) => node.type === "artboard")?.id ?? "");
};

const waitForLeavesReady = async (
  editor: Editor,
  waitForFrame: () => Promise<number>
) => {
  const leafIds = editor.nodes
    .filter((node) => node.type === "path")
    .map((node) => node.id);
  const timeoutAt = performance.now() + 20_000;
  const getPendingCount = () =>
    leafIds.filter((nodeId) => editor.getNodeGeometry(nodeId)?.ready !== true)
      .length;

  while (getPendingCount() > 0) {
    const now = await waitForFrame();

    if (now >= timeoutAt) {
      throw new Error(
        `Group action scene geometry not ready for ${getPendingCount()} leaves.`
      );
    }
  }
};
