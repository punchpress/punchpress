import {
  Cursor02Icon as Cursor02DuotoneIcon,
  CursorMove02Icon,
  CursorPointer01Icon,
  HandGrabIcon,
  PenTool03Icon,
  PenToolAddIcon,
} from "@hugeicons-pro/core-duotone-rounded";
import {
  ArrowDiagonalIcon,
  ArrowMoveLeftDownIcon,
  Cursor02Icon as Cursor02SolidIcon,
  ScrollHorizontalIcon,
} from "@hugeicons-pro/core-solid-rounded";
import type { IconSvgElement } from "@hugeicons/react";
import type { CSSProperties } from "react";

type CursorIconStyle =
  | "duotone"
  | "move"
  | "solid"
  | "solid-halo"
  | "solid-outline-blur"
  | "solid-outline-filter";

type CursorColorValue = string | (() => string);

type CursorHotspot = {
  scale?: number;
  x: number;
  y: number;
};

type MoveDecorationConfig = {
  outlineColor: CursorColorValue;
  outlineWidth: number;
  strokeColor: CursorColorValue;
  strokeWidth: number;
};

type CursorConfig = {
  fallback: string;
  fillColor: CursorColorValue;
  hotspot: CursorHotspot;
  icon: IconSvgElement;
  iconStyle: CursorIconStyle;
  moveDecoration?: MoveDecorationConfig;
  outlineAlphaBoost: number;
  outlineColor: CursorColorValue;
  outlineScale: number;
  outlineWidth: number;
  rotateDegrees: number;
  scale: number;
  scaleOrigin: "center" | "top-left";
  size: number;
  strokeColor: CursorColorValue;
};

const CURSOR_GLOBALS = {
  activeScale: 0.66,
  hotspotMultiplier: 1.2,
  sizeMultiplier: 1.25,
};

const scaleCursorSize = (size: number) => {
  return Math.round(size * CURSOR_GLOBALS.sizeMultiplier);
};

const BASE_CURSOR_SIZE = scaleCursorSize(19);
const MOVE_CURSOR_SIZE = scaleCursorSize(25);
const HAND_CURSOR_SIZE = scaleCursorSize(25);
const ROTATE_CURSOR_SIZE = scaleCursorSize(23);
const SCALE_CURSOR_SIZE = scaleCursorSize(26);
const SCROLL_HORIZONTAL_CURSOR_SIZE = scaleCursorSize(24);

