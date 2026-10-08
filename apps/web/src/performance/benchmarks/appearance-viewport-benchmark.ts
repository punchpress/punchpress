import type {
  PerformanceBenchmarkContext,
  PerformanceBenchmarkDefinition,
} from "../performance-benchmark-types";
import {
  APPEARANCE_ARTBOARD_CENTER,
  loadAppearanceBenchmarkScene,
} from "./appearance-benchmark-scene";
import {
  applyEffects,
  blurShadow,
  hardShadow,
} from "./drop-shadow-benchmark-scene";
import {
  captureViewportHost,
  getCameraCenteredOn,
  getLadderZoom,
  getPanCamera,
  getPingPongProgress,
  positionViewport,
  probeViewportTrajectory,
} from "./viewport-motion";

// Matches the DPR visual sweep ladder so perf and pixel gates cover the same zooms.
export const APPEARANCE_ZOOM_LADDER = [1, 0.5, 0.35, 0.21, 0.1, 0.05, 0.01];

// The working zoom where the whole artboard (all 200 nodes) is on screen.
const PAN_ZOOM = 0.21;
const PAN_RADIUS_PX = { x: 240, y: 160 };
const PINCH_WOBBLE_PX = { x: 60, y: 40 };
const NODE_COUNT = 200;

interface AppearanceViewportVariant {
  // Scenario id stems: `<pinch>`, `<pan>`, and `<stops>`.
  ids: { pan: string; pinch: string; stops: string };
  label: string;
  load: (context: PerformanceBenchmarkContext) => Promise<void>;
  scene: string;
}

const createPinchBenchmark = (
  variant: AppearanceViewportVariant
): PerformanceBenchmarkDefinition => {
  return {
    defaultOptions: {
      frames: 281,
      nodeCount: NODE_COUNT,
      stepX: 0,
      stepY: 0,
      warmupFrames: 12,
    },
    description: `Continuous anchored pinch: ${variant.scene}, zoomed down the 100→1% ladder and back up with a small screen-space wobble; the middle frame lands on 1%.`,
    id: variant.ids.pinch,
    label: `Appearance Pinch (${variant.label})`,
    setup: async (context) => {
      await variant.load(context);

      const { editor, options } = context;
      const host = captureViewportHost(editor);
      const middle = Math.floor((options.frames - 1) / 2);

      probeViewportTrajectory(
        editor,
        (index) => getPinchCamera(host, index, options.frames),
        [0, Math.floor(middle / 2), middle, options.frames - 1]
      );
      await context.waitForFrames(4);
    },
    run: async ({ editor, options, recordMetric, waitForFrame }) => {
      const host = captureViewportHost(editor);
      // A pinch is a continuous zoom: art reuses its raster until it ends.
      const session = editor.beginContinuousZoom("pinch");

      editor.setViewportInteracting(true);

      try {
        for (let index = 0; index < options.frames; index += 1) {
          await waitForFrame();
          editor.moveViewportTo(getPinchCamera(host, index, options.frames));
        }
      } finally {
        const endedAt = performance.now();

        editor.endContinuousZoom(session, "end");
        editor.setViewportInteracting(false);
        await waitForFrame();
        await waitForFrame();
        recordMetric("zoom.settleMs", performance.now() - endedAt);
      }
    },
    usesScratchDocument: true,
  };
};

const createPanBenchmark = (
  variant: AppearanceViewportVariant
): PerformanceBenchmarkDefinition => {
  return {
    defaultOptions: {
      frames: 240,
      nodeCount: NODE_COUNT,
      stepX: 0,
      stepY: 0,
      warmupFrames: 12,
    },
    description: `Fixed-zoom translation: ${variant.scene}, panned around a ${PAN_RADIUS_PX.x} × ${PAN_RADIUS_PX.y} px screen-space ellipse at ${PAN_ZOOM * 100}% zoom.`,
    id: variant.ids.pan,
    label: `Appearance Pan (${variant.label})`,
    setup: async (context) => {
      await variant.load(context);

      const { editor, options } = context;
      const host = captureViewportHost(editor);

      probeViewportTrajectory(
        editor,
        (index) => getPanStep(host, index, options.frames),
        [0, Math.floor(options.frames / 4), Math.floor(options.frames / 2)]
      );
      await context.waitForFrames(4);
    },
    run: async ({ editor, options, waitForFrame }) => {
      const host = captureViewportHost(editor);

      editor.setViewportInteracting(true);

      try {
        for (let index = 1; index <= options.frames; index += 1) {
          await waitForFrame();
          editor.moveViewportTo(getPanStep(host, index, options.frames));
        }
      } finally {
        editor.setViewportInteracting(false);
      }
    },
    usesScratchDocument: true,
  };
};

