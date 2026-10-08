import type {
  AppearanceDocument,
  FillLayerDocument,
  PaintDocument,
  StrokeLayerDocument,
} from "@punchpress/punch-schema";

export type Appearance = AppearanceDocument;
export type FillLayer = FillLayerDocument;
export type StrokeLayer = StrokeLayerDocument;

export type Paint = PaintDocument;

export interface AppearanceFillDraw {
  kind: "fill";
  layerId: string;
  opacity: number;
  paint: Paint;
}

export interface AppearanceStrokeDraw {
  // Effective alignment: "center" whenever the object has an open-only path.
  align: StrokeLayer["align"];
  cap: StrokeLayer["cap"];
  join: StrokeLayer["join"];
  kind: "stroke";
  layerId: string;
  miterLimit: number;
  opacity: number;
  paint: Paint;
  width: number;
}

export type AppearanceDraw = AppearanceFillDraw | AppearanceStrokeDraw;

// One painted element per geometry path. A fill immediately followed by a
// stroke shares one element (paint-order "fill stroke"), which renders exactly
// like two elements and halves the DOM for the common one-fill-one-stroke stack.
export interface AppearancePass {
  fill: AppearanceFillDraw | null;
  key: string;
  stroke: AppearanceStrokeDraw | null;
}

export interface Bounds {
  height: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  width: number;
}

// 2D affine matrix [a b c d e f], the same layout as SVG matrix().
export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface AppearancePath {
  // Conservative bounds of `d` in the path's own coordinates (before
  // `transform`); sizes the inverse mask of outside strokes.
  bounds?: Bounds | null;
  closed?: boolean;
  d: string;
  fillRule?: "evenodd" | "nonzero";
  // Vector entries: conservative ink in the vector's space (after the entry
  // transform), so the vector's shadow filter covers scaled children.
  ink?: Bounds | null;
  // False when every contour is open; inside and outside strokes then paint
  // on center. Missing means closed (glyphs, shapes).
  hasClosedContour?: boolean;
  key: string;
  // Glyph layout transform as numbers, equal to `transform`; paint servers in
  // node space undo it so one gradient spans every glyph.
  layoutMatrix?: Matrix;
  // Unstroked bounds of a vector child's geometry in its own local space.
  paintBox?: Bounds | null;
  transform?: string | null;
}

// One painted object: a set of geometry paths that share one appearance stack
// and composite under one opacity group.
export interface AppearanceObject {
  draws: readonly AppearanceDraw[];
  key: string;
  opacity: number;
  // Unstroked bounds gradients normalize against, in `paintSpace`: "node" for
  // leaf art (path transforms are glyph layout and are undone), "path" for
  // vector children and compiled results (path transforms are placement).
  paintBox: Bounds | null;
  paintSpace: "node" | "path";
  passes: readonly AppearancePass[];
  paths: readonly AppearancePath[];
  styleNodeId: string;
}