const CURSOR_CONFIGS = {
  default: {
    fallback: "default",
    fillColor: "#111111",
    hotspot: { x: 3, y: 2 },
    icon: Cursor02SolidIcon,
    iconStyle: "solid-outline-blur",
    outlineAlphaBoost: 3.4,
    outlineColor: "#ffffff",
    outlineScale: 0.8,
    outlineWidth: 0,
    rotateDegrees: 0,
    scale: 1,
    scaleOrigin: "center",
    size: BASE_CURSOR_SIZE,
    strokeColor: "#ffffff",
  },
  grab: {
    fallback: "grab",
    fillColor: "#ffffff",
    hotspot: { scale: 1, x: 11, y: 5 },
    icon: HandGrabIcon,
    iconStyle: "duotone",
    outlineAlphaBoost: 1,
    outlineColor: "#ffffff",
    outlineScale: 1,
    outlineWidth: 0,
    rotateDegrees: 0,
    scale: 1,
    scaleOrigin: "center",
    size: HAND_CURSOR_SIZE,
    strokeColor: "#111111",
  },
  grabbing: {
    fallback: "grabbing",
    fillColor: "#ffffff",
    hotspot: {
      scale: CURSOR_GLOBALS.activeScale,
      x: 11,
      y: 5,
    },
    icon: HandGrabIcon,
    iconStyle: "duotone",
    outlineAlphaBoost: 1,
    outlineColor: "#ffffff",
    outlineScale: 1,
    outlineWidth: 0,
    rotateDegrees: 0,
    scale: CURSOR_GLOBALS.activeScale,
    scaleOrigin: "center",
    size: HAND_CURSOR_SIZE,
    strokeColor: "#111111",
  },
  move: {
    fallback: "move",
    fillColor: "#111111",
    hotspot: { x: 3, y: 2 },
    icon: CursorMove02Icon,
    iconStyle: "move",
    moveDecoration: {
      outlineColor: "#ffffff",
      outlineWidth: 2.6,
      strokeColor: "#111111",
      strokeWidth: 1.5,
    },
    outlineAlphaBoost: 1,
    outlineColor: "#ffffff",
    outlineScale: 1,
    outlineWidth: 0,
    rotateDegrees: 0,
    scale: BASE_CURSOR_SIZE / MOVE_CURSOR_SIZE,
    scaleOrigin: "top-left",
    size: MOVE_CURSOR_SIZE,
    strokeColor: "#ffffff",
  },
  penTool: {
    fallback: "crosshair",
    fillColor: "#111111",
    hotspot: { x: 6, y: 20 },
    icon: PenTool03Icon,
    iconStyle: "duotone",
    outlineAlphaBoost: 1,
    outlineColor: "#ffffff",
    outlineScale: 1,
    outlineWidth: 0,
    rotateDegrees: 0,
    scale: 1,
    scaleOrigin: "center",
    size: BASE_CURSOR_SIZE,
    strokeColor: "#ffffff",
  },
  penToolAdd: {
    fallback: "crosshair",
    fillColor: "#111111",
    hotspot: { x: 6, y: 21 },
    icon: PenToolAddIcon,
    iconStyle: "duotone",
    outlineAlphaBoost: 1,
    outlineColor: "#ffffff",
    outlineScale: 1,
    outlineWidth: 0,
    rotateDegrees: 0,
    scale: 1,
    scaleOrigin: "center",
    size: BASE_CURSOR_SIZE,
    strokeColor: "#ffffff",
  },
  pointer: {
    fallback: "pointer",
    fillColor: "#111111",
    hotspot: { x: 6, y: 3 },
    icon: CursorPointer01Icon,
    iconStyle: "duotone",
    outlineAlphaBoost: 1,
    outlineColor: "#ffffff",
    outlineScale: 1,
    outlineWidth: 0,
    rotateDegrees: 0,
    scale: 1,
    scaleOrigin: "center",
    size: BASE_CURSOR_SIZE,
    strokeColor: "#ffffff",
  },
  rotate: {
    fallback: "crosshair",
    fillColor: "#111111",
    hotspot: { scale: 0.7, x: 12, y: 12 },
    icon: ArrowMoveLeftDownIcon,
    iconStyle: "solid-outline-blur",
    outlineAlphaBoost: 3.6,
    outlineColor: "#ffffff",
    outlineScale: 0.55,
    outlineWidth: 0,
    rotateDegrees: 0,
    scale: 0.8,
    scaleOrigin: "center",
    size: ROTATE_CURSOR_SIZE,
    strokeColor: "#ffffff",
  },
  scale: {
    fallback: "nwse-resize",
    fillColor: "#111111",
    hotspot: { x: 13, y: 13 },
    icon: ArrowDiagonalIcon,
    iconStyle: "solid-outline-blur",
    outlineAlphaBoost: 3.6,
    outlineColor: "#ffffff",
    outlineScale: 0.6,
    outlineWidth: 0,
    rotateDegrees: 0,
    scale: 0.75,
    scaleOrigin: "center",
    size: SCALE_CURSOR_SIZE,
    strokeColor: "#ffffff",
  },
  scrollHorizontal: {
    fallback: "ew-resize",
    fillColor: "#111111",
    hotspot: { scale: 0.84, x: 12, y: 12 },
    icon: ScrollHorizontalIcon,
    iconStyle: "solid-outline-filter",
    outlineAlphaBoost: 1,
    outlineColor: "#ffffff",
    outlineScale: 0.6,
    outlineWidth: 0,
    rotateDegrees: 0,
    scale: 0.84,
    scaleOrigin: "center",
    size: SCROLL_HORIZONTAL_CURSOR_SIZE,
    strokeColor: "#ffffff",
  },
} satisfies Record<string, CursorConfig>;

const createScaleCursor = createCanvasCursorFactory(CURSOR_CONFIGS.scale);
const createRotateCursor = createCanvasCursorFactory(CURSOR_CONFIGS.rotate);

export const getCanvasScaleCursor = (rotationDegrees = 0) => {
  return createScaleCursor({ rotateDegrees: rotationDegrees });
};

export const getCanvasRotateCursor = (rotationDegrees = 0) => {
  return createRotateCursor({ rotateDegrees: rotationDegrees });
};

