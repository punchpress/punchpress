import { getSampledBrushTipAsset, type RasterDab } from "@punchpress/engine";
import type { Canvas2dRasterCapabilities } from "./canvas2d-raster-capabilities";
import { requireCanvas2dContext } from "./canvas2d-raster-capabilities";

const GENERATED_TIP_SIZE = 64;
const HEX_COLOR_PATTERN = /^#([0-9a-f]{6})$/i;
const MAX_CACHED_TIPS = 64;
const RGB_COLOR_PATTERN = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i;

export interface Canvas2dBrushTipCache {
  get: (dab: Readonly<RasterDab>) => HTMLCanvasElement;
}

export const createCanvas2dBrushTipCache = (
  capabilities: Canvas2dRasterCapabilities
): Canvas2dBrushTipCache => {
  const tips = new Map<string, HTMLCanvasElement>();

  return {
    get: (dab) => {
      const key = getTipKey(dab);
      const cached = tips.get(key);

      if (cached) {
        tips.delete(key);
        tips.set(key, cached);
        return cached;
      }

      const tip =
        dab.tip.kind === "round"
          ? createGeneratedTip(dab, capabilities)
          : createSampledTip(dab, capabilities);

      tips.set(key, tip);
      if (tips.size > MAX_CACHED_TIPS) {
        const oldestKey = tips.keys().next().value;

        if (oldestKey) {
          tips.delete(oldestKey);
        }
      }

      return tip;
    },
  };
};

const getTipKey = (dab: Readonly<RasterDab>) =>
  dab.tip.kind === "round"
    ? `round:${dab.hardness}:${dab.color}`
    : `sampled:${dab.tip.sampleId}:${dab.color}`;

const createGeneratedTip = (
  dab: Readonly<RasterDab>,
  capabilities: Canvas2dRasterCapabilities
) => {
  const canvas = capabilities.createCanvas(
    GENERATED_TIP_SIZE,
    GENERATED_TIP_SIZE
  );
  const context = requireCanvas2dContext(canvas);
  const center = GENERATED_TIP_SIZE / 2;
  const radius = center;

  context.clearRect(0, 0, GENERATED_TIP_SIZE, GENERATED_TIP_SIZE);
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);

  if (dab.hardness >= 1) {
    context.fillStyle = dab.color;
  } else {
    const gradient = context.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      radius
    );
    const { b, g, r } = parseColor(dab.color);

    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
    if (dab.hardness > 0) {
      gradient.addColorStop(dab.hardness, `rgba(${r}, ${g}, ${b}, 1)`);
    }
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    context.fillStyle = gradient;
  }

  context.fill();
  return canvas;
};

const createSampledTip = (
  dab: Readonly<RasterDab>,
  capabilities: Canvas2dRasterCapabilities
) => {
  const sample = getSampledBrushTipAsset(dab.tip.sampleId);

  if (!sample) {
    throw new Error(`Unknown sampled Raster Brush tip: ${dab.tip.sampleId}`);
  }

  const canvas = capabilities.createCanvas(sample.width, sample.height);
  const context = requireCanvas2dContext(canvas);
  const { b, g, r } = parseColor(dab.color);

  context.clearRect(0, 0, sample.width, sample.height);
  for (let y = 0; y < sample.height; y += 1) {
    for (let x = 0; x < sample.width; x += 1) {
      const alpha = Number.parseInt(sample.alpha[y]?.[x] ?? "0", 16) / 15;

      if (alpha <= 0) {
        continue;
      }

      context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      context.fillRect(x, y, 1, 1);
    }
  }

  return canvas;
};

const parseColor = (color: string) => {
  const hex = color.match(HEX_COLOR_PATTERN)?.[1];

  if (hex) {
    return {
      b: Number.parseInt(hex.slice(4, 6), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      r: Number.parseInt(hex.slice(0, 2), 16),
    };
  }

  const rgb = color.match(RGB_COLOR_PATTERN);

  return rgb
    ? {
        b: Number(rgb[3]),
        g: Number(rgb[2]),
        r: Number(rgb[1]),
      }
    : { b: 17, g: 17, r: 17 };
};
