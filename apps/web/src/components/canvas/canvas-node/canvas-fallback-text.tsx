// Unavailable-font preview: SVG <text> can paint only one fill and one stroke,
// so it receives the stack's primary paint.
export const CanvasFallbackText = ({
  baselineOffset,
  fill,
  fillOpacity,
  fontFamily,
  fontSize,
  isEditing,
  opacity,
  stroke,
  strokeOpacity,
  strokeWidth,
  text,
  transform,
  width,
}) => {
  return (
    <text
      dominantBaseline="middle"
      dy={baselineOffset || undefined}
      fill={fill || "none"}
      fillOpacity={fillOpacity ?? 1}
      fontFamily={fontFamily}
      fontSize={fontSize}
      lengthAdjust="spacingAndGlyphs"
      opacity={isEditing ? 0 : (opacity ?? 1)}
      pointerEvents="none"
      stroke={stroke || "none"}
      strokeOpacity={strokeOpacity ?? 1}
      strokeWidth={strokeWidth || 0}
      textAnchor="middle"
      textLength={width || undefined}
      transform={transform || undefined}
      x={0}
      y={0}
    >
      {text}
    </text>
  );
};
