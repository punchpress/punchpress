/**
 * Span painter for solid (fully-hard, fully-opaque) paint dabs and stroke
 * segments. A solid write covers either a circle (no `from`) or a capsule —
 * the exact envelope of the brush circle swept along `from -> point`. Each
 * row is bounded analytically: the interior span fills with the saturated
 * RGBA word and only the one-pixel antialias band at span ends runs the
 * coverage callback.
 *
 * Antialias-band pixels compose by coverage MAX, not source-over: a solid
 * stroke is the union of its dabs, so a pixel's alpha is the envelope
 * coverage of the nearest dab. Source-over accumulation of overlapping dab
 * edges distorts the stored edge profile, which upscales into chunky
 * stair-steps (the 200%-zoom staircase defect).
 *
 * `skip` is a caller guarantee that an identical solid dab/capsule (same
 * color, full opacity) was already painted, so pixels whose centers lie
 * inside the skip interior already hold the saturated color and can be left
 * untouched; heavily overlapping stroke dabs only pay for their new crescent.
 */

type Point = { x: number; y: number };

type SolidWrite = {
  getCoverage: (x: number, y: number, point: Point) => number;
  opacity: number;
  point: Point;
  solid?: {
    from?: Point;
    radius: number;
    skip?: { from?: Point; radius: number; x: number; y: number };
  };
};

type SegmentGeometry = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  length: number;
  ux: number;
  uy: number;
};

const SEGMENT_EPSILON = 1e-6;

const getSegmentGeometry = (
  from: Point | undefined,
  to: Point
): SegmentGeometry => {
  const ax = from?.x ?? to.x;
  const ay = from?.y ?? to.y;
  const dx = to.x - ax;
  const dy = to.y - ay;
  const length = Math.hypot(dx, dy);

  if (length < SEGMENT_EPSILON) {
    return { ax: to.x, ay: to.y, bx: to.x, by: to.y, length: 0, ux: 1, uy: 0 };
  }

  return { ax, ay, bx: to.x, by: to.y, length, ux: dx / length, uy: dy / length };
};

/**
 * World-x interval covered by the capsule on the pixel-row of sample y `py`.
 * A capsule is convex, so the row intersection is one interval; its extremes
 * are attained by a cap circle or the oriented band, so the hull of those
 * sub-intervals is exact.
 */
const getCapsuleRowInterval = (
  geometry: SegmentGeometry,
  py: number,
  radius: number
) => {
  if (radius <= 0) {
    return null;
  }

  const radiusSquared = radius * radius;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  const dyA = py - geometry.ay;
  const capA = radiusSquared - dyA * dyA;

  if (capA > 0) {
    const half = Math.sqrt(capA);

    lo = geometry.ax - half;
    hi = geometry.ax + half;
  }

  if (geometry.length > 0) {
    const dyB = py - geometry.by;
    const capB = radiusSquared - dyB * dyB;

    if (capB > 0) {
      const half = Math.sqrt(capB);

      lo = Math.min(lo, geometry.bx - half);
      hi = Math.max(hi, geometry.bx + half);
    }

    // Oriented band: |perpendicular distance| <= radius AND projection
    // t within [0, length]. Each constraint is linear in x (or x-free).
    const { ax, ay, length, ux, uy } = geometry;
    const offsetY = py - ay;
    let bandLo = Number.NEGATIVE_INFINITY;
    let bandHi = Number.POSITIVE_INFINITY;
    let bandValid = true;

    if (Math.abs(uy) > SEGMENT_EPSILON) {
      const first = ax + (offsetY * ux - radius) / uy;
      const second = ax + (offsetY * ux + radius) / uy;

      bandLo = Math.min(first, second);
      bandHi = Math.max(first, second);
    } else if (Math.abs(offsetY) > radius) {
      // Horizontal segment: perpendicular distance is |offsetY| for every x.
      bandValid = false;
    }

    if (bandValid) {
      if (Math.abs(ux) > SEGMENT_EPSILON) {
        const atStart = ax - (offsetY * uy) / ux;
        const atEnd = ax + (length - offsetY * uy) / ux;

        bandLo = Math.max(bandLo, Math.min(atStart, atEnd));
        bandHi = Math.min(bandHi, Math.max(atStart, atEnd));
      } else if (offsetY * uy < 0 || offsetY * uy > length) {
        // Vertical segment: projection t is offsetY * uy for every x.
        bandValid = false;
      }
    }

    if (bandValid && bandLo <= bandHi) {
      lo = Math.min(lo, bandLo);
      hi = Math.max(hi, bandHi);
    }
  }

  return lo <= hi ? { hi, lo } : null;
};

