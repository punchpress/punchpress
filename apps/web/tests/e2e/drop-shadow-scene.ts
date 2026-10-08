// Scene for the drop-shadow sweep: hard, blurred, and rotated leaf shadows, a
// translucent shadowed group, and a group shadow clipped by its artboard.

export const SHADOW_ARTBOARD_ID = "shadow-artboard";

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const BLUE = [31, 111, 235];
// Black and #ff0000 at 50% over white.
const HALF_BLACK = [128, 128, 128];
const HALF_RED = [255, 128, 128];

const IDENTITY = { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 };

const shadow = (extra = {}) => ({
  blur: 0,
  color: "#000000",
  enabled: true,
  id: "shadow-1",
  kind: "drop-shadow",
  opacity: 1,
  x: 30,
  y: 30,
  ...extra,
});

const fill = (color: string) => ({
  fills: [
    { enabled: true, id: "fill", opacity: 1, paint: { color, kind: "solid" } },
  ],
  strokes: [],
});

const rect = (
  id: string,
  parentId: string,
  box,
  color: string,
  extra = {}
) => ({
  appearance: fill(color),
  cornerRadius: 0,
  height: box.height,
  id,
  opacity: 1,
  parentId,
  shape: "polygon",
  transform: {
    ...IDENTITY,
    x: box.x,
    y: box.y,
    ...(box.rotation ? { rotation: box.rotation } : {}),
  },
  type: "shape",
  visible: true,
  width: box.width,
  ...extra,
});

const group = (id: string, extra = {}) => ({
  id,
  name: id,
  opacity: 1,
  parentId: SHADOW_ARTBOARD_ID,
  transform: IDENTITY,
  type: "group",
  visible: true,
  ...extra,
});

export const SHADOW_DOCUMENT = JSON.stringify({
  assets: {},
  nodes: [
    {
      background: "#ffffff",
      height: 700,
      id: SHADOW_ARTBOARD_ID,
      locked: false,
      name: "Shadows",
      opacity: 1,
      parentId: "root",
      transform: IDENTITY,
      type: "artboard",
      visible: true,
      width: 1600,
    },
    // A: hard 30/30 shadow. Shape spans 200..400 × 250..350.
    rect(
      "shadow-hard",
      SHADOW_ARTBOARD_ID,
      { height: 100, width: 200, x: 300, y: 300 },
      "#1f6feb",
      {
        effects: [shadow()],
      }
    ),
    // B: blurred shadow 150 below (blur 20 → σ 10). Shadow spans 700..900 ×
    // 400..500, fading out within 40 units.
    rect(
      "shadow-blur",
      SHADOW_ARTBOARD_ID,
      { height: 100, width: 200, x: 800, y: 300 },
      "#1f6feb",
      {
        effects: [shadow({ blur: 20, x: 0, y: 150 })],
      }
    ),
    // C: rotated 90°: a +x shadow turns to +y. Square spans 1250..1350 ×
    // 250..350; its shadow lands at 310..410 in y.
    rect(
      "shadow-rotated",
      SHADOW_ARTBOARD_ID,
      { height: 100, rotation: 90, width: 100, x: 1300, y: 300 },
      "#1f6feb",
      {
        effects: [shadow({ x: 60, y: 0 })],
      }
    ),
    // D: a 50% group shadows its red square 30/30 (square 150..250 × 550..650).
    group("shadow-group", { effects: [shadow()], opacity: 0.5 }),
    rect(
      "shadow-grouped",
      "shadow-group",
      { height: 100, width: 100, x: 200, y: 600 },
      "#ff0000"
    ),
    // E: a group shadow 100 right of a square at 1440..1540 spans 1540..1640,
    // past the artboard's right edge (1600), and must clip there.
    group("shadow-edge", { effects: [shadow({ x: 100, y: 0 })] }),
    rect(
      "shadow-edge-square",
      "shadow-edge",
      { height: 100, width: 100, x: 1490, y: 600 },
      "#1f6feb"
    ),
  ],
  version: "1.12",
});

const sample = (
  name: string,
  x: number,
  y: number,
  color: number[],
  halfWidth: number
) => ({
  color,
  halfWidth,
  name,
  point: { x, y },
});

export const SHADOW_SAMPLES = [
  sample("hard: fill", 300, 300, BLUE, 40),
  sample("hard: shadow past the corner", 415, 365, BLACK, 10),
  sample("hard: clear beyond the shadow", 445, 395, WHITE, 10),
  sample("blur: shadow core", 800, 450, BLACK, 15),
  sample("blur: clear past 4 sigma", 800, 560, WHITE, 15),
  sample("rotated: shadow turned below", 1300, 390, BLACK, 15),
  sample("rotated: nothing to the right", 1385, 300, WHITE, 15),
  sample("group: half fill", 200, 600, HALF_RED, 30),
  sample("group: half shadow", 265, 665, HALF_BLACK, 10),
  sample("edge: shadow inside the artboard", 1570, 600, BLACK, 10),
];

// Just outside the artboard, where the unclipped shadow would continue.
export const SHADOW_CLIPPED_POINT = { x: 1630, y: 600 };
