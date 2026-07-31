import { describe, expect, test } from "bun:test";
import {
  deriveRasterAtomicHandoff,
  getNodeLocalMatrix,
  multiplyMatrix,
  type RasterWorkingGroup,
  type RasterWorkingPresentation,
} from "@punchpress/engine";
import {
  acknowledgeRasterWorkingGroup,
  createRasterWorkingGroupLifecycle,
  getRasterWorkingToNodeMatrix,
  invalidateRasterWorkingGroup,
  markRasterWorkingGroupAwaitingReplacement,
  markRasterWorkingGroupCommitting,
  markRasterWorkingGroupPresentationFailed,
  retireAcknowledgedRasterWorkingGroups,
} from "../../../../packages/engine/src/raster/working-presentation";

describe("Raster working presentation", () => {
  test("keeps stable group identity and separates input, commit, and presentation readiness", () => {
    const active = createRasterWorkingGroupLifecycle({
      groupId: "stroke-7",
      nodeId: "raster-1",
      sequence: 7,
    });
    const committing = markRasterWorkingGroupCommitting(active);
    const awaiting = markRasterWorkingGroupAwaitingReplacement(committing, {
      commitId: "commit-7",
      kind: "tiles",
      resourceIds: ["tile-a", "tile-b"],
    });

    expect(active).toMatchObject({
      groupId: "stroke-7",
      nodeId: "raster-1",
      phase: "active",
      sequence: 7,
    });
    expect(committing).toMatchObject({
      groupId: "stroke-7",
      phase: "committing",
      replacement: null,
    });
    expect(awaiting).toMatchObject({
      groupId: "stroke-7",
      phase: "awaiting-presentation",
      replacement: {
        commitId: "commit-7",
        resourceIds: ["tile-a", "tile-b"],
      },
    });
  });

  test("derives independent ordered handoffs for mixed Canvas and tile groups", () => {
    const presentation: RasterWorkingPresentation = {
      groups: [
        createGroup({
          content: {
            canvas: createCanvas(),
            height: 20,
            kind: "canvas",
            width: 20,
            x: 0,
            y: 0,
          },
          groupId: "canvas-1",
          phase: "awaiting-presentation",
          replacement: {
            commitId: "commit-1",
            kind: "canvas",
            resourceIds: ["source-a"],
          },
          sequence: 1,
        }),
        createGroup({
          groupId: "tiles-2",
          phase: "active",
          sequence: 2,
        }),
      ],
      nodeId: "raster-1",
    };

    const partial = deriveRasterAtomicHandoff(presentation, new Set());

    expect(partial.layers.map(({ groupId, kind }) => [groupId, kind])).toEqual([
      ["canvas-1", "working"],
      ["tiles-2", "working"],
    ]);
    expect(partial.acknowledgements).toEqual([]);
    expect([...partial.hiddenReplacementResourceIds]).toEqual(["source-a"]);

    const complete = deriveRasterAtomicHandoff(
      presentation,
      new Set(["source-a"])
    );

    expect(complete.layers.map(({ groupId, kind }) => [groupId, kind])).toEqual(
      [
        ["canvas-1", "replacement"],
        ["tiles-2", "working"],
      ]
    );
    expect(complete.acknowledgements).toEqual([
      {
        commitId: "commit-1",
        groupId: "canvas-1",
        nodeId: "raster-1",
      },
    ]);
  });

  test("newest full-node snapshot supersedes older layers without blocking their acknowledgements", () => {
    const presentation: RasterWorkingPresentation = {
      groups: [
        createGroup({
          content: {
            canvas: createCanvas(),
            height: 20,
            kind: "canvas",
            width: 20,
            x: 0,
            y: 0,
          },
          groupId: "canvas-1",
          phase: "awaiting-presentation",
          replacement: {
            commitId: "commit-1",
            kind: "canvas",
            resourceIds: ["source-a"],
          },
          sequence: 1,
        }),
        createGroup({
          groupId: "tiles-2",
          phase: "awaiting-presentation",
          replacement: {
            commitId: "commit-2",
            kind: "tiles",
            resourceIds: ["tile-b"],
          },
          sequence: 2,
        }),
        createGroup({
          content: {
            canvas: createCanvas(),
            height: 20,
            kind: "canvas",
            width: 20,
            x: 0,
            y: 0,
          },
          groupId: "canvas-3",
          phase: "active",
          sequence: 3,
        }),
      ],
      nodeId: "raster-1",
    };

    const handoff = deriveRasterAtomicHandoff(
      presentation,
      new Set(["source-a", "tile-b"])
    );

    expect(handoff.layers.map(({ groupId, kind }) => [groupId, kind])).toEqual([
      ["canvas-3", "working"],
    ]);
    expect(handoff.acknowledgements).toEqual([
      {
        commitId: "commit-1",
        groupId: "canvas-1",
        nodeId: "raster-1",
      },
      {
        commitId: "commit-2",
        groupId: "tiles-2",
        nodeId: "raster-1",
      },
    ]);
  });

  test("acknowledging a newer full-node authority permanently retires its superseded prefix", () => {
    const presentation: RasterWorkingPresentation = {
      groups: [
        createGroup({
          groupId: "tiles-1",
          phase: "awaiting-presentation",
          replacement: {
            commitId: "commit-1",
            kind: "tiles",
            resourceIds: ["slow-tile"],
          },
          sequence: 1,
        }),
        createGroup({
          content: {
            canvas: createCanvas(),
            height: 20,
            kind: "canvas",
            width: 20,
            x: 0,
            y: 0,
          },
          groupId: "canvas-2",
          phase: "awaiting-presentation",
          replacement: {
            commitId: "commit-2",
            kind: "canvas",
            resourceIds: ["new-source"],
          },
          sequence: 2,
        }),
      ],
      nodeId: "raster-1",
    };
    const ready = deriveRasterAtomicHandoff(
      presentation,
      new Set(["new-source"])
    );

    expect(ready.layers.map(({ groupId, kind }) => [groupId, kind])).toEqual([
      ["canvas-2", "replacement"],
    ]);
    expect(ready.acknowledgements).toEqual([
      {
        commitId: "commit-2",
        groupId: "canvas-2",
        nodeId: "raster-1",
      },
    ]);

    const retired = retireAcknowledgedRasterWorkingGroups(
      presentation,
      ready.acknowledgements[0]
    );
    const afterAcknowledgement = deriveRasterAtomicHandoff(
      retired,
      new Set(["new-source"])
    );

    expect(retired.groups).toEqual([]);
    expect(afterAcknowledgement.layers).toEqual([]);
    expect(afterAcknowledgement.acknowledgements).toEqual([]);
  });

  test("retires groups out of order while stale, wrong, and duplicate acknowledgements are harmless", () => {
    const first = markRasterWorkingGroupAwaitingReplacement(
      markRasterWorkingGroupCommitting(
        createRasterWorkingGroupLifecycle({
          groupId: "stroke-1",
          nodeId: "raster-1",
          sequence: 1,
        })
      ),
      {
        commitId: "commit-1",
        kind: "tiles",
        resourceIds: ["tile-a"],
      }
    );
    const second = markRasterWorkingGroupAwaitingReplacement(
      markRasterWorkingGroupCommitting(
        createRasterWorkingGroupLifecycle({
          groupId: "stroke-2",
          nodeId: "raster-1",
          sequence: 2,
        })
      ),
      {
        commitId: "commit-2",
        kind: "tiles",
        resourceIds: ["tile-b"],
      }
    );

    expect(
      acknowledgeRasterWorkingGroup(first, {
        commitId: "commit-2",
        groupId: "stroke-1",
        nodeId: "raster-1",
      })
    ).toBe(first);
    expect(
      acknowledgeRasterWorkingGroup(first, {
        commitId: "commit-1",
        groupId: "stroke-2",
        nodeId: "raster-1",
      })
    ).toBe(first);
    expect(
      acknowledgeRasterWorkingGroup(first, {
        commitId: "commit-1",
        groupId: "stroke-1",
        nodeId: "raster-2",
      })
    ).toBe(first);

    const retiredSecond = acknowledgeRasterWorkingGroup(second, {
      commitId: "commit-2",
      groupId: "stroke-2",
      nodeId: "raster-1",
    });

    expect(retiredSecond).toBeNull();
    expect(
      acknowledgeRasterWorkingGroup(retiredSecond, {
        commitId: "commit-2",
        groupId: "stroke-2",
        nodeId: "raster-1",
      })
    ).toBeNull();
    expect(first).not.toBeNull();
  });

  test("failed replacement decode keeps working pixels authoritative", () => {
    const presentation: RasterWorkingPresentation = {
      groups: [
        createGroup({
          groupId: "canvas-1",
          phase: "presentation-failed",
          replacement: {
            commitId: "commit-1",
            kind: "canvas",
            resourceIds: ["failed-source"],
          },
          sequence: 1,
        }),
      ],
      nodeId: "raster-1",
    };
    const handoff = deriveRasterAtomicHandoff(
      presentation,
      new Set(["failed-source"])
    );

    expect(
      markRasterWorkingGroupPresentationFailed(presentation.groups[0])
    ).toMatchObject({
      phase: "presentation-failed",
      replacement: {
        commitId: "commit-1",
      },
    });
    expect(handoff.layers.map(({ groupId, kind }) => [groupId, kind])).toEqual([
      ["canvas-1", "working"],
    ]);
    expect(handoff.acknowledgements).toEqual([]);
    expect([...handoff.hiddenReplacementResourceIds]).toEqual([
      "failed-source",
    ]);
  });

  test("explicit invalidation removes cancelled or deleted-node groups", () => {
    const active = createRasterWorkingGroupLifecycle({
      groupId: "stroke-1",
      nodeId: "raster-1",
      sequence: 1,
    });

    expect(invalidateRasterWorkingGroup(active)).toBeNull();
    expect(invalidateRasterWorkingGroup(null)).toBeNull();
  });

  test("preserves working coordinates through rotation and nonuniform scale", () => {
    const durableNode = {
      height: 420,
      transform: {
        rotation: 37,
        scaleX: 1.75,
        scaleY: 0.6,
        x: 260,
        y: 140,
      },
      type: "image",
      width: 360,
    };
    const workingNode = {
      height: 680,
      transform: {
        rotation: 37,
        scaleX: 1.75,
        scaleY: 0.6,
        x: 95,
        y: -45,
      },
      width: 740,
    };

    const relativeMatrix = getRasterWorkingToNodeMatrix(
      durableNode,
      workingNode
    );

    expect(relativeMatrix).not.toBeNull();

    const composedMatrix = multiplyMatrix(
      getNodeLocalMatrix(durableNode, getBounds(durableNode)),
      relativeMatrix
    );
    const workingMatrix = getNodeLocalMatrix(
      { ...durableNode, ...workingNode },
      getBounds(workingNode)
    );

    for (const key of ["a", "b", "c", "d", "e", "f"] as const) {
      expect(composedMatrix[key]).toBeCloseTo(workingMatrix[key], 8);
    }
  });
});

const createCanvas = () =>
  ({
    height: 20,
    width: 20,
  }) as HTMLCanvasElement;

const createGroup = ({
  content = {
    kind: "tiles",
    tiles: [],
  },
  groupId,
  phase,
  replacement = null,
  sequence,
}: {
  content?: RasterWorkingGroup["content"];
  groupId: string;
  phase: RasterWorkingGroup["phase"];
  replacement?: RasterWorkingGroup["replacement"];
  sequence: number;
}): RasterWorkingGroup => ({
  allowOverflow: false,
  bounds: {
    height: 20,
    maxX: 20,
    maxY: 20,
    minX: 0,
    minY: 0,
    width: 20,
  },
  content,
  groupId,
  matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  nodeId: "raster-1",
  phase,
  replacement,
  replacesNode: content.kind === "canvas",
  sequence,
});

const getBounds = ({ height, width }: { height: number; width: number }) => ({
  height,
  maxX: width,
  maxY: height,
  minX: 0,
  minY: 0,
  width,
});