// Discrete jumps down the ladder and back, each published at once like a
// zoom command. Records `zoomStop.settleMs` (command to the second following
// frame) and dwells so raster refinement after each stop lands in the frames.
const createZoomStopsBenchmark = (
  variant: AppearanceViewportVariant
): PerformanceBenchmarkDefinition => {
  return {
    defaultOptions: {
      frames: 12,
      nodeCount: NODE_COUNT,
      stepX: 0,
      stepY: 0,
      warmupFrames: 12,
    },
    description: `Explicit zoom stops: ${variant.scene}, jumped to each ladder stop (100→1→100%) and held for the dwell frames; records zoomStop.settleMs.`,
    id: variant.ids.stops,
    label: `Appearance Zoom Stops (${variant.label})`,
    setup: async (context) => {
      await variant.load(context);
      positionViewport(
        context.editor,
        getCameraCenteredOn(
          captureViewportHost(context.editor),
          APPEARANCE_ARTBOARD_CENTER,
          APPEARANCE_ZOOM_LADDER[0]
        )
      );
      await context.waitForFrames(4);
    },
    run: async ({ editor, options, recordMetric, waitForFrame }) => {
      const host = captureViewportHost(editor);
      const stops = [
        ...APPEARANCE_ZOOM_LADDER.slice(1),
        ...APPEARANCE_ZOOM_LADDER.slice(0, -1).reverse(),
      ];

      for (const zoom of stops) {
        const startedAt = performance.now();

        editor.moveViewportTo(
          getCameraCenteredOn(host, APPEARANCE_ARTBOARD_CENTER, zoom)
        );
        await waitForFrame();
        await waitForFrame();
        recordMetric("zoomStop.settleMs", performance.now() - startedAt);

        for (let index = 2; index < options.frames; index += 1) {
          await waitForFrame();
        }
      }
    },
    usesScratchDocument: true,
  };
};

const getPinchCamera = (
  host: ReturnType<typeof captureViewportHost>,
  index: number,
  frames: number
) => {
  const zoom = getLadderZoom(
    APPEARANCE_ZOOM_LADDER,
    getPingPongProgress(index, frames)
  );
  const camera = getCameraCenteredOn(host, APPEARANCE_ARTBOARD_CENTER, zoom);
  const phase = (index / frames) * Math.PI * 4;

  return {
    x: camera.x + (Math.sin(phase) * PINCH_WOBBLE_PX.x) / zoom,
    y: camera.y + (Math.cos(phase) * PINCH_WOBBLE_PX.y) / zoom,
    zoom,
  };
};

const getPanStep = (
  host: ReturnType<typeof captureViewportHost>,
  index: number,
  frames: number
) => {
  return getPanCamera(host, APPEARANCE_ARTBOARD_CENTER, PAN_ZOOM, {
    frames,
    index,
    radiusPx: PAN_RADIUS_PX,
  });
};

const createVariantBenchmarks = (variant: AppearanceViewportVariant) => {
  return [
    createPinchBenchmark(variant),
    createPanBenchmark(variant),
    createZoomStopsBenchmark(variant),
  ];
};

const loadScene = async (
  { editor, options, waitForFrame }: PerformanceBenchmarkContext,
  sceneOptions: Parameters<typeof loadAppearanceBenchmarkScene>[3] = {}
) => {
  const scene = await loadAppearanceBenchmarkScene(
    editor,
    options.nodeCount,
    waitForFrame,
    sceneOptions
  );

  editor.clearSelection();
  return scene;
};

const loadShadowedScene = async (
  context: PerformanceBenchmarkContext,
  shadow: typeof hardShadow
) => {
  const { children } = await loadScene(context);

  applyEffects(
    context.editor,
    children.map((node) => node.id),
    [shadow()]
  );
};

// Plain, shadowed, and nested scenes share geometry, trajectory, and
// selection; nested 60% groups have an opacity-1 structural twin.
export const appearanceViewportBenchmarks = [
  {
    ids: {
      pan: "appearance-pan-200-plain",
      pinch: "appearance-viewport-200-plain",
      stops: "appearance-zoom-stops-200-plain",
    },
    label: "200, plain",
    load: async (context) => {
      await loadScene(context);
    },
    scene: "200 solid-fill shapes and text in one 4500 × 5400 artboard",
  },
  {
    ids: {
      pan: "appearance-pan-200-shadow-hard",
      pinch: "appearance-viewport-200-shadow-hard",
      stops: "appearance-zoom-stops-200-shadow-hard",
    },
    label: "200, shadow hard",
    load: (context) => loadShadowedScene(context, hardShadow),
    scene:
      "the 200-node appearance scene with one hard 8/8 drop shadow per node",
  },
  {
    ids: {
      pan: "appearance-pan-200-shadow-blur24",
      pinch: "appearance-viewport-200-shadow-blur24",
      stops: "appearance-zoom-stops-200-shadow-blur24",
    },
    label: "200, shadow blur 24",
    load: (context) => loadShadowedScene(context, blurShadow),
    scene:
      "the 200-node appearance scene with one blur-24 8/8 drop shadow per node",
  },
  {
    ids: {
      pan: "appearance-nested-groups-pan-200",
      pinch: "appearance-nested-groups-viewport-200",
      stops: "appearance-nested-groups-zoom-stops-200",
    },
    label: "200, nested 60% groups",
    load: async (context) => {
      await loadScene(context, { nestedGroups: true });
    },
    scene: "the 200 nodes in 20 stacks of three nested 60%-opacity groups",
  },
  {
    ids: {
      pan: "appearance-nested-groups-opaque-pan-200",
      pinch: "appearance-nested-groups-opaque-viewport-200",
      stops: "appearance-nested-groups-opaque-zoom-stops-200",
    },
    label: "200, nested opaque groups",
    load: async (context) => {
      await loadScene(context, { nestedGroupOpacity: 1, nestedGroups: true });
    },
    scene:
      "the nested-groups control: the same 20 stacks of three groups at opacity 1",
  },
].flatMap((variant: AppearanceViewportVariant) =>
  createVariantBenchmarks(variant)
);
