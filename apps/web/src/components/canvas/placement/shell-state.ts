// A placed shell's durable world placement: its unrotated frame box, and the
// node's own transform on the inner element.
export interface NodeShellState {
  // Shells whose own art has active effects stay on their own compositing
  // layer; other shells translate in 2D and paint into their parent layer.
  composited: boolean;
  height: number;
  transform: string;
  transformOrigin: string;
  width: number;
  x: number;
  y: number;
}

export interface PlacementElements {
  shellElement: HTMLElement;
  transformElement: HTMLElement;
}

export const getNodeShellState = (editor, nodeId): NodeShellState | null => {
  const node = editor.getNode(nodeId);
  const frame =
    (editor.editingNodeId === nodeId && editor.editingRenderFrame) ||
    editor.getNodeRenderFrame(nodeId);

  if (!(frame && node)) {
    return null;
  }

  const writableBounds = editor.getRasterWritableBounds(nodeId);
  const bounds = writableBounds
    ? {
        height: writableBounds.height,
        minX: (node.transform?.x || 0) + writableBounds.x,
        minY: (node.transform?.y || 0) + writableBounds.y,
        width: writableBounds.width,
      }
    : frame.bounds;
  const transformOrigin = writableBounds
    ? `${node.width / 2 - writableBounds.x}px ${
        node.height / 2 - writableBounds.y
      }px`
    : "center center";

  return {
    composited: hasOwnActiveEffects(node),
    height: Math.max(1, bounds.height),
    transform: frame.transform || "",
    transformOrigin,
    width: Math.max(1, bounds.width),
    x: bounds.minX,
    y: bounds.minY,
  };
};

export const getShellKey = (shellState: NodeShellState | null) => {
  if (!shellState) {
    return "null";
  }

  return [
    shellState.width,
    shellState.height,
    shellState.x,
    shellState.y,
    shellState.transform,
    shellState.transformOrigin,
    shellState.composited,
  ].join(":");
};

export const getPlacementElements = (
  editor,
  nodeId: string
): PlacementElements | null => {
  const transformElement = editor.getNodeElement(nodeId);

  if (!transformElement) {
    return null;
  }

  const shellElement =
    transformElement.parentElement instanceof HTMLElement &&
    transformElement.parentElement.dataset.nodeShell === "true"
      ? transformElement.parentElement
      : transformElement;

  return {
    shellElement,
    transformElement,
  };
};

export const applyNodeShellState = (
  { shellElement, transformElement }: PlacementElements,
  shellState: NodeShellState | null
) => {
  shellElement.style.transformOrigin = "";
  shellElement.style.willChange = "";

  if (!shellState) {
    shellElement.style.width = "0px";
    shellElement.style.height = "0px";
    shellElement.style.transform = "translate(0px, 0px)";
    transformElement.style.transform = "";
    transformElement.style.transformOrigin = "";
    return;
  }

  const { x, y } = shellState;

  shellElement.style.width = `${shellState.width}px`;
  shellElement.style.height = `${shellState.height}px`;
  shellElement.style.transform = shellState.composited
    ? `translate3d(${x}px, ${y}px, 0)`
    : `translate(${x}px, ${y}px)`;
  transformElement.style.transform = shellState.transform || "";
  transformElement.style.transformOrigin = shellState.transformOrigin;
};

// Group effects live on render layers, so a dense surface's own group
// shadow never promotes its shell.
const hasOwnActiveEffects = (node) => {
  return Boolean(
    node.type !== "group" &&
      node.effects?.some((effect) => effect.enabled && effect.opacity > 0)
  );
};
