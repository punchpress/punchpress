import { getPaintHitStyle } from "../../appearance/paint-extent";
import {
  createPaintedHitRegion,
  withNodeGeometryBehavior,
} from "../../primitives/node-geometry";
import { commandsToContours, getBounds } from "../../primitives/path-geometry";
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

// Contours carry only what geometry needs: the fill rule plus paint presence and
// stroke reach for bounds and hit testing (see getPaintHitStyle).
const getContourStyle = (contour) => {
  const paint = contour.appearance
    ? getPaintHitStyle(contour, contour.closed !== false)
    : contour;

  return {
    fill: paint.fill ?? null,
    fillRule: contour.fillRule ?? "nonzero",
    insideReach: paint.insideReach ?? 0,
    outsideReach: paint.outsideReach ?? 0,
    stroke: paint.stroke ?? null,
  };
};

export const buildVectorNodeGeometry = (node) => {
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
      insideReach: style.insideReach,
      key: contour.id || `vector-${index}`,
      outsideReach: style.outsideReach,
      stroke: style.stroke,
    };
  });

  const flattenedContours = paths.flatMap((path) => {
    return commandsToContours(path.commands, 1.5);
  });
  const strokeInset = visibleContours.reduce((maxStrokeInset, contour) => {
    return Math.max(maxStrokeInset, getContourStyle(contour).outsideReach);
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
      insideReach: path.insideReach,
      outsideReach: path.outsideReach,
      stroke: path.stroke,
    })
  );
  // Rendered paths are geometry only; the appearance plan supplies paint.
  const renderedPaths = paths.map(({ closed, d, fillRule, key }) => ({
    closed,
    d,
    fillRule,
    hasClosedContour: Boolean(closed),
    key,
  }));

  return withNodeGeometryBehavior({
    bbox,
    paintBox: rawBounds,
    guide: null,
    hitRegions,
    id: node.id,
    paths: renderedPaths,
    ready: true,
    selectionBounds: bbox,
  });
};

// Unstroked bounds of editable contours, flattened exactly as vector geometry
// is, so live shapes and the paths they convert into share one paint box.
export const getContoursPaintBox = (contours) => {
  const points = contours.flatMap((contour) => {
    return commandsToContours(getVectorContourCommands(contour), 1.5);
  });

  return points.length > 0 ? getBounds(points) : null;
};
