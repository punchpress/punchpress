import type { Editor, Effect } from "@punchpress/engine";

type StrokeAlign = "center" | "inside" | "outside";

const SHADOW_OFFSET = 8;
const SCRUB_BLUR_MAX = 40;
const STROKE_ALIGNS: StrokeAlign[] = ["center", "inside", "outside"];
const STACK_COLORS = [
  "#1f6feb",
  "#ff7a00",
  "#2da44e",
  "#d1242f",
  "#8250df",
  "#bf8700",
  "#0a3069",
  "#ffffff",
];

export const createDropShadow = (
  id: string,
  { blur = 0, color = "#000000", opacity = 0.6, x = 8, y = 8 } = {}
): Effect => {
  return { blur, color, enabled: true, id, kind: "drop-shadow", opacity, x, y };
};

export const hardShadow = () => {
  return createDropShadow("shadow-hard", {
    x: SHADOW_OFFSET,
    y: SHADOW_OFFSET,
  });
};

export const blurShadow = () => {
  return createDropShadow("shadow-blur", {
    blur: 24,
    x: SHADOW_OFFSET,
    y: SHADOW_OFFSET,
  });
};

// One `setEffects` per run of nodes so setup records a single history step.
export const applyEffects = (
  editor: Editor,
  nodeIds: string[],
  effects: Effect[]
) => {
  if (!editor.setEffects(effects, nodeIds)) {
    throw new Error("Unable to apply the benchmark drop shadows.");
  }
};

// Adds one center stroke to the target so the shadow scrub and its stroke
// control edit the same node with the same layer stack.
export const addScrubStroke = (editor: Editor, nodeId: string) => {
  const fills = editor.getNode(nodeId)?.appearance?.fills ?? [];
  const strokes = [createStrokeLayer(0, "center", 10)];

  if (!editor.setAppearance({ fills, strokes }, [nodeId])) {
    throw new Error(`Unable to set the scrub stroke on ${nodeId}.`);
  }
};

// Blur ping-pongs 0→40→0 while the offset orbits, so every frame is a new
// effect value (no two frames request the same filter).
export const getShadowScrubPatch = (index: number, frames: number) => {
  const phase = ((index / Math.max(1, frames)) * 1.5) % 1;
  const triangle = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  const angle = (index / Math.max(1, frames)) * Math.PI * 4;

  return {
    blur: SCRUB_BLUR_MAX * triangle + index * 0.001,
    x: Math.cos(angle) * 12,
    y: Math.sin(angle) * 12,
  };
};

// The worst supported stack: 8 fills (solid and gradient, translucent so every
// layer paints), 8 strokes across all three alignments, 4 shadows up to blur 500.
export const applyMaxStack = (editor: Editor, nodeIds: string[]) => {
  const fills = STACK_COLORS.map((color, index) => {
    return createFillLayer(index, color);
  });
  const strokes = STACK_COLORS.map((_color, index) => {
    return createStrokeLayer(
      index,
      STROKE_ALIGNS[index % STROKE_ALIGNS.length],
      4 + index * 3
    );
  });
  const effects = [
    createDropShadow("shadow-0", { x: 4, y: 4 }),
    createDropShadow("shadow-1", { blur: 8, color: "#1f6feb", x: -6, y: 6 }),
    createDropShadow("shadow-2", { blur: 24, opacity: 0.4, x: 12, y: 16 }),
    createDropShadow("shadow-3", { blur: 500, opacity: 0.3, x: 0, y: 40 }),
  ];

  if (!editor.setAppearance({ fills, strokes }, nodeIds)) {
    throw new Error("Unable to apply the max appearance stack.");
  }

  applyEffects(editor, nodeIds, effects);
};

// Zoom 1% → 6400% → 1%, geometric so every decade gets equal time.
export const getMaxStackZoom = (index: number, frames: number) => {
  const progress = index / Math.max(1, frames - 1);
  const pingPong = progress <= 0.5 ? progress * 2 : (1 - progress) * 2;
  const minZoom = 0.01;
  const maxZoom = 64;

  return minZoom * (maxZoom / minZoom) ** pingPong;
};

// Keeps a node's left edge (fills, all stroke alignments, and shadows) in view
// at every zoom, including 6400%.
export const getFocusedViewport = (
  editor: Editor,
  nodeId: string,
  zoom: number
) => {
  const bounds = editor.getSelectionBounds([nodeId]);

  if (!bounds) {
    throw new Error(`Max-stack focus node ${nodeId} has no bounds.`);
  }

  const rect = editor.hostRef?.getBoundingClientRect();
  const width = rect?.width ?? 1280;
  const height = rect?.height ?? 800;
  const focusX = bounds.minX;
  const focusY = (bounds.minY + bounds.maxY) / 2;

  return {
    x: focusX - width / zoom / 2,
    y: focusY - height / zoom / 2,
    zoom,
  };
};

const createFillLayer = (index: number, color: string) => {
  const paint =
    index % 2 === 0
      ? { color, kind: "solid" as const }
      : {
          end: { x: 1, y: 1 },
          kind: "linear-gradient" as const,
          start: { x: 0, y: 0 },
          stops: [
            { color, id: `stop-${index}-a`, offset: 0, opacity: 1 },
            {
              color: "#000000",
              id: `stop-${index}-b`,
              offset: 1,
              opacity: 0.5,
            },
          ],
        };

  return { enabled: true, id: `fill-${index}`, opacity: 0.5, paint };
};

const createStrokeLayer = (
  index: number,
  align: StrokeAlign,
  width: number
) => {
  return {
    align,
    cap: "round" as const,
    enabled: true,
    id: `stroke-${index}`,
    join: "round" as const,
    miterLimit: 4,
    opacity: 0.8,
    paint: {
      color: STACK_COLORS[index % STACK_COLORS.length],
      kind: "solid" as const,
    },
    width,
  };
};
