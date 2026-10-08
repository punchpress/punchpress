// Scene for the stroke-alignment sweep: one white artboard holding each
// alignment edge case, plus the world-space samples the sweep asserts.

export const ALIGNMENT_ARTBOARD_ID = "align-artboard";

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const YELLOW = [255, 204, 0];
const RED = [255, 0, 0];
const BLUE = [0, 0, 255];
const GREEN = [48, 164, 108];
// #1f6feb at 50% over white, and black at 50% over white.
const HALF_BLUE = [143, 183, 245];
const HALF_BLACK = [128, 128, 128];

const TEXT_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
};

const solid = (id: string, color: string, opacity = 1) => ({
  enabled: true,
  id,
  opacity,
  paint: { color, kind: "solid" },
});

const stroke = (
  id: string,
  align: string,
  width: number,
  paint: object,
  extra = {}
) => ({
  align,
  cap: "butt",
  enabled: true,
  id,
  join: "miter",
  miterLimit: 4,
  opacity: 1,
  paint,
  width,
  ...extra,
});

const node = (id: string, parentId = ALIGNMENT_ARTBOARD_ID) => ({
  id,
  opacity: 1,
  parentId,
  visible: true,
});

const rect = (id: string, box, appearance, parentId?: string) => ({
  ...node(id, parentId),
  appearance,
  cornerRadius: 0,
  height: box.height,
  shape: "polygon",
  transform: { rotation: 0, scaleX: 1, scaleY: 1, x: box.x, y: box.y },
  type: "shape",
  width: box.width,
});

const corner = (x: number, y: number) => ({
  handleIn: { x: 0, y: 0 },
  handleOut: { x: 0, y: 0 },
  point: { x, y },
  pointType: "corner",
});

const square = (x: number, y: number, size: number) => ({
  closed: true,
  segments: [
    corner(x, y),
    corner(x + size, y),
    corner(x + size, y + size),
    corner(x, y + size),
  ],
});

// Path points are world coordinates when the transform is the identity.
const path = (id: string, contours, fillRule: string, appearance) => ({
  ...node(id),
  appearance,
  contours,
  fillRule,
  transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
  type: "path",
});

const ring = (red) => ({
  fills: [],
  strokes: [stroke("ring", "outside", 30, red, { join: "round" })],
});

const RED_PAINT = { color: "#ff0000", kind: "solid" };

const text = (id: string, center, warp) => ({
  ...node(id),
  appearance: {
    fills: [solid("fill", "#000000")],
    strokes: [
      stroke(
        "ring",
        "outside",
        10,
        { color: "#ffcc00", kind: "solid" },
        {
          join: "round",
        }
      ),
    ],
  },
  font: TEXT_FONT,
  fontSize: 140,
  text: "STROKE",
  tracking: 0,
  transform: { rotation: 0, scaleX: 1, scaleY: 1, x: center.x, y: center.y },
  type: "text",
  warp,
});

export const TEXT_NODES = [
  { center: { x: 700, y: 1000 }, id: "align-circle-text", masks: 6 },
  { center: { x: 1900, y: 1000 }, id: "align-arch-text", masks: 1 },
];

