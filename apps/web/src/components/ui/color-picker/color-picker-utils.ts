export interface ColorPickerColor {
  alpha: number;
  hue: number;
  saturation: number;
  value: number;
}

export type ColorPickerMode = "css" | "hex" | "hsl" | "rgb";

interface RgbaColor {
  alpha: number;
  blue: number;
  green: number;
  red: number;
}

interface HslaColor {
  alpha: number;
  hue: number;
  lightness: number;
  saturation: number;
}

export const CHECKERBOARD_STYLE = {
  backgroundColor: "#ffffff",
  backgroundImage:
    "linear-gradient(45deg, rgb(24 24 27 / 0.08) 25%, transparent 25%), linear-gradient(-45deg, rgb(24 24 27 / 0.08) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgb(24 24 27 / 0.08) 75%), linear-gradient(-45deg, transparent 75%, rgb(24 24 27 / 0.08) 75%)",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
  backgroundSize: "12px 12px",
} as const;

export const DEFAULT_COLOR: ColorPickerColor = {
  alpha: 100,
  hue: 0,
  saturation: 0,
  value: 100,
};

const HEX_COLOR_REGEX = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const RGB_COLOR_REGEX = /^rgba?\((.+)\)$/i;
const HSL_COLOR_REGEX = /^hsla?\((.+)\)$/i;

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const normalizeHue = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return ((value % 360) + 360) % 360;
};

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const toHex = (value: number) => {
  return Math.round(value).toString(16).padStart(2, "0").toUpperCase();
};

const parseRgbChannel = (token: string) => {
  if (token.endsWith("%")) {
    const percentage = Number.parseFloat(token);

    if (!Number.isFinite(percentage)) {
      return null;
    }

    return clamp((percentage / 100) * 255, 0, 255);
  }

  const value = Number.parseFloat(token);
  return Number.isFinite(value) ? clamp(value, 0, 255) : null;
};

const parsePercent = (token: string) => {
  const value = Number.parseFloat(token);
  return Number.isFinite(value) ? clamp(value, 0, 100) : null;
};

const parseAlpha = (token: string) => {
  if (token.endsWith("%")) {
    return parsePercent(token);
  }

  const value = Number.parseFloat(token);
  return Number.isFinite(value) ? clamp(value * 100, 0, 100) : null;
};

const parseFunctionTokens = (value: string) => {
  return value
    .replace(/\s*\/\s*/g, ",")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
};

const hsvaToRgba = ({
  alpha,
  hue,
  saturation,
  value,
}: ColorPickerColor): RgbaColor => {
  const normalizedHue = normalizeHue(hue);
  const normalizedSaturation = clamp(saturation, 0, 100) / 100;
  const normalizedValue = clamp(value, 0, 100) / 100;
  const chroma = normalizedValue * normalizedSaturation;
  const segment = normalizedHue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = normalizedValue - chroma;

  let redPrime = 0;
  let greenPrime = 0;
  let bluePrime = 0;

  if (segment >= 0 && segment < 1) {
    redPrime = chroma;
    greenPrime = x;
  } else if (segment < 2) {
    redPrime = x;
    greenPrime = chroma;
  } else if (segment < 3) {
    greenPrime = chroma;
    bluePrime = x;
  } else if (segment < 4) {
    greenPrime = x;
    bluePrime = chroma;
  } else if (segment < 5) {
    redPrime = x;
    bluePrime = chroma;
  } else {
    redPrime = chroma;
    bluePrime = x;
  }

  return {
    alpha: clamp(alpha, 0, 100) / 100,
    blue: (bluePrime + match) * 255,
    green: (greenPrime + match) * 255,
    red: (redPrime + match) * 255,
  };
};

