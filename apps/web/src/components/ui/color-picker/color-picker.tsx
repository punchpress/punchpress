"use client";

// Adapted from Fluid Functionalism Color Picker:
// https://www.fluidfunctionalism.com/docs/color-picker

import { HashIcon, PipetteIcon } from "lucide-react";
import {
  type ChangeEvent,
  type CSSProperties,
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ColorFormat = "hex" | "rgb" | "hsl" | "oklch";
type ColorChannelKey =
  | "C"
  | "H"
  | "L"
  | "alpha"
  | "b"
  | "g"
  | "h"
  | "hex"
  | "l"
  | "r"
  | "s";

interface ParsedColor {
  a: number;
  b: number;
  g: number;
  h: number;
  hex: string;
  hsl: string;
  oklch: string;
  r: number;
  rgb: string;
  s: number;
  v: number;
}

interface ColorPickerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  defaultFormat?: ColorFormat;
  defaultValue?: string;
  format?: ColorFormat;
  hideEyedropper?: boolean;
  onFormatChange?: (format: ColorFormat) => void;
  onValueChange?: (value: string, parsed: ParsedColor) => void;
  swatches?: string[];
  value?: string | null;
}

interface ColorInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  align?: "center" | "left";
  label: string;
  max?: number;
  min?: number;
  onCommit: (value: string) => void;
  prefix?: ReactNode;
  value: string;
}

const PANEL_WIDTH = 288;
const SQUARE_HEIGHT = 156;
const FORMAT_LABELS: Record<ColorFormat, string> = {
  hex: "HEX",
  hsl: "HSL",
  oklch: "OKLCH",
  rgb: "RGB",
};

const FORMATS = Object.keys(FORMAT_LABELS) as ColorFormat[];
const HEX_COLOR_REGEX = /^#?([0-9a-fA-F]{3,8})$/;
const HEX_BODY_REGEX = /^[0-9a-fA-F]{3,8}$/;
const FUNCTION_PARTS_REGEX = /[\s,/]+/;
const RGB_COLOR_REGEX = /^rgba?\(\s*([^)]+)\)$/i;
const HSL_COLOR_REGEX = /^hsla?\(\s*([^)]+)\)$/i;
const OKLCH_COLOR_REGEX = /^oklch\(\s*([^)]+)\)$/i;
const HASH_PREFIX_REGEX = /^#/;