export const getCanvasCursorStyle = () =>
  ({
    "--canvas-cursor-default": createCanvasCursorFromConfig(
      CURSOR_CONFIGS.default
    ),
    "--canvas-cursor-grab": createCanvasCursorFromConfig(CURSOR_CONFIGS.grab),
    "--canvas-cursor-grabbing": createCanvasCursorFromConfig(
      CURSOR_CONFIGS.grabbing
    ),
    "--canvas-cursor-move": createCanvasCursorFromConfig(CURSOR_CONFIGS.move),
    "--canvas-cursor-pen-tool": createCanvasCursorFromConfig(
      CURSOR_CONFIGS.penTool
    ),
    "--canvas-cursor-pen-tool-add": createCanvasCursorFromConfig(
      CURSOR_CONFIGS.penToolAdd
    ),
    "--canvas-cursor-pointer": createCanvasCursorFromConfig(
      CURSOR_CONFIGS.pointer
    ),
    "--canvas-cursor-rotate": getCanvasRotateCursor(),
    "--canvas-cursor-scale": getCanvasScaleCursor(),
    "--canvas-cursor-scroll-horizontal": createCanvasCursorFromConfig(
      CURSOR_CONFIGS.scrollHorizontal
    ),
  } as CSSProperties);

function createCanvasCursorFactory(config: CursorConfig) {
  const cache = new Map<string, string>();

  return ({ rotateDegrees = config.rotateDegrees } = {}) => {
    const hotspot = resolveHotspot(config.hotspot);
    const normalizedRotation = normalizeRotationDegrees(rotateDegrees);
    const cacheKey = `${hotspot.x}:${hotspot.y}:${normalizedRotation}`;
    const cachedCursor = cache.get(cacheKey);

    if (cachedCursor) {
      return cachedCursor;
    }

    const cursor = createCanvasCursorFromConfig(config, {
      hotspot,
      rotateDegrees: normalizedRotation,
    });

    cache.set(cacheKey, cursor);

    return cursor;
  };
}

function createCanvasCursorFromConfig(
  config: CursorConfig,
  {
    hotspot = resolveHotspot(config.hotspot),
    rotateDegrees = config.rotateDegrees,
  }: {
    hotspot?: { x: number; y: number };
    rotateDegrees?: number;
  } = {}
) {
  return createCanvasCursor(config.icon, {
    fallback: config.fallback,
    fillColor: resolveCursorColor(config.fillColor),
    hotspot,
    iconStyle: config.iconStyle,
    moveDecoration: resolveMoveDecoration(config.moveDecoration),
    outlineAlphaBoost: config.outlineAlphaBoost,
    outlineColor: resolveCursorColor(config.outlineColor),
    outlineScale: config.outlineScale,
    outlineWidth: config.outlineWidth,
    rotateDegrees,
    scale: config.scale,
    scaleOrigin: config.scaleOrigin,
    size: config.size,
    strokeColor: resolveCursorColor(config.strokeColor),
  });
}

function createCanvasCursor(
  icon: IconSvgElement,
  {
    fallback,
    fillColor,
    hotspot,
    iconStyle,
    moveDecoration,
    outlineAlphaBoost,
    outlineColor,
    outlineScale,
    outlineWidth,
    rotateDegrees,
    scale,
    scaleOrigin,
    size,
    strokeColor,
  }: {
    fallback: string;
    fillColor: string;
    hotspot: { x: number; y: number };
    iconStyle: CursorIconStyle;
    moveDecoration?: {
      outlineColor: string;
      outlineWidth: number;
      strokeColor: string;
      strokeWidth: number;
    };
    outlineAlphaBoost: number;
    outlineColor: string;
    outlineScale: number;
    outlineWidth: number;
    rotateDegrees: number;
    scale: number;
    scaleOrigin: "center" | "top-left";
    size: number;
    strokeColor: string;
  }
) {
  const transform = getIconTransform(scale, rotateDegrees, scaleOrigin);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">`,
    transform ? `<g transform="${transform}">` : "",
    serializeIcon(icon, {
      fillColor,
      iconStyle,
      moveDecoration,
      outlineAlphaBoost,
      outlineColor,
      outlineScale,
      outlineWidth,
      strokeColor,
    }),
    transform ? "</g>" : "",
    "</svg>",
  ].join("");
  const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  return `url("${dataUri}") ${hotspot.x} ${hotspot.y}, ${fallback}`;
}