export const ALIGNMENT_DOCUMENT = JSON.stringify({
  assets: {},
  nodes: [
    {
      ...node(ALIGNMENT_ARTBOARD_ID, "root"),
      background: "#ffffff",
      height: 1400,
      locked: false,
      name: "Alignment",
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      type: "artboard",
      width: 3200,
    },
    // A: translucent fill, outside black 40, inside yellow 20. Left edge x=100.
    rect(
      "align-translucent",
      { height: 300, width: 400, x: 300, y: 300 },
      {
        fills: [solid("fill", "#1f6feb", 0.5)],
        strokes: [
          stroke("in", "inside", 20, { color: "#ffcc00", kind: "solid" }),
          stroke("out", "outside", 40, { color: "#000000", kind: "solid" }),
        ],
      }
    ),
    // B and C: a 400 square with a 200 hole, outside red ring, no fill.
    path(
      "align-evenodd",
      [square(700, 100, 400), square(800, 200, 200)],
      "evenodd",
      ring(RED_PAINT)
    ),
    path(
      "align-nonzero",
      [square(1200, 100, 400), square(1300, 200, 200)],
      "nonzero",
      ring(RED_PAINT)
    ),
    // D: an open line has no inside, so its outside stroke paints on center.
    path(
      "align-open",
      [{ closed: false, segments: [corner(1800, 150), corner(2200, 150)] }],
      "nonzero",
      {
        fills: [],
        strokes: [
          stroke("line", "outside", 30, { color: "#30a46c", kind: "solid" }),
        ],
      }
    ),
    // E: outside 40 at a square corner — miter reaches the corner point,
    // round stops at radius 40.
    rect(
      "align-miter",
      { height: 200, width: 200, x: 1900, y: 400 },
      {
        fills: [],
        strokes: [
          stroke("out", "outside", 40, { color: "#000000", kind: "solid" }),
        ],
      }
    ),
    rect(
      "align-round",
      { height: 200, width: 200, x: 2200, y: 400 },
      {
        fills: [],
        strokes: [
          stroke(
            "out",
            "outside",
            40,
            { color: "#000000", kind: "solid" },
            {
              join: "round",
            }
          ),
        ],
      }
    ),
    // F: an outside red → blue gradient ring spans the unstroked box.
    rect(
      "align-gradient",
      { height: 120, width: 600, x: 2800, y: 160 },
      {
        fills: [],
        strokes: [
          stroke("out", "outside", 30, {
            end: { x: 1, y: 0.5 },
            kind: "linear-gradient",
            start: { x: 0, y: 0.5 },
            stops: [
              { color: "#ff0000", id: "a", offset: 0, opacity: 1 },
              { color: "#0000ff", id: "b", offset: 1, opacity: 1 },
            ],
          }),
        ],
      }
    ),
    // G: a 50% group isolates an opaque fill and its outside ring.
    {
      ...node("align-group"),
      name: "Half",
      opacity: 0.5,
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      type: "group",
    },
    rect(
      "align-grouped",
      { height: 200, width: 300, x: 2650, y: 500 },
      {
        fills: [solid("fill", "#1f6feb")],
        strokes: [
          stroke("out", "outside", 40, { color: "#000000", kind: "solid" }),
        ],
      },
      "align-group"
    ),
    text("align-circle-text", TEXT_NODES[0].center, {
      inverted: false,
      kind: "circle",
      pathPosition: 0,
      radius: 260,
      sweepDeg: 160,
    }),
    text("align-arch-text", TEXT_NODES[1].center, { bend: 0.4, kind: "arch" }),
  ],
  version: "1.11",
});

const sample = (
  name: string,
  x: number,
  y: number,
  color: number[],
  halfWidth: number
) => ({ color, halfWidth, name, point: { x, y } });

export const ALIGNMENT_SAMPLES = [
  sample("translucent: background", 30, 300, WHITE, 25),
  sample("translucent: outside ring", 80, 300, BLACK, 10),
  sample("translucent: inside ring", 110, 300, YELLOW, 5),
  // The outside stroke's hidden inner half would darken this band.
  sample("translucent: fill over masked half", 130, 300, HALF_BLUE, 5),
  sample("translucent: fill", 300, 300, HALF_BLUE, 60),
  sample("evenodd: outer ring", 685, 300, RED, 7),
  sample("evenodd: ring material stays empty", 750, 300, WHITE, 20),
  sample("evenodd: ring inside the hole", 815, 300, RED, 7),
  sample("nonzero: outer ring", 1185, 300, RED, 7),
  sample("nonzero: no ring inside the filled hole", 1315, 300, WHITE, 7),
  sample("open: center band", 2000, 158, GREEN, 4),
  sample("open: not doubled", 2000, 172, WHITE, 4),
  sample("miter: corner tip", 1765, 265, BLACK, 3),
  sample("round: beyond the arc", 2065, 265, WHITE, 3),
  sample("gradient: start of ramp", 2485, 160, RED, 7),
  sample("gradient: end of ramp", 3115, 160, BLUE, 7),
  sample("group: half ring", 2480, 500, HALF_BLACK, 10),
  sample("group: half fill", 2560, 500, HALF_BLUE, 20),
];
