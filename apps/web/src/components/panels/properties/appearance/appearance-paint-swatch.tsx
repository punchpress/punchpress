import { type Paint, PERF_COUNTERS } from "@punchpress/engine";
import { parseColor, toRgb } from "@punchpress/punch-schema";
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";
import { ColorField } from "../field-primitives";
import {
  useAppearanceLayerValue,
  useAppearanceList,
  useUpdateAppearanceLayer,
} from "./appearance-context";

// The layer's paint at a glance: a color field for solid paint, or the ramp
// drawn with the same SVG stops the canvas uses for a gradient.
export const AppearancePaintSwatch = ({ layerId }: { layerId: string }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesField);
  const list = useAppearanceList();
  const updateLayer = useUpdateAppearanceLayer(layerId);
  // A solid paint reads as one color string; a gradient keeps its stored
  // paint so the ramp re-renders only when the gradient changes.
  const swatch = useAppearanceLayerValue(layerId, (layer) => {
    return layer.paint.kind === "linear-gradient"
      ? layer.paint
      : formatColorWithOpacity(layer.paint.color, layer.opacity);
  });

  if (swatch === null) {
    return null;
  }

  if (typeof swatch !== "string") {
    return <GradientRamp paint={swatch} testId={`gradient-ramp-${layerId}`} />;
  }

  return (
    <ColorField
      onChange={(value) => {
        const parsed = parseColor(value);

        if (parsed) {
          updateLayer({ color: parsed.color, opacity: parsed.opacity });
        }
      }}
      onInteractionEnd={undefined}
      onInteractionStart={undefined}
      placeholder={undefined}
      stateKey={`appearance-${list}-${layerId}`}
      value={swatch}
    />
  );
};

export const GradientRamp = ({
  paint,
  testId,
}: {
  paint: Extract<Paint, { kind: "linear-gradient" }>;
  testId?: string;
}) => {
  const id = `ramp-${testId ?? "gradient"}`;

  return (
    <svg
      aria-hidden="true"
      className="block h-7 w-full rounded-md border border-black/8"
      data-testid={testId}
      preserveAspectRatio="none"
      viewBox="0 0 100 10"
    >
      <defs>
        <pattern
          height="5"
          id={`${id}-checker`}
          patternUnits="userSpaceOnUse"
          width="5"
        >
          <rect fill="#ffffff" height="5" width="5" />
          <rect fill="#e5e5e5" height="2.5" width="2.5" />
          <rect fill="#e5e5e5" height="2.5" width="2.5" x="2.5" y="2.5" />
        </pattern>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          {paint.stops.map((stop) => (
            <stop
              key={stop.id}
              offset={stop.offset}
              stopColor={stop.color}
              stopOpacity={stop.opacity}
            />
          ))}
        </linearGradient>
      </defs>
      <rect fill={`url(#${id}-checker)`} height="10" width="100" />
      <rect fill={`url(#${id})`} height="10" width="100" />
    </svg>
  );
};

// The picker edits color and alpha together; alpha is the layer opacity.
export const formatColorWithOpacity = (color: string, opacity: number) => {
  if (opacity >= 1) {
    return color;
  }

  const { b, g, r } = toRgb(color);

  return `rgba(${r}, ${g}, ${b}, ${Number(opacity.toFixed(3))})`;
};
