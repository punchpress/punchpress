import { CSS_NAMED_COLORS } from "./css-named-colors";

export interface ParsedColor {
  // Opaque canonical `#rrggbb`; alpha travels separately as an opacity.
  color: string;
  opacity: number;
}

const CANONICAL_COLOR_REGEX = /^#[0-9a-f]{6}$/;
const HEX_COLOR_REGEX = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTION_COLOR_REGEX = /^(rgba?|hsla?)\(\s*([^)]*)\)$/i;
const COMMA_ARGS_REGEX = /^[^,/\s]+(\s*,\s*[^,/\s]+){2,3}$/;
const SPACE_ARGS_REGEX = /^[^,/\s]+(\s+[^,/\s]+){2}(\s*\/\s*[^,/\s]+)?$/;
const ARG_SPLIT_REGEX = /\s*[,/]\s*|\s+/;
const NUMBER_TOKEN_REGEX =
  /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?(%|deg|rad|grad|turn)?$/;

export const isCanonicalColor = (value: unknown): value is string => {
  return typeof value === "string" && CANONICAL_COLOR_REGEX.test(value);
};

// Parses CSS hex, rgb[a](), hsl[a](), and named colors. `none` and
// `transparent` are not colors: callers treat them as absent paint.
export const parseColor = (input: unknown): ParsedColor | null => {
  if (typeof input !== "string") {
    return null;
  }

  const value = input.trim().toLowerCase();

  if (!value || value === "none" || value === "transparent") {
    return null;
  }

  if (Object.hasOwn(CSS_NAMED_COLORS, value)) {
    return { color: CSS_NAMED_COLORS[value], opacity: 1 };
  }

  const hex = value.match(HEX_COLOR_REGEX);

  if (hex) {
    return parseHex(hex[1]);
  }

  const fn = value.match(FUNCTION_COLOR_REGEX);

  if (!fn) {
    return null;
  }

  const parts = splitArguments(fn[2].trim());

  if (!parts) {
    return null;
  }

  return fn[1].startsWith("rgb") ? parseRgb(parts) : parseHsl(parts);
};

export const formatColor = ({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}) => {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const toRgb = (color: string) => {
  return {
    b: Number.parseInt(color.slice(5, 7), 16),
    g: Number.parseInt(color.slice(3, 5), 16),
    r: Number.parseInt(color.slice(1, 3), 16),
  };
};

// Accepts `a, b, c[, d]` or `a b c[ / d]`, and only well-formed numeric
// tokens, so malformed input fails instead of prefix-parsing.
const splitArguments = (body: string) => {
  if (!(COMMA_ARGS_REGEX.test(body) || SPACE_ARGS_REGEX.test(body))) {
    return null;
  }

  const parts = body.split(ARG_SPLIT_REGEX);

  return parts.every((part) => NUMBER_TOKEN_REGEX.test(part)) ? parts : null;
};

const parseHex = (body: string): ParsedColor => {
  const expanded =
    body.length <= 4 ? [...body].map((char) => char + char).join("") : body;
  const alpha =
    expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;

  return {
    color: `#${expanded.slice(0, 6)}`,
    opacity: roundOpacity(alpha),
  };
};

const parseRgb = (parts: string[]): ParsedColor | null => {
  if (parts.length < 3 || parts.length > 4) {
    return null;
  }

  const channels = parts.slice(0, 3).map((part) => {
    return part.endsWith("%")
      ? (Number.parseFloat(part) / 100) * 255
      : Number.parseFloat(part);
  });
  const opacity = parseAlpha(parts[3]);

  if ([...channels, opacity].some((value) => !Number.isFinite(value))) {
    return null;
  }

  const [r, g, b] = channels;

  return { color: formatColor({ b, g, r }), opacity: roundOpacity(opacity) };
};

const parseHsl = (parts: string[]): ParsedColor | null => {
  if (parts.length < 3 || parts.length > 4) {
    return null;
  }

  const hue = parseHue(parts[0]);
  const saturation = Number.parseFloat(parts[1]) / 100;
  const lightness = Number.parseFloat(parts[2]) / 100;
  const opacity = parseAlpha(parts[3]);

  if (
    ![hue, saturation, lightness, opacity].every((value) =>
      Number.isFinite(value)
    )
  ) {
    return null;
  }

  return {
    color: formatColor(hslToRgb(hue, clamp01(saturation), clamp01(lightness))),
    opacity: roundOpacity(opacity),
  };
};

const HUE_UNIT_DEGREES: Record<string, number> = {
  deg: 1,
  grad: 0.9,
  rad: 180 / Math.PI,
  turn: 360,
};

const parseHue = (part: string) => {
  const unit = Object.keys(HUE_UNIT_DEGREES).find((key) => part.endsWith(key));

  return unit
    ? Number.parseFloat(part) * HUE_UNIT_DEGREES[unit]
    : Number.parseFloat(part);
};

const parseAlpha = (part: string | undefined) => {
  if (part === undefined) {
    return 1;
  }

  return part.endsWith("%")
    ? Number.parseFloat(part) / 100
    : Number.parseFloat(part);
};

const hslToRgb = (hue: number, saturation: number, lightness: number) => {
  const h = (((hue % 360) + 360) % 360) / 360;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const channel = (offset: number) => {
    const k = (offset + h * 12) % 12;

    return (
      (lightness - (chroma / 2) * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255
    );
  };

  return { b: channel(4), g: channel(8), r: channel(0) };
};

const toHex = (value: number) => {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, "0");
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

// Opacity is stored to 3 decimals so parse → format → parse is stable.
const roundOpacity = (value: number) =>
  Math.round(clamp01(value) * 1000) / 1000;
