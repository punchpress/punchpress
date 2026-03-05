import { format } from "../editor/math-utils";

export const SELECTION_CORNER_HANDLE_SIZE = 36;
const SELECTION_CORNER_HANDLE_RADIUS = 8;
export const SELECTION_CORNER_HANDLE_HIT_SIZE = 140;

export const buildCornerHandles = (bbox) => {
  return [
    { id: "tl", x: bbox.minX, y: bbox.minY },
    { id: "tr", x: bbox.maxX, y: bbox.minY },
    { id: "bl", x: bbox.minX, y: bbox.maxY },
    { id: "br", x: bbox.maxX, y: bbox.maxY },
  ];
};

export const SelectionOutline = ({ node, geometry, withHandles }) => {
  const bbox = geometry.bbox;
  const handleSize = SELECTION_CORNER_HANDLE_SIZE;
  const handleOffset = handleSize / 2;
  const handles = buildCornerHandles(bbox);

  return (
    <g
      className={withHandles ? "selection selected" : "selection hover"}
      transform={`translate(${node.x} ${node.y})`}
    >
      <rect
        height={format(Math.max(1, bbox.height))}
        width={format(Math.max(1, bbox.width))}
        x={format(bbox.minX)}
        y={format(bbox.minY)}
      />

      {withHandles &&
        handles.map((handle) => {
          return (
            <rect
              height={handleSize}
              key={handle.id}
              rx={SELECTION_CORNER_HANDLE_RADIUS}
              ry={SELECTION_CORNER_HANDLE_RADIUS}
              width={handleSize}
              x={format(handle.x - handleOffset)}
              y={format(handle.y - handleOffset)}
            />
          );
        })}
    </g>
  );
};