const CHECKER_BG: CSSProperties = {
  backgroundColor: "var(--color-white)",
  backgroundImage:
    "conic-gradient(var(--color-neutral-200) 0 25%, var(--color-white) 0 50%, var(--color-neutral-200) 0 75%, var(--color-white) 0)",
  backgroundSize: "8px 8px",
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clamp255 = (value: number) => Math.max(0, Math.min(255, value));

const normalizeHue = (value: number) => ((value % 360) + 360) % 360;

const hsvToRgb = (h: number, s: number, v: number) => {
  const c = v * s;
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

  const m = v - c;
  return { b: (b + m) * 255, g: (g + m) * 255, r: (r + m) * 255 };
};

const rgbToHsv = (r: number, g: number, b: number) => {
  const red = clamp255(r) / 255;
  const green = clamp255(g) / 255;
  const blue = clamp255(b) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;

  if (delta > 0) {
    if (max === red) {
      h = ((green - blue) / delta) % 6;
    } else if (max === green) {
      h = (blue - red) / delta + 2;
    } else {
      h = (red - green) / delta + 4;
    }
    h *= 60;
  }

  return {
    h: normalizeHue(h),
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
};

const rgbToHsl = (r: number, g: number, b: number) => {
  const red = clamp255(r) / 255;
  const green = clamp255(g) / 255;
  const blue = clamp255(b) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (delta > 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) {
      h = ((green - blue) / delta) % 6;
    } else if (max === green) {
      h = (blue - red) / delta + 2;
    } else {
      h = (red - green) / delta + 4;
    }
    h *= 60;
  }

  return { h: normalizeHue(h), l, s };
};

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

const srgbToLinear = (value: number) => {
  const channel = clamp255(value) / 255;
  return channel <= 0.040_45
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (value: number) => {
  const channel =
    value <= 0.003_130_8 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
  return clamp01(channel) * 255;
};

const linearRgbToOklab = (r: number, g: number, b: number) => {
  const l = 0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b;
  const m = 0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b;
  const s = 0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return {
    L:
      0.210_454_255_3 * lRoot + 0.793_617_785 * mRoot - 0.004_072_046_8 * sRoot,
    a:
      1.977_998_495_1 * lRoot - 2.428_592_205 * mRoot + 0.450_593_709_9 * sRoot,
    b:
      0.025_904_037_1 * lRoot + 0.782_771_766_2 * mRoot - 0.808_675_766 * sRoot,
  };
};

const oklabToLinearRgb = (L: number, a: number, b: number) => {
  const lRoot = L + 0.396_337_777_4 * a + 0.215_803_757_3 * b;
  const mRoot = L - 0.105_561_345_8 * a - 0.063_854_172_8 * b;
  const sRoot = L - 0.089_484_177_5 * a - 1.291_485_548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;

  return {
    b: -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
    g: -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
    r: 4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
  };
};

const rgbToOklch = (r: number, g: number, b: number) => {
  const lab = linearRgbToOklab(
    srgbToLinear(r),
    srgbToLinear(g),
    srgbToLinear(b)
  );
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let H = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (H < 0) {
    H += 360;
  }
  return { C, H, L: lab.L };
};

const oklchToRgb = (L: number, C: number, H: number) => {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const rgb = oklabToLinearRgb(L, a, b);

  return {
    b: clamp255(linearToSrgb(rgb.b)),
    g: clamp255(linearToSrgb(rgb.g)),
    r: clamp255(linearToSrgb(rgb.r)),
  };
};

const to2Hex = (value: number) =>
  Math.round(clamp255(value)).toString(16).padStart(2, "0");

const rgbToHexStr = (r: number, g: number, b: number, a: number) => {
  const base = `#${to2Hex(r)}${to2Hex(g)}${to2Hex(b)}`;
  return a >= 1 ? base : `${base}${to2Hex(a * 255)}`;
};

const expandShortHex = (hex: string) =>
  hex
    .split("")
    .map((character) => character + character)
    .join("");

const parseHex = (input: string) => {
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

const parseRgbColor = (value: string) => {
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

const parseHslColor = (value: string) => {
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

const parseOklchColor = (value: string) => {
  const match = value.match(OKLCH_COLOR_REGEX);
  if (!match) {
    return null;
  }

  const [lightness, chroma, hue, alpha] = parseFunctionParts(match[1]);
  const L = lightness?.endsWith("%")
    ? Number.parseFloat(lightness) / 100
    : Number.parseFloat(lightness);
  const C = Number.parseFloat(chroma);
  const H = Number.parseFloat(hue);
  const a = parseAlphaValue(alpha);

  if ([L, C, H, a].some(Number.isNaN)) {
    return null;
  }

  return {
    ...oklchToRgb(clamp01(L), Math.max(0, C), H),
    a: clamp01(a),
  };
};

const parseColor = (input: string | null | undefined) => {
  const value = input?.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("#") || HEX_BODY_REGEX.test(value)) {
    return parseHex(value);
  }

  return parseRgbColor(value) ?? parseHslColor(value) ?? parseOklchColor(value);
};

const buildParsed = (
  h: number,
  s: number,
  v: number,
  a: number
): ParsedColor => {
  const { r, g, b } = hsvToRgb(h, s, v);
  const hsl = rgbToHsl(r, g, b);
  const oklch = rgbToOklch(r, g, b);
  const hex = rgbToHexStr(r, g, b, a);
  const alpha = Number(a.toFixed(3));

  return {
    a,
    b: Math.round(b),
    g: Math.round(g),
    h,
    hex,
    hsl:
      a >= 1
        ? `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`
        : `hsla(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%, ${alpha})`,
    oklch:
      a >= 1
        ? `oklch(${(oklch.L * 100).toFixed(1)}% ${oklch.C.toFixed(3)} ${oklch.H.toFixed(1)})`
        : `oklch(${(oklch.L * 100).toFixed(1)}% ${oklch.C.toFixed(3)} ${oklch.H.toFixed(1)} / ${alpha})`,
    r: Math.round(r),
    rgb:
      a >= 1
        ? `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
        : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`,
    s,
    v,
  };
};

const formatValueByFormat = (parsed: ParsedColor, format: ColorFormat) => {
  switch (format) {
    case "hex":
      return parsed.hex;
    case "rgb":
      return parsed.rgb;
    case "hsl":
      return parsed.hsl;
    case "oklch":
      return parsed.oklch;
    default:
      return parsed.hex;
  }
};

const parsedToHsv = (value: string | null | undefined, fallback: string) => {
  const parsed = parseColor(value) ??
    parseColor(fallback) ?? {
      a: 1,
      b: 255,
      g: 255,
      r: 255,
    };
  const hsv = rgbToHsv(parsed.r, parsed.g, parsed.b);

  return {
    a: parsed.a,
    h: hsv.s === 0 ? 0 : hsv.h,
    s: hsv.s,
    v: hsv.v,
  };
};

function SaturationSquare({
  h,
  onChange,
  s,
  v,
}: {
  h: number;
  onChange: (s: number, v: number) => void;
  s: number;
  v: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      onChange(
        clamp01((clientX - rect.left) / rect.width),
        1 - clamp01((clientY - rect.top) / rect.height)
      );
    },
    [onChange]
  );

  const { r, g, b } = hsvToRgb(h, s, v);

  return (
    <div
      aria-label="Saturation and brightness"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(s * 100)}
      aria-valuetext={`${Math.round(s * 100)}% saturation, ${Math.round(v * 100)}% brightness`}
      className="relative w-full touch-none select-none rounded-lg outline-none"
      data-slot="color-picker-selection"
      onBlur={() => setFocused(false)}
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) {
          setFocused(true);
        }
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 0.1 : 0.01;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onChange(clamp01(s - step), v);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          onChange(clamp01(s + step), v);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          onChange(s, clamp01(v + step));
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          onChange(s, clamp01(v - step));
        }
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPointer(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.buttons !== 1) {
          return;
        }
        updateFromPointer(event.clientX, event.clientY);
      }}
      ref={ref}
      role="slider"
      style={{
        background: `linear-gradient(to top, var(--color-black), transparent), linear-gradient(to right, var(--color-white), hsl(${h}, 100%, 50%))`,
        boxShadow: focused ? "0 0 0 2px var(--ring)" : undefined,
        height: SQUARE_HEIGHT,
      }}
      tabIndex={0}
    >
      <div
        className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-[0_0_0_1px_rgb(0_0_0_/_0.45)]"
        style={{
          backgroundColor: `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`,
          left: `${s * 100}%`,
          top: `${(1 - v) * 100}%`,
        }}
      />
    </div>
  );
}

