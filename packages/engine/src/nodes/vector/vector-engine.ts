import { commandsToContours, getBounds } from "../../primitives/path-geometry";
import {
  createPaintedHitRegion,
  withNodeGeometryBehavior,
} from "../../primitives/node-geometry";
import { getVectorContourCommands } from "./vector-corners";

const formatCoordinate = (value) => {
  const roundedValue = Math.round(value * 1000) / 1000;

  if (Object.is(roundedValue, -0)) {
    return "0";
  }

  return `${roundedValue}`;
};

const commandsToPathData = (commands) => {
  return commands
    .map((command) => {
      switch (command.type) {
        case "M":
        case "L":
          return `${command.type} ${formatCoordinate(command.x)} ${formatCoordinate(command.y)}`;
        case "C":
          return `C ${formatCoordinate(command.x1)} ${formatCoordinate(command.y1)} ${formatCoordinate(command.x2)} ${formatCoordinate(command.y2)} ${formatCoordinate(command.x)} ${formatCoordinate(command.y)}`;
        case "Z":
          return "Z";
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join(" ");
};

const getContourStyle = (contour) => {
  return {
    fill: contour.fill ?? null,
    fillRule: contour.fillRule ?? "nonzero",
    opacity: contour.opacity,
    stroke: contour.stroke ?? null,
    strokeLineCap: contour.strokeLineCap ?? "round",
    strokeLineJoin: contour.strokeLineJoin ?? "round",
    strokeMiterLimit: contour.strokeMiterLimit ?? 4,
    strokeWidth: contour.strokeWidth ?? 0,
  };
};

export const buildVectorNodeGeometry = (node) => {
  const nodeOpacity = node.opacity ?? 1;
  const visibleContours = (node.contours || []).filter(
    (contour) => contour?.visible !== false
  );
  const paths = visibleContours.map((contour, index) => {
    const commands = getVectorContourCommands(contour);
    const style = getContourStyle(contour);

    return {
      closed: contour.closed,
      commands,
      d: commandsToPathData(commands),
      fill: style.fill,
      fillRule: style.fillRule,
      key: contour.id || `vector-${index}`,
      opacity:
        style.opacity == null ? undefined : style.opacity * nodeOpacity,
      stroke: style.stroke,
      strokeLineCap: style.strokeLineCap,
      strokeLineJoin: style.strokeLineJoin,
      strokeMiterLimit: style.strokeMiterLimit,
      strokeWidth: style.strokeWidth,
    };
  });

  const flattenedContours = paths.flatMap((path) => {
    return commandsToContours(path.commands, 1.5);
  });
  const strokeInset = visibleContours.reduce((maxStrokeInset, contour) => {
    return Math.max(maxStrokeInset, (contour.strokeWidth || 0) / 2);
  }, 0);
  const sourceBoundsPoints =
    flattenedContours.length > 0
      ? flattenedContours
      : visibleContours.flatMap((contour) => {
          return contour.segments.map((segment) => {
            return segment.point;
          });
        });

  if (sourceBoundsPoints.length === 0) {
    return null;
  }

  const rawBounds = getBounds(sourceBoundsPoints);
  const bbox = {
    height: rawBounds.height + strokeInset * 2,
    maxX: rawBounds.maxX + strokeInset,
    maxY: rawBounds.maxY + strokeInset,
    minX: rawBounds.minX - strokeInset,
    minY: rawBounds.minY - strokeInset,
    width: rawBounds.width + strokeInset * 2,
  };
  const hitRegions = paths.map((path) =>
    createPaintedHitRegion({
      contours: commandsToContours(path.commands, 1.5),
      fill: path.fill,
      fillRule: path.fillRule,
      stroke: path.stroke,
      strokeWidth: path.strokeWidth,
    })
  );
  const renderedPaths = paths.map(({ commands: _commands, ...path }) => path);

  return withNodeGeometryBehavior({
    bbox,
    guide: null,
    hitRegions,
    id: node.id,
    paths: renderedPaths,
    ready: true,
    selectionBounds: bbox,
  });
};
