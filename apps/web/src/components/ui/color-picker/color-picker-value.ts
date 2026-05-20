interface RgbaColor {
  a: number;
  b: number;
  g: number;
  r: number;
}

const HEX_COLOR_REGEX = /^#?([0-9a-fA-F]{3,8})$/;
const HEX_BODY_REGEX = /^[0-9a-fA-F]{3,8}$/;
const FUNCTION_PARTS_REGEX = /[\s,/]+/;
const RGB_COLOR_REGEX = /^rgba?\(\s*([^)]+)\)$/i;
const HSL_COLOR_REGEX = /^hsla?\(\s*([^)]+)\)$/i;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clamp255 = (value: number) => Math.max(0, Math.min(255, value));
const normalizeHue = (value: number) => ((value % 360) + 360) % 360;

const expandShortHex = (hex: string) =>
  hex
    .split("")
    .map((character) => character + character)
    .join("");

const to2Hex = (value: number) =>
  Math.round(clamp255(value)).toString(16).padStart(2, "0").toUpperCase();

const hslToRgb = (h: number, s: number, l: number) => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = normalizeHue(h) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (hh < 1) {
    r = c;
    g = x;
  } else if (hh < 2) {
    r = x;
    g = c;
  } else if (hh < 3) {
    g = c;
    b = x;
  } else if (hh < 4) {
    g = x;
    b = c;
  } else if (hh < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const m = l - c / 2;
  return { b: (b + m) * 255, g: (g + m) * 255, r: (r + m) * 255 };
};

const parseHex = (input: string): RgbaColor | null => {
  const match = input.trim().match(HEX_COLOR_REGEX);
  if (!match) {
    return null;
  }

  let hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    hex = expandShortHex(hex);
  }

  if (hex.length === 6) {
    return {
      a: 1,
      b: Number.parseInt(hex.slice(4, 6), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      r: Number.parseInt(hex.slice(0, 2), 16),
    };
  }

  if (hex.length === 8) {
    return {
      a: Number.parseInt(hex.slice(6, 8), 16) / 255,
      b: Number.parseInt(hex.slice(4, 6), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      r: Number.parseInt(hex.slice(0, 2), 16),
    };
  }

  return null;
};

const parseFunctionParts = (input: string) =>
  input.split(FUNCTION_PARTS_REGEX).filter(Boolean);

const parseAlphaValue = (alpha: string | undefined) => {
  if (alpha === undefined) {
    return 1;
  }

  if (alpha.endsWith("%")) {
    return Number.parseFloat(alpha) / 100;
  }

  return Number.parseFloat(alpha);
};

const parseRgbColor = (value: string): RgbaColor | null => {
  const match = value.match(RGB_COLOR_REGEX);
  if (!match) {
    return null;
  }

  const [red, green, blue, alpha] = parseFunctionParts(match[1]);
  const r = Number.parseFloat(red);
  const g = Number.parseFloat(green);
  const b = Number.parseFloat(blue);
  const a = parseAlphaValue(alpha);

  return [r, g, b, a].some(Number.isNaN)
    ? null
    : { a: clamp01(a), b: clamp255(b), g: clamp255(g), r: clamp255(r) };
};

const parseHslColor = (value: string): RgbaColor | null => {
  const match = value.match(HSL_COLOR_REGEX);
  if (!match) {
    return null;
  }

  const [hue, saturation, lightness, alpha] = parseFunctionParts(match[1]);
  const h = Number.parseFloat(hue);
  const s = saturation?.endsWith("%")
    ? Number.parseFloat(saturation) / 100
    : Number.parseFloat(saturation);
  const l = lightness?.endsWith("%")
    ? Number.parseFloat(lightness) / 100
    : Number.parseFloat(lightness);
  const a = parseAlphaValue(alpha);

  if ([h, s, l, a].some(Number.isNaN)) {
    return null;
  }

  return { ...hslToRgb(h, clamp01(s), clamp01(l)), a: clamp01(a) };
};

const parseColorValue = (input: string | null | undefined) => {
  const value = input?.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("#") || HEX_BODY_REGEX.test(value)) {
    return parseHex(value);
  }

  return parseRgbColor(value) ?? parseHslColor(value);
};

const formatStorageValue = (color: RgbaColor) => {
  const r = Math.round(color.r);
  const g = Math.round(color.g);
  const b = Math.round(color.b);
  const alpha = Number(clamp01(color.a).toFixed(3));

  if (alpha >= 1) {
    return `#${to2Hex(r)}${to2Hex(g)}${to2Hex(b)}`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export { formatStorageValue, parseColorValue };
