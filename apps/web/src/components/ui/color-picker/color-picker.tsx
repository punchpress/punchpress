"use client";

// Adapted from the Kibo UI color picker:
// https://www.kibo-ui.com/components/color-picker

import { Slider as BaseSlider } from "@base-ui/react/slider";
import { PipetteIcon } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  memo,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CHECKERBOARD_STYLE,
  type ColorPickerColor,
  type ColorPickerMode,
  clampColor,
  DEFAULT_COLOR,
  formatDisplayValue,
  getOpaqueColor,
  parseColor,
} from "./color-picker-utils";

interface ColorPickerContextValue {
  color: ColorPickerColor;
  mode: ColorPickerMode;
  setMode: (mode: ColorPickerMode) => void;
  updateColor: (changes: Partial<ColorPickerColor>) => void;
}

interface ColorPickerProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  onValueChange?: (value: ColorPickerColor) => void;
  value?: string | null;
}

interface ColorPickerSliderProps {
  children?: ReactNode;
  className?: string;
  max: number;
  min: number;
  onValueChange: (value: number) => void;
  value: number;
}

type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>;
};

declare global {
  interface Window {
    EyeDropper?: EyeDropperConstructor;
  }
}

const ColorPickerContext = createContext<ColorPickerContextValue | null>(null);
const OUTPUT_MODES: ColorPickerMode[] = ["hex", "rgb", "css", "hsl"];

const useColorPicker = () => {
  const context = useContext(ColorPickerContext);

  if (!context) {
    throw new Error(
      "Color picker components must be rendered inside ColorPicker."
    );
  }

  return context;
};

const useResolvedColor = (value?: string | null, defaultValue?: string) => {
  return useMemo(() => {
    return parseColor(value) ?? parseColor(defaultValue) ?? DEFAULT_COLOR;
  }, [defaultValue, value]);
};

const ColorPicker = ({
  children,
  className,
  defaultValue = "#FFFFFF",
  onValueChange,
  value,
  ...props
}: ColorPickerProps) => {
  const resolvedValue = useResolvedColor(value, defaultValue);
  const [color, setColor] = useState(resolvedValue);
  const [mode, setMode] = useState<ColorPickerMode>("hex");

  useEffect(() => {
    setColor(resolvedValue);
  }, [resolvedValue]);

  const updateColor = useCallback(
    (changes: Partial<ColorPickerColor>) => {
      setColor((currentColor) => {
        const nextColor = clampColor({
          ...currentColor,
          ...changes,
        });

        onValueChange?.(nextColor);
        return nextColor;
      });
    },
    [onValueChange]
  );

  return (
    <ColorPickerContext.Provider
      value={{
        color,
        mode,
        setMode,
        updateColor,
      }}
    >
      <div
        className={cn("flex w-full flex-col gap-3", className)}
        data-slot="color-picker"
        {...props}
      >
        {children}
      </div>
    </ColorPickerContext.Provider>
  );
};

const ColorPickerSelection = memo(
  ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { color, updateColor } = useColorPicker();

    const handlePointerUpdate = useCallback(
      (clientX: number, clientY: number) => {
        if (!containerRef.current) {
          return;
        }

        const bounds = containerRef.current.getBoundingClientRect();
        const saturation = ((clientX - bounds.left) / bounds.width) * 100;
        const value = (1 - (clientY - bounds.top) / bounds.height) * 100;

        updateColor({
          saturation,
          value,
        });
      },
      [updateColor]
    );

    return (
      <div
        className={cn(
          "relative aspect-square w-full cursor-crosshair overflow-hidden rounded-xl border shadow-xs/5",
          className
        )}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          handlePointerUpdate(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) {
            return;
          }

          handlePointerUpdate(event.clientX, event.clientY);
        }}
        ref={containerRef}
        style={{
          background: `linear-gradient(to top, rgb(0 0 0), transparent), linear-gradient(to right, rgb(255 255 255), hsl(${color.hue} 100% 50%))`,
        }}
        {...props}
      >
        <div
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0_/_0.35)]"
          style={{
            left: `${color.saturation}%`,
            top: `${100 - color.value}%`,
          }}
        />
      </div>
    );
  }
);

ColorPickerSelection.displayName = "ColorPickerSelection";