function HueSlider({
  h,
  onChange,
}: {
  h: number;
  onChange: (h: number) => void;
}) {
  return (
    <Slider
      aria-label="Color picker slider"
      className="[&_[data-slot=slider-track]]:border-transparent"
      data-slider-label="Hue"
      hideFill
      max={360}
      onChange={(value) => onChange(Array.isArray(value) ? value[0] : value)}
      showValue={false}
      thumbBorderColor="var(--color-white)"
      thumbColor={`hsl(${h}, 100%, 50%)`}
      trackStyle={{
        background:
          "linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))",
      }}
      value={Math.round(h)}
    />
  );
}

function AlphaSlider({
  a,
  onChange,
  solidColor,
}: {
  a: number;
  onChange: (a: number) => void;
  solidColor: string;
}) {
  const transparentColor = solidColor
    .replace("rgb(", "rgba(")
    .replace(")", ", 0)");

  return (
    <Slider
      aria-label="Color picker slider"
      className="[&_[data-slot=slider-track]]:border-transparent"
      data-slider-label="Alpha"
      hideFill
      max={100}
      onChange={(value) =>
        onChange((Array.isArray(value) ? value[0] : value) / 100)
      }
      showValue={false}
      thumbBorderColor="var(--color-white)"
      thumbColor={solidColor}
      trackStyle={{
        backgroundClip: "padding-box, padding-box",
        backgroundImage: `linear-gradient(to right, ${transparentColor}, ${solidColor}), ${CHECKER_BG.backgroundImage}`,
        backgroundOrigin: "padding-box, padding-box",
        backgroundRepeat: "no-repeat, repeat",
        backgroundSize: `100% 100%, ${CHECKER_BG.backgroundSize}`,
      }}
      value={Math.round(a * 100)}
    />
  );
}

