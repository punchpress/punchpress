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

export const buildVectorNodeGeometry = (node) => {
  const paths = node.contours.map((contour, index) => {
    const commands = getVectorContourCommands(contour);

    return {
      closed: contour.closed,
      commands,
      d: commandsToPathData(commands),
      key: `vector-${index}`,
    };
  });

  const flattenedContours = paths.flatMap((path) => {
    return commandsToContours(path.commands, 1.5);
  });
  const strokeInset = Math.max(node.strokeWidth / 2, 0);
  const rawBounds = getBounds(flattenedContours);
  const bbox = {
    height: rawBounds.height + strokeInset * 2,
    maxX: rawBounds.maxX + strokeInset,
    maxY: rawBounds.maxY + strokeInset,
    minX: rawBounds.minX - strokeInset,
    minY: rawBounds.minY - strokeInset,
    width: rawBounds.width + strokeInset * 2,
  };

  return {
    bbox,
    guide: null,
    id: node.id,
    paths: paths.map(({ commands: _commands, ...path }) => path),
    ready: true,
    selectionBounds: bbox,
  };
};
