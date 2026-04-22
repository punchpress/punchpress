import { HugeiconsIcon } from "@hugeicons/react";

export const LAYER_SHORTCUTS = {
  duplicate: "\u2318J",
  bringToFront: "]",
  group: "\u2318G",
  sendToBack: "[",
  ungroup: "\u21e7\u2318G",
};

export const LayerGlyph = ({ icon, size = 18, strokeWidth = 1.8 }) => {
  return (
    <HugeiconsIcon
      color="currentColor"
      icon={icon}
      size={size}
      {...(typeof strokeWidth === "number" ? { strokeWidth } : {})}
    />
  );
};