function serializeIcon(
  icon: IconSvgElement,
  {
    fillColor,
    iconStyle,
    moveDecoration,
    outlineAlphaBoost,
    outlineColor,
    outlineScale,
    outlineWidth,
    strokeColor,
  }: {
    fillColor: string;
    iconStyle: CursorIconStyle;
    moveDecoration?: {
      outlineColor: string;
      outlineWidth: number;
      strokeColor: string;
      strokeWidth: number;
    };
    outlineAlphaBoost: number;
    outlineColor: string;
    outlineScale: number;
    outlineWidth: number;
    strokeColor: string;
  }
) {
  if (iconStyle === "move" && moveDecoration) {
    return serializeMoveCursorIcon(icon, {
      decorationOutlineColor: moveDecoration.outlineColor,
      decorationOutlineWidth: moveDecoration.outlineWidth,
      decorationStrokeColor: moveDecoration.strokeColor,
      decorationStrokeWidth: moveDecoration.strokeWidth,
      fillColor,
      strokeColor,
    });
  }

  if (iconStyle === "solid-halo") {
    return serializeSolidHaloIcon(icon, {
      fillColor,
      haloColor: outlineColor,
      haloScale: outlineScale,
    });
  }

  if (iconStyle === "solid-outline-filter") {
    return serializeSolidOutlineFilterIcon(icon, {
      fillColor,
      outlineColor,
      outlineRadius: outlineScale,
    });
  }

  if (iconStyle === "solid-outline-blur") {
    return serializeSolidOutlineBlurIcon(icon, {
      fillColor,
      outlineAlphaBoost,
      outlineColor,
      outlineRadius: outlineScale,
    });
  }

  return icon
    .map(([tagName, attributes]) => {
      const isSecondaryPath =
        iconStyle === "duotone" && attributes.opacity !== undefined;
      const serializedAttributes = Object.entries(attributes)
        .map(([name, value]) => {
          if (isSecondaryPath && name === "opacity") {
            return null;
          }

          const resolvedValue =
            value === "currentColor"
              ? iconStyle === "solid"
                ? fillColor
                : isSecondaryPath
                  ? fillColor
                  : strokeColor
              : value;

          return `${toSvgAttributeName(name)}="${escapeAttributeValue(
            String(resolvedValue)
          )}"`;
        })
        .filter(Boolean);

      if (iconStyle === "solid" && tagName === "path" && outlineColor) {
        serializedAttributes.push(
          `stroke="${escapeAttributeValue(outlineColor)}"`,
          `stroke-width="${outlineWidth}"`,
          'stroke-linejoin="round"',
          'paint-order="stroke fill"'
        );
      }

      return `<${tagName} ${serializedAttributes.join(" ")} />`;
    })
    .join("");
}

function serializeSolidHaloIcon(
  icon: IconSvgElement,
  {
    fillColor,
    haloColor,
    haloScale,
  }: {
    fillColor: string;
    haloColor: string;
    haloScale: number;
  }
) {
  const haloTransform = getIconTransform(haloScale, 0, "center");

  return [
    haloTransform ? `<g transform="${haloTransform}">` : "",
    serializeSolidIconLayer(icon, haloColor),
    haloTransform ? "</g>" : "",
    serializeSolidIconLayer(icon, fillColor),
  ].join("");
}

function serializeSolidOutlineFilterIcon(
  icon: IconSvgElement,
  {
    fillColor,
    outlineColor,
    outlineRadius,
  }: {
    fillColor: string;
    outlineColor: string;
    outlineRadius: number;
  }
) {
  return [
    "<defs>",
    `<filter id="scale-cursor-outline" x="-8" y="-8" width="40" height="40" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">`,
    `<feMorphology in="SourceAlpha" operator="dilate" radius="${outlineRadius}" result="expanded" />`,
    '<feComposite in="expanded" in2="SourceAlpha" operator="out" result="outline" />',
    `<feFlood flood-color="${escapeAttributeValue(outlineColor)}" result="outline-color" />`,
    '<feComposite in="outline-color" in2="outline" operator="in" result="outline-fill" />',
    "<feMerge>",
    '<feMergeNode in="outline-fill" />',
    '<feMergeNode in="SourceGraphic" />',
    "</feMerge>",
    "</filter>",
    "</defs>",
    '<g filter="url(#scale-cursor-outline)">',
    serializeSolidIconLayer(icon, fillColor),
    "</g>",
  ].join("");
}

function serializeSolidOutlineBlurIcon(
  icon: IconSvgElement,
  {
    fillColor,
    outlineAlphaBoost,
    outlineColor,
    outlineRadius,
  }: {
    fillColor: string;
    outlineAlphaBoost: number;
    outlineColor: string;
    outlineRadius: number;
  }
) {
  return [
    "<defs>",
    `<filter id="scale-cursor-outline" x="-8" y="-8" width="40" height="40" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">`,
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${outlineRadius}" result="blurred" />`,
    '<feComposite in="blurred" in2="SourceAlpha" operator="out" result="outline" />',
    '<feComponentTransfer in="outline" result="outline-strong">',
    `<feFuncA type="linear" slope="${outlineAlphaBoost}" intercept="0" />`,
    "</feComponentTransfer>",
    `<feFlood flood-color="${escapeAttributeValue(outlineColor)}" result="outline-color" />`,
    '<feComposite in="outline-color" in2="outline-strong" operator="in" result="outline-fill" />',
    "<feMerge>",
    '<feMergeNode in="outline-fill" />',
    '<feMergeNode in="SourceGraphic" />',
    "</feMerge>",
    "</filter>",
    "</defs>",
    '<g filter="url(#scale-cursor-outline)">',
    serializeSolidIconLayer(icon, fillColor),
    "</g>",
  ].join("");
}

