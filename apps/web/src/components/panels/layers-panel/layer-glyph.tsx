import { HugeiconsIcon } from "@hugeicons/react";

export const LAYER_SHORTCUTS = {
  duplicate: "⌘J",
  bringToFront: "]",
  group: "⌘G",
  sendToBack: "[",
  ungroup: "⇧⌘G",
};

export const LayerGlyph = ({
  className = undefined,
  icon,
  size = 18,
  strokeWidth = 1.8,
}) => {
  return (
    <HugeiconsIcon
      className={className}
      color="currentColor"
      icon={icon}
      size={size}
      {...(typeof strokeWidth === "number" ? { strokeWidth } : {})}
    />
  );
};