const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(
  (
    {
      align = "left",
      className,
      label,
      max,
      min,
      onCommit,
      prefix,
      value,
      ...props
    },
    ref
  ) => {
    const [draft, setDraft] = useState(value);

    useEffect(() => {
      setDraft(value);
    }, [value]);

    const commit = () => {
      let nextValue = draft;
      const numeric = Number.parseFloat(draft.replace("%", ""));
      if (!Number.isNaN(numeric) && (min !== undefined || max !== undefined)) {
        const nextNumber = Math.min(
          max ?? Number.POSITIVE_INFINITY,
          Math.max(min ?? Number.NEGATIVE_INFINITY, numeric)
        );
        nextValue = draft.endsWith("%")
          ? `${Math.round(nextNumber)}%`
          : String(nextNumber);
        setDraft(nextValue);
      }
      onCommit(nextValue);
    };

    const inputProps = {
      "aria-label": label,
      onBlur: commit,
      onChange: (event: ChangeEvent<HTMLInputElement>) =>
        setDraft(event.currentTarget.value),
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      },
      value: draft,
      ...props,
    };

    return (
      <div className={cn("relative min-w-0 flex-1", className)}>
        <span className="sr-only">{label}</span>
        <Input
          className={cn(
            "bg-secondary tabular-nums shadow-none",
            align === "center" && "text-center"
          )}
          leading={prefix}
          nativeInput
          ref={ref}
          {...inputProps}
        />
      </div>
    );
  }
);

ColorInput.displayName = "ColorInput";

