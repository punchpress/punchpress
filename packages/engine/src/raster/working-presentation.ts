import {
  getNodeLocalMatrix,
  invertMatrix,
  multiplyMatrix,
} from "../transform/node-transform-matrix";

export type RasterWorkingGroupPhase =
  | "active"
  | "awaiting-presentation"
  | "committing"
  | "presentation-failed";

export type RasterWorkingMatrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

export type RasterWorkingBounds = {
  height: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  width: number;
};

export type RasterWorkingCanvas = {
  canvas: HTMLCanvasElement;
  height: number;
  kind: "canvas";
  width: number;
  x: number;
  y: number;
};

export type RasterWorkingTile = {
  canvas: HTMLCanvasElement;
  height: number;
  subscribeToSource?: (listener: () => void) => () => void;
  width: number;
  x: number;
  y: number;
};

export type RasterWorkingContent =
  | RasterWorkingCanvas
  | {
      kind: "tiles";
      tiles: readonly RasterWorkingTile[];
    };

export type RasterReplacementIdentity = {
  commitId: string;
  kind: "canvas" | "tiles";
  resourceIds: readonly string[];
};

export type RasterWorkingGroupLifecycle = {
  groupId: string;
  nodeId: string;
  phase: RasterWorkingGroupPhase;
  replacement: RasterReplacementIdentity | null;
  sequence: number;
};

export type RasterWorkingGroup = RasterWorkingGroupLifecycle & {
  allowOverflow: boolean;
  bounds: RasterWorkingBounds;
  content: RasterWorkingContent;
  matrix: RasterWorkingMatrix;
  replacesNode: boolean;
};

export type RasterWorkingPresentation = {
  groups: readonly RasterWorkingGroup[];
  nodeId: string;
};

export type RasterPresentationAcknowledgement = {
  commitId: string;
  groupId: string;
  nodeId: string;
};

export type RasterPresentationFailure = RasterPresentationAcknowledgement & {
  reason: "decode-failed";
};

export type RasterAtomicHandoffLayer = {
  group: RasterWorkingGroup;
  groupId: string;
  kind: "replacement" | "working";
};

export type RasterAtomicHandoff = {
  acknowledgements: readonly RasterPresentationAcknowledgement[];
  hiddenReplacementResourceIds: ReadonlySet<string>;
  layers: readonly RasterAtomicHandoffLayer[];
};

export const createRasterWorkingGroupLifecycle = ({
  groupId,
  nodeId,
  sequence,
}: {
  groupId: string;
  nodeId: string;
  sequence: number;
}): RasterWorkingGroupLifecycle => ({
  groupId,
  nodeId,
  phase: "active",
  replacement: null,
  sequence,
});

export const markRasterWorkingGroupCommitting = (
  group: RasterWorkingGroupLifecycle
): RasterWorkingGroupLifecycle => ({
  ...group,
  phase: "committing",
  replacement: null,
});

export const markRasterWorkingGroupAwaitingReplacement = (
  group: RasterWorkingGroupLifecycle,
  replacement: RasterReplacementIdentity
): RasterWorkingGroupLifecycle => ({
  ...group,
  phase: "awaiting-presentation",
  replacement,
});

export const markRasterWorkingGroupPresentationFailed = (
  group: RasterWorkingGroupLifecycle
): RasterWorkingGroupLifecycle => ({
  ...group,
  phase: "presentation-failed",
});

export const acknowledgeRasterWorkingGroup = (
  group: RasterWorkingGroupLifecycle | null,
  acknowledgement: RasterPresentationAcknowledgement
): RasterWorkingGroupLifecycle | null => {
  if (
    group?.phase !== "awaiting-presentation" ||
    group.nodeId !== acknowledgement.nodeId ||
    group.groupId !== acknowledgement.groupId ||
    group.replacement?.commitId !== acknowledgement.commitId
  ) {
    return group;
  }

  return null;
};

export const retireAcknowledgedRasterWorkingGroups = (
  presentation: RasterWorkingPresentation,
  acknowledgement: RasterPresentationAcknowledgement
): RasterWorkingPresentation => {
  const acknowledgedGroup = presentation.groups.find(
    (group) =>
      group.phase === "awaiting-presentation" &&
      group.nodeId === acknowledgement.nodeId &&
      group.groupId === acknowledgement.groupId &&
      group.replacement?.commitId === acknowledgement.commitId
  );

  if (!acknowledgedGroup) {
    return presentation;
  }

  const groups = acknowledgedGroup.replacesNode
    ? presentation.groups.filter(
        (group) => group.sequence > acknowledgedGroup.sequence
      )
    : presentation.groups.filter(
        (group) => group.groupId !== acknowledgedGroup.groupId
      );

  return {
    groups,
    nodeId: presentation.nodeId,
  };
};

export const invalidateRasterWorkingGroup: (
  group: RasterWorkingGroupLifecycle | null
) => null = () => null;

export const deriveRasterAtomicHandoff = (
  presentation: RasterWorkingPresentation,
  drawableReplacementResourceIds: ReadonlySet<string>
): RasterAtomicHandoff => {
  const acknowledgements: RasterPresentationAcknowledgement[] = [];
  const hiddenReplacementResourceIds = new Set<string>();
  const orderedGroups = [...presentation.groups].sort(
    (left, right) => left.sequence - right.sequence
  );
  const layers = orderedGroups
    .map((group): RasterAtomicHandoffLayer => {
      const replacement = group.replacement;
      const isReplacementDrawable =
        group.phase === "awaiting-presentation" &&
        Boolean(replacement?.resourceIds.length) &&
        replacement?.resourceIds.every((resourceId) =>
          drawableReplacementResourceIds.has(resourceId)
        );

      if (isReplacementDrawable && replacement) {
        acknowledgements.push({
          commitId: replacement.commitId,
          groupId: group.groupId,
          nodeId: group.nodeId,
        });
        return {
          group,
          groupId: group.groupId,
          kind: "replacement",
        };
      }

      for (const resourceId of replacement?.resourceIds ?? []) {
        hiddenReplacementResourceIds.add(resourceId);
      }

      return {
        group,
        groupId: group.groupId,
        kind: "working",
      };
    });
  const latestNodeReplacementIndex = layers.reduce(
    (latestIndex, { group }, index) =>
      group.replacesNode ? index : latestIndex,
    -1
  );

  return {
    acknowledgements,
    hiddenReplacementResourceIds,
    layers:
      latestNodeReplacementIndex < 0
        ? layers
        : layers.slice(latestNodeReplacementIndex),
  };
};

export const getRasterWorkingToNodeMatrix = (
  durableNode: {
    height: number;
    transform?: Record<string, number>;
    type: string;
    width: number;
  },
  workingNode: {
    height: number;
    transform?: Record<string, number>;
    width: number;
  }
): RasterWorkingMatrix | null => {
  if (durableNode?.type !== "image") {
    return null;
  }

  const durableMatrix = getNodeLocalMatrix(
    durableNode,
    getImageBounds(durableNode)
  );
  const inverseDurableMatrix = invertMatrix(durableMatrix);

  if (!inverseDurableMatrix) {
    return null;
  }

  return multiplyMatrix(
    inverseDurableMatrix,
    getNodeLocalMatrix(
      {
        ...durableNode,
        ...workingNode,
      },
      getImageBounds(workingNode)
    )
  );
};

const getImageBounds = ({ height, width }: { height: number; width: number }) => ({
  height,
  maxX: width,
  maxY: height,
  minX: 0,
  minY: 0,
  width,
});
