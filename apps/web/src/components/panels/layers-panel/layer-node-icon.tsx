import {
  ArtboardToolIcon,
  FileImageIcon,
  Folder02Icon,
  GeometricShapes01Icon,
  Layers01Icon,
  Route01Icon,
  SquareIcon,
  TextFontIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { LayerGlyph } from "./layer-glyph";

const NODE_TYPE_ICONS = {
  artboard: ArtboardToolIcon,
  empty: Layers01Icon,
  image: FileImageIcon,
  path: Route01Icon,
  shape: SquareIcon,
  vector: GeometricShapes01Icon,
};

interface LayerNodeIconProps {
  isGroup?: boolean;
  nodeType?: string | null;
}

export const LayerNodeIcon = ({
  isGroup = false,
  nodeType = null,
}: LayerNodeIconProps) => {
  const icon = isGroup
    ? Folder02Icon
    : (NODE_TYPE_ICONS[nodeType ?? ""] ?? TextFontIcon);

  return (
    <LayerGlyph className="size-(--layer-icon)" icon={icon} strokeWidth={1.8} />
  );
};