function ChannelTooltip({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<div />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function AlphaInput({
  onCommit,
  value,
}: {
  onCommit: (value: number) => void;
  value: number;
}) {
  return (
    <ChannelTooltip label="Alpha">
      <ColorInput
        align="center"
        inputMode="numeric"
        label="Alpha"
        max={100}
        min={0}
        onCommit={(input) => {
          const nextValue = Number.parseFloat(input.replace("%", ""));
          if (Number.isFinite(nextValue)) {
            onCommit(Math.round(nextValue));
          }
        }}
        value={`${value}%`}
      />
    </ChannelTooltip>
  );
}

function ColorInputsRow({
  format,
  oklchHue,
  onChannelChange,
  parsed,
}: {
  format: ColorFormat;
  oklchHue?: number | null;
  onChannelChange: (key: ColorChannelKey, value: string) => void;
  parsed: ParsedColor;
}) {
  const alpha = Math.round(parsed.a * 100);

  if (format === "hex") {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-2">
        <ChannelTooltip label="Hex">
          <ColorInput
            label="Hex"
            onCommit={(next) =>
              onChannelChange("hex", next.startsWith("#") ? next : `#${next}`)
            }
            prefix={<HashIcon size={14} strokeWidth={1.9} />}
            value={parsed.hex.replace(HASH_PREFIX_REGEX, "").toUpperCase()}
          />
        </ChannelTooltip>
        <AlphaInput
          onCommit={(next) => onChannelChange("alpha", String(next))}
          value={alpha}
        />
      </div>
    );
  }

  if (format === "rgb") {
    return (
      <div className="grid grid-cols-4 gap-1">
        <ChannelTooltip label="Red">
          <ColorInput
            align="center"
            inputMode="numeric"
            label="Red"
            max={255}
            min={0}
            onCommit={(value) => onChannelChange("r", value)}
            value={String(parsed.r)}
          />
        </ChannelTooltip>
        <ChannelTooltip label="Green">
          <ColorInput
            align="center"
            inputMode="numeric"
            label="Green"
            max={255}
            min={0}
            onCommit={(value) => onChannelChange("g", value)}
            value={String(parsed.g)}
          />
        </ChannelTooltip>
        <ChannelTooltip label="Blue">
          <ColorInput
            align="center"
            inputMode="numeric"
            label="Blue"
            max={255}
            min={0}
            onCommit={(value) => onChannelChange("b", value)}
            value={String(parsed.b)}
          />
        </ChannelTooltip>
        <AlphaInput
          onCommit={(next) => onChannelChange("alpha", String(next))}
          value={alpha}
        />
      </div>
    );
  }

  if (format === "hsl") {
    const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);

    return (
      <div className="grid grid-cols-4 gap-1">
        <ChannelTooltip label="Hue">
          <ColorInput
            align="center"
            inputMode="numeric"
            label="Hue"
            max={360}
            min={0}
            onCommit={(value) => onChannelChange("h", value)}
            value={String(Math.round(hsl.h))}
          />
        </ChannelTooltip>
        <ChannelTooltip label="Saturation">
          <ColorInput
            align="center"
            inputMode="numeric"
            label="Saturation"
            max={100}
            min={0}
            onCommit={(value) => onChannelChange("s", value)}
            value={String(Math.round(hsl.s * 100))}
          />
        </ChannelTooltip>
        <ChannelTooltip label="Lightness">
          <ColorInput
            align="center"
            inputMode="numeric"
            label="Lightness"
            max={100}
            min={0}
            onCommit={(value) => onChannelChange("l", value)}
            value={String(Math.round(hsl.l * 100))}
          />
        </ChannelTooltip>
        <AlphaInput
          onCommit={(next) => onChannelChange("alpha", String(next))}
          value={alpha}
        />
      </div>
    );
  }

  const oklch = rgbToOklch(parsed.r, parsed.g, parsed.b);

  return (
    <div className="grid grid-cols-4 gap-1">
      <ChannelTooltip label="Lightness">
        <ColorInput
          align="center"
          inputMode="numeric"
          label="Lightness"
          max={100}
          min={0}
          onCommit={(value) => onChannelChange("L", value)}
          value={String(Math.round(oklch.L * 100))}
        />
      </ChannelTooltip>
      <ChannelTooltip label="Chroma">
        <ColorInput
          align="center"
          inputMode="decimal"
          label="Chroma"
          max={0.4}
          min={0}
          onCommit={(value) => onChannelChange("C", value)}
          value={oklch.C.toFixed(2)}
        />
      </ChannelTooltip>
      <ChannelTooltip label="Hue">
        <ColorInput
          align="center"
          inputMode="numeric"
          label="Hue"
          max={360}
          min={0}
          onCommit={(value) => onChannelChange("H", value)}
          value={String(Math.round(oklchHue ?? oklch.H))}
        />
      </ChannelTooltip>
      <AlphaInput
        onCommit={(next) => onChannelChange("alpha", String(next))}
        value={alpha}
      />
    </div>
  );
}

