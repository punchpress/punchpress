export const DEFAULT_BRUSH_SETTINGS = {
  color: "#111111",
  hardness: 1,
  opacity: 1,
  size: 24,
  spacing: 0,
};

const BRUSH_SIZE_RANGE = { max: 500, min: 1 };
const BRUSH_UNIT_RANGE = { max: 1, min: 0 };
const BRUSH_SPACING_RANGE = { max: 2, min: 0 };

const HEX_COLOR_REGEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGB_COLOR_REGEX = /^rgba?\(\s*([^)]+)\)$/i;

const clamp = (value, min, max) => {
  return Math.min(max, Math.max(min, value));
};

const roundSetting = (value, precision = 3) => {
  const multiplier = 10 ** precision;

  return Math.round(value * multiplier) / multiplier;
};

const expandShortHex = (hex) => {
  return hex
    .split("")
    .map((part) => `${part}${part}`)
    .join("");
};

const normalizeHexColor = (value) => {
  const match = value.trim().match(HEX_COLOR_REGEX);

  if (!match) {
    return null;
  }

  const hex = match[1].length === 3 ? expandShortHex(match[1]) : match[1];

  return `#${hex.toUpperCase()}`;
};

const parseRgbColor = (value) => {
  const match = value.trim().match(RGB_COLOR_REGEX);

  if (!match) {
    return null;
  }

  const parts = match[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map((part) => Number.parseFloat(part));

  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) {
    return null;
  }

  return {
    b: clamp(parts[2], 0, 255),
    g: clamp(parts[1], 0, 255),
    r: clamp(parts[0], 0, 255),
  };
};

export const getBrushColorRgb = (color) => {
  const normalizedHex = normalizeHexColor(color || "");

  if (normalizedHex) {
    const hex = normalizedHex.slice(1);

    return {
      b: Number.parseInt(hex.slice(4, 6), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      r: Number.parseInt(hex.slice(0, 2), 16),
    };
  }

  return parseRgbColor(color || "") || getBrushColorRgb(DEFAULT_BRUSH_SETTINGS.color);
};

const normalizeBrushColor = (color, fallback) => {
  if (typeof color !== "string") {
    return fallback;
  }

  const normalizedHex = normalizeHexColor(color);

  if (normalizedHex) {
    return normalizedHex;
  }

  return parseRgbColor(color) ? color : fallback;
};

const normalizeBrushNumber = (value, range, fallback) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return roundSetting(clamp(numberValue, range.min, range.max));
};

export const normalizeBrushSettings = (
  patch,
  baseSettings = DEFAULT_BRUSH_SETTINGS
) => {
  const nextSettings = { ...baseSettings };

  if (Object.hasOwn(patch, "color")) {
    nextSettings.color = normalizeBrushColor(patch.color, baseSettings.color);
  }

  if (Object.hasOwn(patch, "hardness")) {
    nextSettings.hardness = normalizeBrushNumber(
      patch.hardness,
      BRUSH_UNIT_RANGE,
      baseSettings.hardness
    );
  }

  if (Object.hasOwn(patch, "opacity")) {
    nextSettings.opacity = normalizeBrushNumber(
      patch.opacity,
      BRUSH_UNIT_RANGE,
      baseSettings.opacity
    );
  }

  if (Object.hasOwn(patch, "size")) {
    nextSettings.size = normalizeBrushNumber(
      patch.size,
      BRUSH_SIZE_RANGE,
      baseSettings.size
    );
  }

  if (Object.hasOwn(patch, "spacing")) {
    nextSettings.spacing = normalizeBrushNumber(
      patch.spacing,
      BRUSH_SPACING_RANGE,
      baseSettings.spacing
    );
  }

  return nextSettings;
};