function serializeMoveCursorIcon(
  icon: IconSvgElement,
  {
    decorationOutlineColor,
    decorationOutlineWidth,
    decorationStrokeColor,
    decorationStrokeWidth,
    fillColor,
    strokeColor,
  }: {
    decorationOutlineColor: string;
    decorationOutlineWidth: number;
    decorationStrokeColor: string;
    decorationStrokeWidth: number;
    fillColor: string;
    strokeColor: string;
  }
) {
  return [...Cursor02DuotoneIcon, icon[2]]
    .flatMap(([tagName, attributes], index) => {
      if (tagName !== "path") {
        return [serializeSvgElement(tagName, attributes)];
      }

      if (index === 0) {
        return [
          serializeSvgElement(tagName, {
            ...attributes,
            fill: fillColor,
          }),
        ];
      }

      if (index === 1) {
        return [
          serializeSvgElement(tagName, {
            ...attributes,
            stroke: strokeColor,
          }),
        ];
      }

      if (index === 2) {
        return [
          serializeSvgElement(tagName, {
            ...attributes,
            stroke: decorationOutlineColor,
            strokeWidth: decorationOutlineWidth,
          }),
          serializeSvgElement(tagName, {
            ...attributes,
            stroke: decorationStrokeColor,
            strokeWidth: decorationStrokeWidth,
          }),
        ];
      }

      return [serializeSvgElement(tagName, attributes)];
    })
    .join("");
}

function serializeSolidIconLayer(icon: IconSvgElement, color: string) {
  return icon
    .map(([tagName, attributes]) => {
      const resolvedAttributes = Object.fromEntries(
        Object.entries(attributes).map(([name, value]) => {
          if (value === "currentColor") {
            return [name, color];
          }

          return [name, value];
        })
      );

      return serializeSvgElement(tagName, resolvedAttributes);
    })
    .join("");
}

function serializeSvgElement(
  tagName: string,
  attributes: Record<string, string | number | undefined>
) {
  const serializedAttributes = Object.entries(attributes)
    .filter(([name, value]) => name !== "opacity" && value !== undefined)
    .map(([name, value]) => {
      return `${toSvgAttributeName(name)}="${escapeAttributeValue(
        String(value)
      )}"`;
    })
    .join(" ");

  return `<${tagName} ${serializedAttributes} />`;
}

function toSvgAttributeName(name: string) {
  return name.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

function escapeAttributeValue(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getIconTransform(
  scale: number,
  rotateDegrees: number,
  scaleOrigin: "center" | "top-left"
) {
  if (scale === 1 && rotateDegrees === 0) {
    return "";
  }

  const transforms = [];

  if (rotateDegrees !== 0) {
    transforms.push(`rotate(${rotateDegrees} 12 12)`);
  }

  if (scale !== 1) {
    if (scaleOrigin === "center") {
      const translate = 12 - 12 * scale;
      transforms.push(`translate(${translate} ${translate}) scale(${scale})`);
    } else {
      transforms.push(`scale(${scale})`);
    }
  }

  return transforms.join(" ");
}

function resolveHotspot({ scale = 1, x, y }: CursorHotspot) {
  return {
    x: Math.round(x * CURSOR_GLOBALS.hotspotMultiplier * scale),
    y: Math.round(y * CURSOR_GLOBALS.hotspotMultiplier * scale),
  };
}

function resolveCursorColor(color: CursorColorValue) {
  return typeof color === "function" ? color() : color;
}

function resolveMoveDecoration(moveDecoration?: MoveDecorationConfig) {
  if (!moveDecoration) {
    return undefined;
  }

  return {
    outlineColor: resolveCursorColor(moveDecoration.outlineColor),
    outlineWidth: moveDecoration.outlineWidth,
    strokeColor: resolveCursorColor(moveDecoration.strokeColor),
    strokeWidth: moveDecoration.strokeWidth,
  };
}

function normalizeRotationDegrees(rotationDegrees: number) {
  const normalizedRotation = rotationDegrees % 360;

  return normalizedRotation < 0
    ? normalizedRotation + 360
    : normalizedRotation;
}