function FormatSelect({
  onChange,
  value,
}: {
  onChange: (value: ColorFormat) => void;
  value: ColorFormat;
}) {
  const selectedLabel = FORMAT_LABELS[value];

  return (
    <Select
      onValueChange={(next) => onChange(next as ColorFormat)}
      value={value}
    >
      <SelectTrigger className="w-24 min-w-0">
        <SelectValue>{() => selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {FORMATS.map((format) => (
          <SelectItem key={format} value={format}>
            {FORMAT_LABELS[format]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface EyeDropperGlobal {
  open(): Promise<{ sRGBHex: string }>;
}

function EyeDropperButton({ onPick }: { onPick: (hex: string) => void }) {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "EyeDropper" in window);
  }, []);

  if (!supported) {
    return null;
  }

  return (
    <button
      aria-label="Pick color from screen"
      className={cn(
        buttonVariants({ size: "icon", variant: "ghost" }),
        "size-10 rounded-xl text-muted-foreground"
      )}
      onClick={async () => {
        try {
          const EyeDropper = (
            window as unknown as { EyeDropper: new () => EyeDropperGlobal }
          ).EyeDropper;
          const result = await new EyeDropper().open();
          onPick(result.sRGBHex);
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.warn("EyeDropper failed to open.", error);
          }
        }
      }}
      type="button"
    >
      <PipetteIcon aria-hidden="true" className="size-4" />
    </button>
  );
}

function ColorTile({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-md"
      style={{
        ...CHECKER_BG,
        height: size,
        width: size,
      }}
    >
      <span className="absolute inset-0" style={{ backgroundColor: color }} />
    </span>
  );
}

function SwatchStrip({
  current,
  onPick,
  swatches,
}: {
  current: string;
  onPick: (color: string) => void;
  swatches: string[];
}) {
  const normalizedCurrent = current.toLowerCase();

  return (
    <div className="flex flex-wrap gap-2">
      {swatches.map((color) => {
        const normalized = parseColor(color);
        const swatchValue = normalized
          ? rgbToHexStr(normalized.r, normalized.g, normalized.b, normalized.a)
          : color;
        const selected = swatchValue.toLowerCase() === normalizedCurrent;

        return (
          <button
            aria-label={`Select color ${color}`}
            className={cn(
              "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected && "ring-2 ring-ring ring-offset-2 ring-offset-popover"
            )}
            key={color}
            onClick={() => onPick(color)}
            type="button"
          >
            <ColorTile color={color} size={24} />
          </button>
        );
      })}
    </div>
  );
}

const RGB_CHANNELS = new Set<ColorChannelKey>(["b", "g", "r"]);
const HSL_CHANNELS = new Set<ColorChannelKey>(["h", "l", "s"]);

const getRgbChannelColor = (
  channel: ColorChannelKey,
  value: string,
  parsed: ParsedColor
) => ({
  a: parsed.a,
  b: channel === "b" ? Number(value) : parsed.b,
  g: channel === "g" ? Number(value) : parsed.g,
  r: channel === "r" ? Number(value) : parsed.r,
});

const getHslChannelColor = (
  channel: ColorChannelKey,
  value: string,
  parsed: ParsedColor
) => {
  const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);

  return {
    ...hslToRgb(
      channel === "h" ? Number(value) : hsl.h,
      channel === "s" ? Number(value) / 100 : hsl.s,
      channel === "l" ? Number(value) / 100 : hsl.l
    ),
    a: parsed.a,
  };
};

const getOklchChannelColor = (
  channel: ColorChannelKey,
  value: string,
  parsed: ParsedColor,
  oklchHueRef: MutableRefObject<number | null>
) => {
  const currentOklch = rgbToOklch(parsed.r, parsed.g, parsed.b);
  const baseHue = oklchHueRef.current ?? currentOklch.H;
  const L = channel === "L" ? Number(value) / 100 : currentOklch.L;
  const C = channel === "C" ? Number(value) : currentOklch.C;
  const H = channel === "H" ? Number(value) : baseHue;

  oklchHueRef.current = H;
  return { ...oklchToRgb(L, C, H), a: parsed.a };
};

const ColorPicker = forwardRef<HTMLDivElement, ColorPickerProps>(
  (
    {
      className,
      defaultFormat = "hex",
      defaultValue = "#ffffff",
      format,
      hideEyedropper = false,
      onFormatChange,
      onValueChange,
      swatches,
      value,
      ...props
    },
    ref
  ) => {
    const isFormatControlled = format !== undefined;
    const isValueControlled = value !== undefined;
    const [internalFormat, setInternalFormat] = useState(defaultFormat);
    const [internalValue, setInternalValue] = useState(defaultValue);
    const currentFormat = isFormatControlled ? format : internalFormat;
    const currentValue = isValueControlled ? value : internalValue;
    const [hsv, setHsv] = useState(() =>
      parsedToHsv(currentValue, defaultValue)
    );
    const oklchHueRef = useRef<number | null>(null);

    useEffect(() => {
      if (isValueControlled) {
        setHsv(parsedToHsv(currentValue, defaultValue));
      }
    }, [currentValue, defaultValue, isValueControlled]);

    const parsed = useMemo(
      () => buildParsed(hsv.h, hsv.s, hsv.v, hsv.a),
      [hsv.a, hsv.h, hsv.s, hsv.v]
    );

    const emit = useCallback(
      (nextHsv: typeof hsv, nextFormat = currentFormat) => {
        const nextParsed = buildParsed(
          nextHsv.h,
          nextHsv.s,
          nextHsv.v,
          nextHsv.a
        );
        const formatted = formatValueByFormat(nextParsed, nextFormat);

        if (!isValueControlled) {
          setInternalValue(formatted);
        }

        onValueChange?.(formatted, nextParsed);
      },
      [currentFormat, isValueControlled, onValueChange]
    );

    const updateHsv = useCallback(
      (changes: Partial<typeof hsv>) => {
        setHsv((previous) => {
          const next = {
            a: clamp01(changes.a ?? previous.a),
            h: normalizeHue(changes.h ?? previous.h),
            s: clamp01(changes.s ?? previous.s),
            v: clamp01(changes.v ?? previous.v),
          };
          emit(next);
          return next;
        });
      },
      [emit]
    );

    const handleParsedColor = useCallback(
      (nextColor: { a: number; b: number; g: number; r: number }) => {
        const nextHsv = rgbToHsv(nextColor.r, nextColor.g, nextColor.b);
        const next = {
          a: clamp01(nextColor.a),
          h: nextHsv.s === 0 ? hsv.h : nextHsv.h,
          s: nextHsv.s,
          v: nextHsv.v,
        };

        setHsv(next);
        emit(next);
      },
      [emit, hsv.h]
    );

    const handleStringCommit = useCallback(
      (input: string) => {
        const nextColor = parseColor(input);
        if (nextColor) {
          oklchHueRef.current = null;
          handleParsedColor(nextColor);
        }
      },
      [handleParsedColor]
    );

    const handleFormatChange = useCallback(
      (nextFormat: ColorFormat) => {
        if (!isFormatControlled) {
          setInternalFormat(nextFormat);
        }
        onFormatChange?.(nextFormat);
        emit(hsv, nextFormat);
      },
      [emit, hsv, isFormatControlled, onFormatChange]
    );

    const handleChannelChange = useCallback(
      (channel: ColorChannelKey, nextValue: string) => {
        if (channel === "hex") {
          handleStringCommit(nextValue);
          return;
        }

        if (channel === "alpha") {
          updateHsv({ a: clamp01(Number(nextValue) / 100) });
          return;
        }

        if (RGB_CHANNELS.has(channel)) {
          handleParsedColor(getRgbChannelColor(channel, nextValue, parsed));
          return;
        }

        if (HSL_CHANNELS.has(channel)) {
          handleParsedColor(getHslChannelColor(channel, nextValue, parsed));
          return;
        }

        handleParsedColor(
          getOklchChannelColor(channel, nextValue, parsed, oklchHueRef)
        );
      },
      [handleParsedColor, handleStringCommit, parsed, updateHsv]
    );

    const solid = hsvToRgb(hsv.h, hsv.s, hsv.v);
    const solidColor = `rgb(${Math.round(solid.r)}, ${Math.round(solid.g)}, ${Math.round(solid.b)})`;

    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg/5",
          className
        )}
        data-slot="color-picker"
        ref={ref}
        style={{ width: PANEL_WIDTH }}
        {...props}
      >
        <SaturationSquare
          h={hsv.h}
          onChange={(s, v) => updateHsv({ s, v })}
          s={hsv.s}
          v={hsv.v}
        />

        <div className="grid gap-2">
          <HueSlider h={hsv.h} onChange={(h) => updateHsv({ h })} />
          <AlphaSlider
            a={hsv.a}
            onChange={(a) => updateHsv({ a })}
            solidColor={solidColor}
          />
        </div>

        <div className="flex items-center justify-start gap-2">
          <div className="flex items-center gap-2">
            <FormatSelect onChange={handleFormatChange} value={currentFormat} />
            {hideEyedropper ? null : (
              <EyeDropperButton onPick={handleStringCommit} />
            )}
          </div>
        </div>

        <ColorInputsRow
          format={currentFormat}
          oklchHue={oklchHueRef.current}
          onChannelChange={handleChannelChange}
          parsed={parsed}
        />

        {swatches?.length ? (
          <SwatchStrip
            current={parsed.hex}
            onPick={handleStringCommit}
            swatches={swatches}
          />
        ) : null}
      </div>
    );
  }
);

ColorPicker.displayName = "ColorPicker";

export {
  ColorPicker,
  type ColorFormat,
  type ColorPickerProps,
  type ParsedColor,
};
