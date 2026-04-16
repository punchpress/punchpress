import {
  Folder02Icon,
  GeometricShapes01Icon,
  Route01Icon,
  SquareIcon,
  TextFontIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { LayerGlyph } from "./layer-context-menu";

interface LayerNodeIconProps {
  isGroup?: boolean;
  nodeType?: string | null;
}

export const LayerNodeIcon = ({
  isGroup = false,
  nodeType = null,
}: LayerNodeIconProps) => {
  if (isGroup) {
    return <LayerGlyph icon={Folder02Icon} size={16} strokeWidth={1.8} />;
  }

  if (nodeType === "vector") {
    return (
      <LayerGlyph icon={GeometricShapes01Icon} size={16} strokeWidth={1.8} />
    );
  }

  if (nodeType === "path") {
    return <LayerGlyph icon={Route01Icon} size={16} strokeWidth={1.8} />;
  }

  if (nodeType === "shape") {
    return <LayerGlyph icon={SquareIcon} size={16} strokeWidth={1.8} />;
  }

  return <LayerGlyph icon={TextFontIcon} size={16} strokeWidth={1.8} />;
};