const rgbaToHsva = ({
  alpha,
  blue,
  green,
  red,
}: RgbaColor): ColorPickerColor => {
  const normalizedRed = clamp(red, 0, 255) / 255;
  const normalizedGreen = clamp(green, 0, 255) / 255;
  const normalizedBlue = clamp(blue, 0, 255) / 255;
  const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
  const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
  const delta = max - min;

  let hue = 0;

  if (delta !== 0) {
    if (max === normalizedRed) {
      hue = 60 * (((normalizedGreen - normalizedBlue) / delta) % 6);
    } else if (max === normalizedGreen) {
      hue = 60 * ((normalizedBlue - normalizedRed) / delta + 2);
    } else {
      hue = 60 * ((normalizedRed - normalizedGreen) / delta + 4);
    }
  }

  return clampColor({
    alpha: clamp(alpha, 0, 1) * 100,
    hue,
    saturation: max === 0 ? 0 : (delta / max) * 100,
    value: max * 100,
  });
};

const rgbaToHsla = ({ alpha, blue, green, red }: RgbaColor): HslaColor => {
  const normalizedRed = clamp(red, 0, 255) / 255;
  const normalizedGreen = clamp(green, 0, 255) / 255;
  const normalizedBlue = clamp(blue, 0, 255) / 255;
  const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
  const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));

    if (max === normalizedRed) {
      hue = 60 * (((normalizedGreen - normalizedBlue) / delta) % 6);
    } else if (max === normalizedGreen) {
      hue = 60 * ((normalizedBlue - normalizedRed) / delta + 2);
    } else {
      hue = 60 * ((normalizedRed - normalizedGreen) / delta + 4);
    }
  }

  return {
    alpha: clamp(alpha, 0, 1),
    hue: normalizeHue(hue),
    lightness: lightness * 100,
    saturation: Number.isFinite(saturation) ? saturation * 100 : 0,
  };
};

const hslaToRgba = ({
  alpha,
  hue,
  lightness,
  saturation,
}: HslaColor): RgbaColor => {
  const normalizedHue = normalizeHue(hue);
  const normalizedSaturation = clamp(saturation, 0, 100) / 100;
  const normalizedLightness = clamp(lightness, 0, 100) / 100;
  const chroma =
    (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const segment = normalizedHue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = normalizedLightness - chroma / 2;

  let redPrime = 0;
  let greenPrime = 0;
  let bluePrime = 0;

  if (segment >= 0 && segment < 1) {
    redPrime = chroma;
    greenPrime = x;
  } else if (segment < 2) {
    redPrime = x;
    greenPrime = chroma;
  } else if (segment < 3) {
    greenPrime = chroma;
    bluePrime = x;
  } else if (segment < 4) {
    greenPrime = x;
    bluePrime = chroma;
  } else if (segment < 5) {
    redPrime = x;
    bluePrime = chroma;
  } else {
    redPrime = chroma;
    bluePrime = x;
  }

  return {
    alpha: clamp(alpha, 0, 1),
    blue: (bluePrime + match) * 255,
    green: (greenPrime + match) * 255,
    red: (redPrime + match) * 255,
  };
};

const parseHexColor = (value: string) => {
  if (!HEX_COLOR_REGEX.test(value)) {
    return null;
  }

  const hex = value.slice(1);
  const chunkSize = hex.length <= 4 ? 1 : 2;
  const channels = hex.match(new RegExp(`.{${chunkSize}}`, "g"));

  if (!channels || channels.length < 3) {
    return null;
  }

  const [red, green, blue, alpha = chunkSize === 1 ? "f" : "ff"] = channels;
  const repeat = (token: string) =>
    chunkSize === 1 ? `${token}${token}` : token;

  return rgbaToHsva({
    alpha: Number.parseInt(repeat(alpha), 16) / 255,
    blue: Number.parseInt(repeat(blue), 16),
    green: Number.parseInt(repeat(green), 16),
    red: Number.parseInt(repeat(red), 16),
  });
};

const parseRgbColor = (value: string) => {
  const match = value.match(RGB_COLOR_REGEX);

  if (!match) {
    return null;
  }

  const [redToken, greenToken, blueToken, alphaToken] = parseFunctionTokens(
    match[1]
  );

  if (!(redToken && greenToken && blueToken)) {
    return null;
  }

  const red = parseRgbChannel(redToken);
  const green = parseRgbChannel(greenToken);
  const blue = parseRgbChannel(blueToken);
  const alpha = alphaToken ? parseAlpha(alphaToken) : 100;

  if ([red, green, blue, alpha].some((channel) => channel == null)) {
    return null;
  }

  return rgbaToHsva({
    alpha: alpha / 100,
    blue,
    green,
    red,
  });
};

const parseHslColor = (value: string) => {
  const match = value.match(HSL_COLOR_REGEX);

  if (!match) {
    return null;
  }

  const [hueToken, saturationToken, lightnessToken, alphaToken] =
    parseFunctionTokens(match[1]);

  if (!(hueToken && saturationToken && lightnessToken)) {
    return null;
  }

  const hue = Number.parseFloat(hueToken);
  const saturation = parsePercent(saturationToken);
  const lightness = parsePercent(lightnessToken);
  const alpha = alphaToken ? parseAlpha(alphaToken) : 100;

  if (
    !Number.isFinite(hue) ||
    saturation == null ||
    lightness == null ||
    alpha == null
  ) {
    return null;
  }

  return rgbaToHsva(
    hslaToRgba({
      alpha: alpha / 100,
      hue,
      lightness,
      saturation,
    })
  );
};

export const clampColor = (value: ColorPickerColor): ColorPickerColor => {
  return {
    alpha: round(clamp(value.alpha, 0, 100), 2),
    hue: round(normalizeHue(value.hue), 2),
    saturation: round(clamp(value.saturation, 0, 100), 2),
    value: round(clamp(value.value, 0, 100), 2),
  };
};

export const parseColor = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return (
    parseHexColor(normalized) ??
    parseRgbColor(normalized) ??
    parseHslColor(normalized)
  );
};

