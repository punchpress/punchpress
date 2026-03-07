import { useCallback, useEffect, useRef, useState } from "react";
import {
  ARTBOARD_HEIGHT,
  ARTBOARD_WIDTH,
  MAX_ZOOM,
  MIN_ZOOM,
} from "../editor/constants";
import { clamp, round } from "../editor/math-utils";
import { useSpacePan } from "./use-space-pan";

export const useEditorCanvas = (
  setNodes,
  setSelectedNodeId,
  handToolActive
) => {
  const workspaceRef = useRef(null);
  const interactionRef = useRef(null);
  const spacePressedRef = useRef(false);
  const centeredOnceRef = useRef(false);
  const viewportRef = useRef({ zoom: 0.12, pan: { x: 0, y: 0 } });

  const [zoom, setZoom] = useState(0.12);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  useSpacePan(setSpacePressed, spacePressedRef);

  useEffect(() => {
    viewportRef.current = { zoom, pan };
  }, [pan, zoom]);

  useEffect(() => {
    const workspaceElement = workspaceRef.current;
    if (!workspaceElement) {
      return undefined;
    }

    const centerArtboard = () => {
      if (centeredOnceRef.current) {
        return;
      }

      const bounds = workspaceElement.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) {
        return;
      }

      setPan({
        x: (bounds.width - ARTBOARD_WIDTH * zoom) / 2,
        y: (bounds.height - ARTBOARD_HEIGHT * zoom) / 2,
      });
      centeredOnceRef.current = true;
    };

    centerArtboard();

    const observer = new ResizeObserver(centerArtboard);
    observer.observe(workspaceElement);

    return () => {
      observer.disconnect();
    };
  }, [zoom]);

  const getCanvasPointFromClient = useCallback((clientX, clientY) => {
    const workspaceElement = workspaceRef.current;
    if (!workspaceElement) {
      return { x: 0, y: 0 };
    }

    const rect = workspaceElement.getBoundingClientRect();
    const viewport = viewportRef.current;

    return {
      x: (clientX - rect.left - viewport.pan.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.pan.y) / viewport.zoom,
    };
  }, []);

  useEffect(() => {
    const onPointerMove = (event) => {
      const interaction = interactionRef.current;
      if (!interaction) {
        return;
      }

      if (interaction.kind === "pan") {
        setPan({
          x: interaction.startPanX + (event.clientX - interaction.startX),
          y: interaction.startPanY + (event.clientY - interaction.startY),
        });
        return;
      }

      if (interaction.kind !== "drag") {
        return;
      }

      const point = getCanvasPointFromClient(event.clientX, event.clientY);
      setNodes((currentNodes) => {
        return currentNodes.map((node) => {
          if (node.id !== interaction.nodeId) {
            return node;
          }

          return {
            ...node,
            x: round(point.x - interaction.offsetX, 2),
            y: round(point.y - interaction.offsetY, 2),
          };
        });
      });
    };

    const onPointerUp = () => {
      interactionRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [getCanvasPointFromClient, setNodes]);

  const zoomAtPoint = useCallback((factor, screenX, screenY) => {
    setZoom((currentZoom) => {
      const nextZoom = clamp(currentZoom * factor, MIN_ZOOM, MAX_ZOOM);
      if (nextZoom === currentZoom) {
        return currentZoom;
      }

      setPan((currentPan) => {
        const worldX = (screenX - currentPan.x) / currentZoom;
        const worldY = (screenY - currentPan.y) / currentZoom;

        return {
          x: screenX - worldX * nextZoom,
          y: screenY - worldY * nextZoom,
        };
      });

      return nextZoom;
    });
  }, []);

  const zoomFromClientPoint = useCallback(
    (factor, clientX, clientY) => {
      const workspaceElement = workspaceRef.current;
      if (!workspaceElement) {
        return;
      }

      const rect = workspaceElement.getBoundingClientRect();
      const insideWorkspace =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;

      if (insideWorkspace) {
        zoomAtPoint(factor, clientX - rect.left, clientY - rect.top);
        return;
      }

      zoomAtPoint(factor, rect.width / 2, rect.height / 2);
    },
    [zoomAtPoint]
  );

  const handleWheel = useCallback(
    (event) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0012);
      zoomFromClientPoint(factor, event.clientX, event.clientY);
    },
    [zoomFromClientPoint]
  );

  useEffect(() => {
    const onBrowserZoomGesture = (event) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (event.defaultPrevented) {
        return;
      }

      const workspaceElement = workspaceRef.current;
      if (!workspaceElement) {
        return;
      }

      const shellElement = workspaceElement.closest(".editor-shell");
      if (!shellElement?.contains(event.target)) {
        return;
      }

      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0012);
      zoomFromClientPoint(factor, event.clientX, event.clientY);
    };

    window.addEventListener("wheel", onBrowserZoomGesture, {
      passive: false,
    });

    return () => {
      window.removeEventListener("wheel", onBrowserZoomGesture);
    };
  }, [zoomFromClientPoint]);

  const handleWorkspacePointerDown = useCallback(
    (event) => {
      const shouldStartPan =
        event.button === 1 ||
        (event.button === 0 &&
          (spacePressedRef.current || Boolean(handToolActive)));

      if (!shouldStartPan) {
        return;
      }

      event.preventDefault();
      interactionRef.current = {
        kind: "pan",
        startX: event.clientX,
        startY: event.clientY,
        startPanX: viewportRef.current.pan.x,
        startPanY: viewportRef.current.pan.y,
      };
    },
    [handToolActive]
  );

  const handleNodePointerDown = useCallback(
    (event, node) => {
      if (event.button !== 0 || spacePressedRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setSelectedNodeId(node.id);

      const point = getCanvasPointFromClient(event.clientX, event.clientY);
      interactionRef.current = {
        kind: "drag",
        nodeId: node.id,
        offsetX: point.x - node.x,
        offsetY: point.y - node.y,
      };
    },
    [getCanvasPointFromClient, setSelectedNodeId]
  );

  const handleCanvasBackgroundPointerDown = useCallback(
    (event) => {
      if (event.button !== 0 || spacePressedRef.current) {
        return;
      }
      setSelectedNodeId(null);
    },
    [setSelectedNodeId]
  );

  const applyToolbarZoom = useCallback(
    (factor) => {
      const workspaceElement = workspaceRef.current;
      if (!workspaceElement) {
        return;
      }

      const bounds = workspaceElement.getBoundingClientRect();
      zoomAtPoint(factor, bounds.width / 2, bounds.height / 2);
    },
    [zoomAtPoint]
  );

  return {
    workspaceRef,
    zoom,
    pan,
    spacePressed,
    handleWheel,
    handleWorkspacePointerDown,
    handleNodePointerDown,
    handleCanvasBackgroundPointerDown,
    applyToolbarZoom,
  };
};
