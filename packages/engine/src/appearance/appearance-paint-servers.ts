import type {
  AppearanceDraw,
  AppearanceObject,
  AppearancePath,
  Matrix,
} from "./appearance-types";

export interface GradientDef {
  id: string;
  stops: readonly { color: string; offset: number; opacity: number }[];
  transform: string | null;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

// What one draw paints on one path: a color, or a reference to a gradient
// definition. `opacity` is the fill-/stroke-opacity attribute value.
export interface ResolvedPaint {
  def: GradientDef | null;
  opacity: number;
  value: string;
}

// Resolves a draw's paint for one path. Gradients use userSpaceOnUse
// coordinates mapped from the normalized endpoints through the object's paint
// box. Node-space paths that carry a glyph layout transform get their own
// definition whose gradientTransform undoes that layout, so one ramp spans the
// whole text. `makeId` turns a stable key into a document-unique id.
export const resolveDrawPaint = (
  object: AppearanceObject,
  draw: AppearanceDraw,
  path: AppearancePath,
  makeId: (key: string) => string
): ResolvedPaint => {
  const { paint } = draw;

  if (paint.kind === "solid") {
    return { def: null, opacity: draw.opacity, value: paint.color };
  }

  const box = object.paintBox;
  const x1 = box ? box.minX + paint.start.x * box.width : 0;
  const y1 = box ? box.minY + paint.start.y * box.height : 0;
  const x2 = box ? box.minX + paint.end.x * box.width : 0;
  const y2 = box ? box.minY + paint.end.y * box.height : 0;

  // A zero-length vector paints the last stop, as SVG specifies.
  if (!box || (x1 === x2 && y1 === y2)) {
    const last = paint.stops.at(-1);

    return {
      def: null,
      opacity: draw.opacity * (last?.opacity ?? 1),
      value: last?.color ?? "#000000",
    };
  }

  const ownTransform =
    object.paintSpace === "node" && path.layoutMatrix
      ? formatMatrix(invertMatrix(path.layoutMatrix))
      : null;

  if (ownTransform === "") {
    // A singular layout transform has no inverse; paint the first stop.
    return {
      def: null,
      opacity: draw.opacity * paint.stops[0].opacity,
      value: paint.stops[0].color,
    };
  }

  const id = makeId(
    ownTransform
      ? `${object.key}|${draw.layerId}|${path.key}`
      : `${object.key}|${draw.layerId}`
  );

  return {
    def: {
      id,
      stops: paint.stops.map(({ color, offset, opacity }) => ({
        color,
        offset,
        opacity,
      })),
      transform: ownTransform,
      x1,
      x2,
      y1,
      y2,
    },
    opacity: draw.opacity,
    value: `url(#${id})`,
  };
};

export const formatPaintNumber = (value: number) => {
  return Number.isFinite(value) ? Number(value.toFixed(6)).toString() : "0";
};

const invertMatrix = ({ a, b, c, d, e, f }: Matrix): Matrix | null => {
  const determinant = a * d - b * c;

  if (Math.abs(determinant) < 1e-12) {
    return null;
  }

  return {
    a: d / determinant,
    b: -b / determinant,
    c: -c / determinant,
    d: a / determinant,
    e: (c * f - d * e) / determinant,
    f: (b * e - a * f) / determinant,
  };
};

const formatMatrix = (matrix: Matrix | null) => {
  if (!matrix) {
    return "";
  }

  const { a, b, c, d, e, f } = matrix;

  return `matrix(${[a, b, c, d, e, f].map(formatPaintNumber).join(" ")})`;
};
