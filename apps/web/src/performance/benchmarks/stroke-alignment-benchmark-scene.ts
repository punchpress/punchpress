import {
  createDefaultNode,
  createSolidAppearance,
  type Editor,
  getDefaultWarp,
} from "@punchpress/engine";
import {
  DEFAULT_LOCAL_FONT,
  type DesignDocument,
  saveDesignDocument,
} from "@punchpress/punch-schema";

type StrokeAlign = "center" | "inside" | "outside";
export type StrokeTextWarp = "flat" | "circle" | "warped";

const STROKE_WIDTH_MIN = 1;
const STROKE_WIDTH_MAX = 40;
const TEXT_GLYPH_COUNT = 500;
const TEXT_FONT_SIZE = 48;
const CIRCLE_SWEEP_DEG = 340;

// Aligned scenes pair an outside and an inside stroke; the center control keeps
// two center strokes so the layer count and widths match exactly.
const createStrokePair = (aligned: boolean) => {
  return [
    createStrokeLayer(
      "stroke-outer",
      "#ff7a00",
      aligned ? "outside" : "center"
    ),
    createStrokeLayer("stroke-inner", "#ffffff", aligned ? "inside" : "center"),
  ];
};

export const applyStrokePair = (
  editor: Editor,
  nodeIds: string[],
  aligned: boolean
) => {
  const strokes = createStrokePair(aligned);

  for (const nodeId of nodeIds) {
    const fills = editor.getNode(nodeId)?.appearance?.fills ?? [];

    if (!editor.setAppearance({ fills, strokes }, [nodeId])) {
      throw new Error(`Unable to set the stroke pair on ${nodeId}.`);
    }
  }
};

// Triangle ping-pong between the min and max width plus a tiny per-frame drift,
// so no two frames ever request the same width.
export const getScrubWidth = (index: number, frames: number) => {
  const cycles = 1.5;
  const phase = ((index / Math.max(1, frames)) * cycles) % 1;
  const triangle = phase < 0.5 ? phase * 2 : (1 - phase) * 2;

  return (
    STROKE_WIDTH_MIN +
    (STROKE_WIDTH_MAX - STROKE_WIDTH_MIN) * triangle +
    index * 0.001
  );
};

export const loadStrokeTextScene = async (
  editor: Editor,
  warp: StrokeTextWarp,
  waitForFrame: () => Promise<number>
) => {
  const base = createDefaultNode(DEFAULT_LOCAL_FONT);
  const text = createGlyphText(TEXT_GLYPH_COUNT);
  const node = {
    ...base,
    appearance: createSolidAppearance({ fill: "#1f6feb" }),
    fontSize: TEXT_FONT_SIZE,
    text,
    transform: { ...base.transform, x: 0, y: 0 },
    type: "text" as const,
  };
  const textNode = { ...node, warp: getTextWarp(warp, node) };

  editor.loadDocument(saveDesignDocument([textNode]).contents);
  editor.cancelPendingViewportFocus();
  await waitForGeometryReady(editor, textNode.id, waitForFrame);

  return textNode;
};

// Centers the node bounds; zoom 1 unless the content would not fit, so long
// text and the circle stay fully on screen (and are never culled).
export const getFittedViewport = (editor: Editor, nodeIds: string[]) => {
  const bounds = editor.getSelectionBounds(nodeIds);

  if (!bounds) {
    throw new Error("Stroke scene has no bounds to center on.");
  }

  const rect = editor.hostRef?.getBoundingClientRect();
  const width = rect?.width ?? 1280;
  const height = rect?.height ?? 800;
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;
  const zoom = Math.min(
    1,
    (width * 0.9) / Math.max(1, contentWidth),
    (height * 0.9) / Math.max(1, contentHeight)
  );

  return {
    x: bounds.minX + contentWidth / 2 - width / zoom / 2,
    y: bounds.minY + contentHeight / 2 - height / zoom / 2,
    zoom,
  };
};

const createGlyphText = (count: number) => {
  const words = "Print on demand ships bold strokes ";

  return Array.from({ length: count }, (_, index) => {
    return words[index % words.length];
  }).join("");
};

const createStrokeLayer = (id: string, color: string, align: StrokeAlign) => {
  return {
    align,
    cap: "round" as const,
    enabled: true,
    id,
    join: "round" as const,
    miterLimit: 4,
    opacity: 1,
    paint: { color, kind: "solid" as const },
    width: 10,
  };
};

type TextWarp = Extract<
  DesignDocument["nodes"][number],
  { type: "text" }
>["warp"];

const getTextWarp = (warp: StrokeTextWarp, node): TextWarp => {
  if (warp === "flat") {
    return { kind: "none" };
  }

  if (warp === "warped") {
    return { bend: 0.4, kind: "arch" };
  }

  // The default circle sweeps 100°; wrap 500 glyphs nearly all the way round.
  const circle = getDefaultWarp("circle", node) as Extract<
    TextWarp,
    { kind: "circle" }
  >;

  return {
    ...circle,
    radius: Math.round((circle.radius * circle.sweepDeg) / CIRCLE_SWEEP_DEG),
    sweepDeg: CIRCLE_SWEEP_DEG,
  };
};

const waitForGeometryReady = async (
  editor: Editor,
  nodeId: string,
  waitForFrame: () => Promise<number>
) => {
  const timeoutAt = performance.now() + 8000;

  while (editor.getNodeGeometry(nodeId)?.ready !== true) {
    const now = await waitForFrame();

    if (now >= timeoutAt) {
      throw new Error(`Stroke text geometry not ready for ${nodeId}.`);
    }
  }
};
