import { CanvasPathPreviewSvg } from "./canvas-path-preview-svg";

interface CanvasSelectionPathGhostProps {
  ghost: {
    bbox: {
      height: number;
      maxX: number;
      maxY: number;
      minX: number;
      minY: number;
      width: number;
    };
    nodeId: string;
    paths: Array<{
      d: string;
      key?: string;
      transform?: string | null;
    }>;
  } | null;
}

export const CanvasSelectionPathGhost = ({
  ghost,
}: CanvasSelectionPathGhostProps) => {
  if (!ghost) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 block overflow-visible"
      data-node-id={ghost.nodeId}
      data-testid="canvas-selection-path-ghost"
    >
      <CanvasPathPreviewSvg bbox={ghost.bbox} paths={ghost.paths} />
    </div>
  );
};
