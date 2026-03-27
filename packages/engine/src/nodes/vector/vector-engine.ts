import { commandsToContours, getBounds } from "../../primitives/path-geometry";

const addPoint = (point, offset) => {
  return {
    x: point.x + offset.x,
    y: point.y + offset.y,
  };
};

const hasHandle = (handle) => {
  return Boolean(handle && (handle.x !== 0 || handle.y !== 0));
};

const getSegmentCommand = (currentSegment, nextSegment) => {
  const control1 = addPoint(currentSegment.point, currentSegment.handleOut);
  const control2 = addPoint(nextSegment.point, nextSegment.handleIn);
  const usesCurve =
    hasHandle(currentSegment.handleOut) || hasHandle(nextSegment.handleIn);

  if (!usesCurve) {
    return {
      type: "L",
      x: nextSegment.point.x,
      y: nextSegment.point.y,
    };
  }

  return {
    type: "C",
    x: nextSegment.point.x,
    x1: control1.x,
    x2: control2.x,
    y: nextSegment.point.y,
    y1: control1.y,
    y2: control2.y,
  };
};

const getContourCommands = (contour) => {
  if (!contour.segments.length) {
    return [];
  }

  const [firstSegment, ...restSegments] = contour.segments;
  const commands = [
    {
      type: "M",
      x: firstSegment.point.x,
      y: firstSegment.point.y,
    },
  ];

  let previousSegment = firstSegment;

  for (const segment of restSegments) {
    commands.push(getSegmentCommand(previousSegment, segment));
    previousSegment = segment;
  }

  if (contour.closed) {
    commands.push(getSegmentCommand(previousSegment, firstSegment));
    commands.push({ type: "Z" });
  }

  return commands;
};

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
    const commands = getContourCommands(contour);

    return {
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