export const paintSolidStrokeSpans = ({
  blue,
  green,
  localMaxX,
  localMaxY,
  localMinX,
  localMinY,
  red,
  saturatedWord,
  tile,
  write,
}: {
  blue: number;
  green: number;
  localMaxX: number;
  localMaxY: number;
  localMinX: number;
  localMinY: number;
  red: number;
  saturatedWord: number;
  tile: {
    floatPixels: Float32Array | null;
    pixels: Uint8ClampedArray;
    width: number;
    x: number;
    y: number;
  };
  write: SolidWrite;
}) => {
  const { getCoverage, opacity, point } = write;
  const solid = write.solid;
  const radius = solid?.radius || 0;
  const skip = solid?.skip || null;
  const geometry = getSegmentGeometry(solid?.from, point);
  const skipGeometry = skip
    ? getSegmentGeometry(skip.from, { x: skip.x, y: skip.y })
    : null;
  const interiorRadius = radius - 0.5;
  const outerRadius = radius + 0.5;
  const skipRadius = skip ? skip.radius - 0.5 : 0;
  const floatPixels = tile.floatPixels;
  const pixels = tile.pixels;
  const words = new Uint32Array(
    pixels.buffer,
    pixels.byteOffset,
    pixels.length / 4
  );
  const redByte = saturatedWord & 0xff;
  const greenByte = (saturatedWord >>> 8) & 0xff;
  const blueByte = (saturatedWord >>> 16) & 0xff;

  const blendEdgePixel = (x: number, y: number, rowOffset: number) => {
    if (words[rowOffset + x] === saturatedWord) {
      return;
    }

    const coverage = getCoverage(tile.x + x + 0.5, tile.y + y + 0.5, point);

    if (coverage <= 0) {
      return;
    }

    const sourceAlpha = Math.min(1, Math.max(0, coverage * opacity));
    const offset = (rowOffset + x) * 4;
    const sourceAlphaByte = Math.round(sourceAlpha * 255);

    // Union composition: only raise alpha toward the envelope coverage.
    if (sourceAlphaByte <= pixels[offset + 3]) {
      return;
    }

    pixels[offset] = redByte;
    pixels[offset + 1] = greenByte;
    pixels[offset + 2] = blueByte;
    pixels[offset + 3] = sourceAlphaByte;

    if (floatPixels) {
      floatPixels[offset] = red;
      floatPixels[offset + 1] = green;
      floatPixels[offset + 2] = blue;
      floatPixels[offset + 3] = sourceAlpha;
    }
  };

  const fillSpan = (rowOffset: number, fromX: number, toX: number) => {
    for (let x = fromX; x <= toX; x += 1) {
      words[rowOffset + x] = saturatedWord;

      if (floatPixels) {
        const offset = (rowOffset + x) * 4;

        floatPixels[offset] = red;
        floatPixels[offset + 1] = green;
        floatPixels[offset + 2] = blue;
        floatPixels[offset + 3] = 1;
      }
    }
  };

  for (let y = localMinY; y <= localMaxY; y += 1) {
    const py = tile.y + y + 0.5;
    const outerInterval = getCapsuleRowInterval(geometry, py, outerRadius);

    if (!outerInterval) {
      continue;
    }

    const rowOffset = y * tile.width;
    // Pixel x samples at tile.x + x + 0.5: inside [lo, hi] when
    // x within [lo - tile.x - 0.5, hi - tile.x - 0.5].
    const rowMinX = Math.max(
      localMinX,
      Math.ceil(outerInterval.lo - tile.x - 0.5)
    );
    const rowMaxX = Math.min(
      localMaxX,
      Math.floor(outerInterval.hi - tile.x - 0.5)
    );

    if (rowMinX > rowMaxX) {
      continue;
    }

    const interiorInterval = getCapsuleRowInterval(geometry, py, interiorRadius);
    let spanMinX = rowMaxX + 1;
    let spanMaxX = rowMinX - 1;

    if (interiorInterval) {
      spanMinX = Math.max(
        rowMinX,
        Math.ceil(interiorInterval.lo - tile.x - 0.5)
      );
      spanMaxX = Math.min(
        rowMaxX,
        Math.floor(interiorInterval.hi - tile.x - 0.5)
      );
    }

    const leftEdgeMaxX = Math.min(spanMinX - 1, rowMaxX);

    for (let x = rowMinX; x <= leftEdgeMaxX; x += 1) {
      blendEdgePixel(x, y, rowOffset);
    }

    if (spanMinX <= spanMaxX) {
      // Subtract the skip capsule's interior span (computed with the same
      // formula the previous dab used to fill it) from this row's span.
      let skipMinX = spanMaxX + 1;
      let skipMaxX = spanMaxX;

      if (skipGeometry) {
        const skipInterval = getCapsuleRowInterval(skipGeometry, py, skipRadius);

        if (skipInterval) {
          skipMinX = Math.ceil(skipInterval.lo - tile.x - 0.5);
          skipMaxX = Math.floor(skipInterval.hi - tile.x - 0.5);

          if (skipMaxX < skipMinX - 1) {
            skipMaxX = skipMinX - 1;
          }
        }
      }

      fillSpan(rowOffset, spanMinX, Math.min(spanMaxX, skipMinX - 1));
      fillSpan(rowOffset, Math.max(spanMinX, skipMaxX + 1), spanMaxX);
    }

    const rightEdgeMinX = Math.max(spanMaxX + 1, spanMinX);

    for (let x = rightEdgeMinX; x <= rowMaxX; x += 1) {
      blendEdgePixel(x, y, rowOffset);
    }
  }
};
