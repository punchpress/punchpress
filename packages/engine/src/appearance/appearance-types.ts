import type {
  AppearanceDocument,
  FillLayerDocument,
  StrokeLayerDocument,
} from "@punchpress/punch-schema";

export type Appearance = AppearanceDocument;
export type FillLayer = FillLayerDocument;
export type StrokeLayer = StrokeLayerDocument;

export interface AppearanceFillDraw {
  color: string;
  kind: "fill";
  layerId: string;
  opacity: number;
}

export interface AppearanceStrokeDraw {
  cap: StrokeLayer["cap"];
  color: string;
  join: StrokeLayer["join"];
  kind: "stroke";
  layerId: string;
  miterLimit: number;
  opacity: number;
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

export interface AppearancePath {
  closed?: boolean;
  d: string;
  fillRule?: "evenodd" | "nonzero";
  key: string;
  transform?: string | null;
}

// One painted object: a set of geometry paths that share one appearance stack
// and composite under one opacity group.
export interface AppearanceObject {
  draws: readonly AppearanceDraw[];
  key: string;
  opacity: number;
  passes: readonly AppearancePass[];
  paths: readonly AppearancePath[];
  styleNodeId: string;
}