export const formatHexColor = (color: ColorPickerColor) => {
  const rgba = hsvaToRgba(clampColor(color));

  return `#${toHex(rgba.red)}${toHex(rgba.green)}${toHex(rgba.blue)}`;
};

export const formatRgbValues = (color: ColorPickerColor) => {
  const rgba = hsvaToRgba(clampColor(color));

  return [
    Math.round(rgba.red),
    Math.round(rgba.green),
    Math.round(rgba.blue),
  ] as const;
};

export const formatHslValues = (color: ColorPickerColor) => {
  const hsla = rgbaToHsla(hsvaToRgba(clampColor(color)));

  return [
    Math.round(hsla.hue),
    Math.round(hsla.saturation),
    Math.round(hsla.lightness),
  ] as const;
};

export const formatCssColor = (color: ColorPickerColor) => {
  const [red, green, blue] = formatRgbValues(color);
  const normalizedAlpha = round(clamp(color.alpha, 0, 100) / 100, 2);

  if (normalizedAlpha >= 1) {
    return `rgb(${red}, ${green}, ${blue})`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${normalizedAlpha})`;
};

export const formatStorageColor = (color: ColorPickerColor) => {
  const normalizedColor = clampColor(color);

  if (normalizedColor.alpha >= 100) {
    return formatHexColor(normalizedColor);
  }

  return formatCssColor(normalizedColor);
};

export const formatDisplayValue = (
  color: ColorPickerColor,
  mode: ColorPickerMode
) => {
  if (mode === "hex") {
    return {
      alpha: String(Math.round(color.alpha)),
      values: [formatHexColor(color)],
    };
  }

  if (mode === "rgb") {
    return {
      alpha: String(Math.round(color.alpha)),
      values: formatRgbValues(color).map((value) => String(value)),
    };
  }

  if (mode === "hsl") {
    return {
      alpha: String(Math.round(color.alpha)),
      values: formatHslValues(color).map((value) => String(value)),
    };
  }

  return {
    alpha: null,
    values: [formatCssColor(color)],
  };
};

export const getOpaqueColor = (color: ColorPickerColor) => {
  return formatCssColor({
    ...color,
    alpha: 100,
  });
};