const ColorPickerSlider = ({
  children,
  className,
  max,
  min,
  onValueChange,
  value,
}: ColorPickerSliderProps) => {
  const thumbId = useId();

  return (
    <BaseSlider.Root
      className={cn("data-[orientation=horizontal]:w-full", className)}
      max={max}
      min={min}
      onValueChange={(nextValue) => onValueChange(nextValue[0] ?? min)}
      thumbAlignment="edge"
      value={[value]}
    >
      <BaseSlider.Control className="flex touch-none select-none data-[orientation=horizontal]:w-full">
        <BaseSlider.Track className="relative h-3 w-full grow overflow-hidden rounded-full border border-black/6 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.14)]">
          {children}
          <BaseSlider.Indicator className="bg-transparent" />
          <BaseSlider.Thumb
            aria-labelledby={thumbId}
            className="block size-4 shrink-0 rounded-full border border-white bg-transparent shadow-[0_0_0_1px_rgb(0_0_0_/_0.24),0_1px_3px_rgb(0_0_0_/_0.2)] outline-none has-focus-visible:ring-[3px] has-focus-visible:ring-ring/24"
            index={0}
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
      <span className="sr-only" id={thumbId}>
        Color picker slider
      </span>
    </BaseSlider.Root>
  );
};

const ColorPickerHue = ({
  className,
  ...props
}: Omit<
  ComponentProps<typeof BaseSlider.Root>,
  "children" | "max" | "min"
>) => {
  const { color, updateColor } = useColorPicker();

  return (
    <ColorPickerSlider
      className={className}
      max={360}
      min={0}
      onValueChange={(hue) => updateColor({ hue })}
      value={color.hue}
      {...props}
    >
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)]" />
    </ColorPickerSlider>
  );
};

const ColorPickerAlpha = ({
  className,
  ...props
}: Omit<
  ComponentProps<typeof BaseSlider.Root>,
  "children" | "max" | "min"
>) => {
  const { color, updateColor } = useColorPicker();

  return (
    <ColorPickerSlider
      className={className}
      max={100}
      min={0}
      onValueChange={(alpha) => updateColor({ alpha })}
      value={color.alpha}
      {...props}
    >
      <div className="absolute inset-0" style={CHECKERBOARD_STYLE} />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, transparent, ${getOpaqueColor(
            color
          )})`,
        }}
      />
    </ColorPickerSlider>
  );
};

const ColorPickerEyeDropper = ({
  className,
  onClick,
  ...props
}: ComponentProps<typeof Button>) => {
  const { updateColor } = useColorPicker();
  const isSupported =
    typeof window !== "undefined" && Boolean(window.EyeDropper);

  return (
    <Button
      className={cn("text-muted-foreground", className)}
      disabled={!isSupported}
      onClick={async (event) => {
        onClick?.(event);

        if (!window.EyeDropper) {
          return;
        }

        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open().catch(() => null);
        const nextColor = result ? parseColor(result.sRGBHex) : null;

        if (nextColor) {
          updateColor(nextColor);
        }
      }}
      size="icon-sm"
      type="button"
      variant="outline"
      {...props}
    >
      <PipetteIcon />
    </Button>
  );
};

const ColorPickerOutput = ({
  className,
  ...props
}: ComponentProps<typeof SelectTrigger>) => {
  const { mode, setMode } = useColorPicker();

  return (
    <Select
      onValueChange={(value) => setMode(value as ColorPickerMode)}
      value={mode}
    >
      <SelectTrigger
        className={cn("min-w-0 shrink-0 text-xs", className)}
        size="sm"
        {...props}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OUTPUT_MODES.map((option) => (
          <SelectItem className="text-xs" key={option} value={option}>
            {option.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const FormatInput = ({
  className,
  suffix,
  value,
}: {
  className?: string;
  suffix?: string;
  value: string;
}) => {
  return (
    <div className="relative min-w-0 flex-1">
      <Input
        className={cn("bg-secondary pe-7 text-xs shadow-none", className)}
        readOnly
        size="sm"
        value={value}
      />
      {suffix ? (
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11px] text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
};

const ColorPickerFormat = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  const { color, mode } = useColorPicker();
  const displayValue = formatDisplayValue(color, mode);

  return (
    <div
      className={cn("flex min-w-0 flex-1 items-center gap-1.5", className)}
      {...props}
    >
      {displayValue.values.map((value) => (
        <FormatInput key={value} value={value} />
      ))}
      {displayValue.alpha ? (
        <FormatInput
          className="max-w-14"
          suffix="%"
          value={displayValue.alpha}
        />
      ) : null}
    </div>
  );
};

export {
  ColorPicker,
  ColorPickerAlpha,
  ColorPickerEyeDropper,
  ColorPickerFormat,
  ColorPickerHue,
  ColorPickerOutput,
  ColorPickerSelection,
};
