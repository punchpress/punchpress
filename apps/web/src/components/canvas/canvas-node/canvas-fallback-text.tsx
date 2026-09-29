export const CanvasFallbackText = ({
  baselineOffset,
  fill,
  fontFamily,
  fontSize,
  isEditing,
  opacity,
  stroke,
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
      fontFamily={fontFamily}
      fontSize={fontSize}
      lengthAdjust="spacingAndGlyphs"
      opacity={isEditing ? 0 : (opacity ?? 1)}
      pointerEvents="none"
      stroke={stroke || "none"}
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
