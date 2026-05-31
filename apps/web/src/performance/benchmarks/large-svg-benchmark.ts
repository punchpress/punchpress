import {
  incrementPerfCounter,
  measurePerf,
  PERF_COUNTERS,
  PERF_SPANS,
} from "@punchpress/engine";
import { saveDesignDocument } from "@punchpress/punch-schema";
import { importSvgToNodes } from "../../platform/svg-import-document";
import type { PerformanceBenchmarkDefinition } from "../performance-benchmark-types";

const LARGE_SVG_URL = "/performance/large-svg.svg";

let largeSvgSourcePromise: Promise<string> | null = null;

const getLargeSvgSource = () => {
  largeSvgSourcePromise ??= fetch(LARGE_SVG_URL).then((response) => {
    if (!response.ok) {
      throw new Error(`Unable to load large SVG fixture: ${response.status}`);
    }

    return response.text();
  });

  return largeSvgSourcePromise;
};

export const recordLargeSvgStats = (editor) => {
  const pathNodeCount = editor.nodes.filter(
    (node) => node.type === "path"
  ).length;
  const groupNodeCount = editor.nodes.filter(
    (node) => node.type === "group"
  ).length;
  const canvasNodeCount =
    typeof document === "undefined"
      ? 0
      : document.querySelectorAll(".canvas-node").length;
  const imageSurfaceCount =
    typeof document === "undefined"
      ? 0
      : document.querySelectorAll(".canvas-node-layer image").length;
  const rasterSurfaceCount =
    typeof document === "undefined"
      ? 0
      : document.querySelectorAll(
          '.canvas-node-layer image[data-render-surface="raster"]'
        ).length;
  const renderedPathCount =
    typeof document === "undefined"
      ? 0
      : document.querySelectorAll(".canvas-node-layer svg path").length;

  incrementPerfCounter(PERF_COUNTERS.largeSvgTotalNodes, editor.nodes.length);
  incrementPerfCounter(PERF_COUNTERS.largeSvgPathNodes, pathNodeCount);
  incrementPerfCounter(PERF_COUNTERS.largeSvgGroupNodes, groupNodeCount);
  incrementPerfCounter(PERF_COUNTERS.largeSvgCanvasNodes, canvasNodeCount);
  incrementPerfCounter(PERF_COUNTERS.largeSvgImageSurfaces, imageSurfaceCount);
  incrementPerfCounter(
    PERF_COUNTERS.largeSvgRasterSurfaces,
    rasterSurfaceCount
  );
  incrementPerfCounter(PERF_COUNTERS.largeSvgRenderedPaths, renderedPathCount);
};

export const loadLargeSvgDocument = async (editor) => {
  const svg = await getLargeSvgSource();
  const nodes = measurePerf(PERF_SPANS.importSvgParse, () =>
    importSvgToNodes(svg, {
      targetCenter: { x: 2250, y: 2700 },
    })
  );

  measurePerf(PERF_SPANS.documentLoadApply, () => {
    editor.loadDocument(saveDesignDocument(nodes).contents);
  });

  return nodes[0]?.id || null;
};

const getLargeSvgRootId = (editor) => {
  const rootId = editor.layerNodeIds[0];

  if (!rootId) {
    throw new Error("Large SVG benchmark did not create a root node.");
  }

  return rootId;
};

const setupLargeSvgDocument = async (
  { editor, waitForFrames },
  {
    selectRoot = false,
    viewport,
    warmupFrames = 12,
  }: {
    selectRoot?: boolean;
    viewport: { x: number; y: number; zoom: number };
    warmupFrames?: number;
  }
) => {
  const rootId = await loadLargeSvgDocument(editor);

  if (!rootId) {
    throw new Error("Large SVG benchmark did not create a root node.");
  }

  if (selectRoot) {
    editor.setSelectedNodes([rootId]);
  }

  editor.setViewport(viewport);
  await waitForFrames(warmupFrames);

  return rootId;
};

const getDragPathPoint = (
  index: number,
  {
    frames,
    stepX,
    stepY,
  }: {
    frames: number;
    stepX: number;
    stepY: number;
  }
) => {
  const progress = Math.min(1, Math.max(0, index / Math.max(1, frames)));
  const phase = progress * Math.PI * 2;

  return {
    x: Math.cos(phase * 1.08) * stepX * 20 + Math.sin(phase * 0.7) * stepX * 5,
    y: Math.sin(phase * 0.96) * stepY * 24 + Math.cos(phase * 1.2) * stepY * 4,
  };
};

export const largeSvgPointerDragBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 160,
    nodeCount: 0,
    stepX: 9,
    stepY: 4,
    warmupFrames: 12,
  },
  description:
    "Loads the large SVG fixture and drags it through the canvas pointer-event path.",
  id: "large-svg-pointer-drag",
  label: "Large SVG Pointer Drag",
  setup: (context) =>
    setupLargeSvgDocument(context, {
      selectRoot: true,
      viewport: { x: 550, y: 1000, zoom: 0.12 },
    }),
  run: async ({ editor, options, waitForFrame }) => {
    recordLargeSvgStats(editor);

    const rootId = editor.selectedNodeIds[0];
    const nodeElement =
      document.querySelector(`.canvas-node[data-node-id="${rootId}"]`) ||
      document.querySelector(".canvas-node");

    if (!(nodeElement instanceof HTMLElement)) {
      throw new Error("Unable to find large SVG canvas node.");
    }

    const rect = nodeElement.getBoundingClientRect();
    const origin = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    const pointerId = 1;
    const dispatchPointerEvent = (
      target: EventTarget,
      type: "pointerdown" | "pointermove" | "pointerup",
      point: { x: number; y: number }
    ) => {
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
          cancelable: true,
          clientX: point.x,
          clientY: point.y,
          pointerId,
          pointerType: "mouse",
        })
      );
    };

    dispatchPointerEvent(nodeElement, "pointerdown", origin);

    try {
      for (let index = 0; index < options.frames; index += 1) {
        await waitForFrame();

        const point = getDragPathPoint(index + 1, options);
        dispatchPointerEvent(window, "pointermove", {
          x: origin.x + point.x,
          y: origin.y + point.y,
        });
      }
    } finally {
      dispatchPointerEvent(window, "pointerup", origin);
    }
  },
  usesScratchDocument: true,
};

export const largeSvgViewportBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 160,
    nodeCount: 0,
    stepX: 18,
    stepY: 7,
    warmupFrames: 12,
  },
  description:
    "Loads the large SVG fixture and changes viewport pan and zoom for a deterministic 160-frame pass.",
  id: "large-svg-viewport",
  label: "Large SVG Viewport",
  setup: (context) =>
    setupLargeSvgDocument(context, {
      selectRoot: true,
      viewport: { x: 550, y: 1000, zoom: 0.18 },
    }),
  run: async ({ editor, options, waitForFrame }) => {
    recordLargeSvgStats(editor);

    const startViewport = editor.viewport;

    editor.setViewportInteracting(true);

    try {
      for (let index = 0; index < options.frames; index += 1) {
        await waitForFrame();

        const point = getDragPathPoint(index, options);
        const progress = index / Math.max(1, options.frames - 1);
        const zoom = 0.18 - progress * 0.08;

        editor.setViewport({
          x: startViewport.x + point.x,
          y: startViewport.y + point.y,
          zoom,
        });
        editor.onViewportChange?.();
      }
    } finally {
      editor.setViewportInteracting(false);
    }
  },
  usesScratchDocument: true,
};

export const largeSvgResizeBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 120,
    nodeCount: 0,
    stepX: 0,
    stepY: 0,
    warmupFrames: 12,
  },
  description:
    "Loads the large SVG fixture and resizes the selected root group through the editor resize session path.",
  id: "large-svg-resize",
  label: "Large SVG Resize",
  setup: (context) =>
    setupLargeSvgDocument(context, {
      selectRoot: true,
      viewport: { x: 550, y: 1000, zoom: 0.14 },
    }),
  run: async ({ editor, options, waitForFrame }) => {
    recordLargeSvgStats(editor);

    const rootId = editor.selectedNodeIds[0];
    const frame = rootId ? editor.getSelectionTransformFrame([rootId]) : null;
    const bounds = frame?.bounds;

    if (!(rootId && bounds)) {
      throw new Error("Unable to find large SVG transform bounds.");
    }

    const session = editor.beginResizeSelection({
      anchorCanvas: { x: bounds.minX, y: bounds.minY },
      direction: [1, 1],
      nodeIds: [rootId],
    });

    if (!session) {
      throw new Error("Unable to start large SVG resize benchmark session.");
    }

    for (let index = 0; index < options.frames; index += 1) {
      await waitForFrame();

      const progress = index / Math.max(1, options.frames - 1);
      const wave = Math.sin(progress * Math.PI * 2);
      const scale = 1 + wave * 0.08;

      editor.updateResizeSelection(session, { scale });
    }

    editor.commitResizeSelection(session);
  },
  usesScratchDocument: true,
};

export const largeSvgRotateBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 120,
    nodeCount: 0,
    stepX: 0,
    stepY: 0,
    warmupFrames: 12,
  },
  description:
    "Loads the large SVG fixture and rotates the selected root group through the editor rotation session path.",
  id: "large-svg-rotate",
  label: "Large SVG Rotate",
  setup: (context) =>
    setupLargeSvgDocument(context, {
      selectRoot: true,
      viewport: { x: 550, y: 1000, zoom: 0.1 },
    }),
  run: async ({ editor, options, waitForFrame }) => {
    recordLargeSvgStats(editor);

    const rootId = editor.selectedNodeIds[0];
    const frame = rootId ? editor.getSelectionTransformFrame([rootId]) : null;

    if (!(rootId && frame?.bounds)) {
      throw new Error("Unable to find large SVG transform bounds.");
    }

    const session = editor.beginRotateSelection({
      nodeIds: [rootId],
    });

    if (!session) {
      throw new Error("Unable to start large SVG rotate benchmark session.");
    }

    for (let index = 0; index < options.frames; index += 1) {
      await waitForFrame();

      const progress = index / Math.max(1, options.frames - 1);
      const wave = Math.sin(progress * Math.PI * 2);

      editor.updateRotateSelection(session, { deltaRotation: wave * 28 });
    }

    editor.commitRotateSelection(session);
  },
  usesScratchDocument: true,
};

export const largeSvgSelectBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 12,
    nodeCount: 0,
    stepX: 0,
    stepY: 0,
    warmupFrames: 4,
  },
  description:
    "Loads the large SVG fixture and measures root selection/property color aggregation.",
  id: "large-svg-select",
  label: "Large SVG Select",
  setup: (context) =>
    setupLargeSvgDocument(context, {
      viewport: { x: 550, y: 1000, zoom: 0.18 },
    }),
  run: async ({ editor, options, waitForFrame }) => {
    recordLargeSvgStats(editor);

    const rootId = getLargeSvgRootId(editor);

    for (let index = 0; index < options.frames; index += 1) {
      editor.setSelectedNodes([]);
      editor.setSelectedNodes([rootId]);
      editor.getSelectionProperties();
      await waitForFrame();
    }
  },
  usesScratchDocument: true,
};

const getBenchmarkSelectionColor = (editor) => {
  const selectionColor = editor.getSelectionProperties().selectionColors[0];

  if (!selectionColor) {
    throw new Error("Large SVG benchmark did not expose selection colors.");
  }

  return selectionColor;
};

export const largeSvgSelectionColorBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 60,
    nodeCount: 0,
    stepX: 0,
    stepY: 0,
    warmupFrames: 8,
  },
  description:
    "Loads the large SVG fixture and scrubs a selection color through the editor color mutation path.",
  id: "large-svg-selection-color",
  label: "Large SVG Selection Color",
  setup: async (context) => {
    await setupLargeSvgDocument(context, {
      selectRoot: true,
      viewport: { x: 550, y: 1000, zoom: 0.18 },
    });
    getBenchmarkSelectionColor(context.editor);
  },
  run: async ({ editor, options, waitForFrame }) => {
    recordLargeSvgStats(editor);
    const selectionColor = getBenchmarkSelectionColor(editor);
    const session = editor.beginSelectionColorChange(selectionColor.id);

    if (!session) {
      throw new Error("Unable to begin large SVG selection color session.");
    }

    let nextColor = selectionColor.value;
    for (let index = 0; index < options.frames; index += 1) {
      const progress = index / Math.max(1, options.frames - 1);
      const red = Math.round(0x20 + progress * 0xcf)
        .toString(16)
        .padStart(2, "0");
      nextColor = `#${red}99b8`;

      editor.updateSelectionColorChange(session, nextColor);
      await waitForFrame();
    }

    editor.commitSelectionColorChange(session, nextColor);
  },
  usesScratchDocument: true,
};

export const largeSvgHoverBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 24,
    nodeCount: 0,
    stepX: 0,
    stepY: 0,
    warmupFrames: 4,
  },
  description:
    "Loads the large SVG fixture and measures hover enter/leave state updates.",
  id: "large-svg-hover",
  label: "Large SVG Hover",
  setup: (context) =>
    setupLargeSvgDocument(context, {
      viewport: { x: 550, y: 1000, zoom: 0.18 },
    }),
  run: async ({ editor, options, waitForFrame }) => {
    recordLargeSvgStats(editor);

    const rootId = getLargeSvgRootId(editor);

    for (let index = 0; index < options.frames; index += 1) {
      editor.setHoveredNode(rootId);
      editor.getHoveredNodePreview();
      editor.setHoveredNode(null);
      editor.getHoveredNodePreview();
      await waitForFrame();
    }
  },
  usesScratchDocument: true,
};

export const largeSvgDeselectBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 24,
    nodeCount: 0,
    stepX: 0,
    stepY: 0,
    warmupFrames: 4,
  },
  description:
    "Loads the large SVG fixture and measures clearing a selected root vector.",
  id: "large-svg-deselect",
  label: "Large SVG Deselect",
  setup: (context) =>
    setupLargeSvgDocument(context, {
      selectRoot: true,
      viewport: { x: 550, y: 1000, zoom: 0.18 },
    }),
  run: async ({ editor, options, waitForFrame }) => {
    recordLargeSvgStats(editor);

    const rootId = getLargeSvgRootId(editor);

    for (let index = 0; index < options.frames; index += 1) {
      editor.clearSelection();
      editor.getSelectionProperties();
      editor.setSelectedNodes([rootId]);
      await waitForFrame();
    }
  },
  usesScratchDocument: true,
};

const findEmptyCanvasPoint = () => {
  if (typeof document === "undefined") {
    return null;
  }

  const minX = 48;
  const maxX = window.innerWidth - 48;
  const minY = 48;
  const maxY = window.innerHeight - 48;

  for (let x = minX; x <= maxX; x += 64) {
    for (let y = minY; y <= maxY; y += 64) {
      const target = document.elementFromPoint(x, y);

      if (
        target instanceof Element &&
        target.closest(".canvas-surface, .canvas-vector-paper") &&
        !target.closest(
          [
            "[data-node-id]",
            ".canvas-moveable",
            ".canvas-selection-toolbar",
            "aside",
          ].join(",")
        )
      ) {
        return { x, y };
      }
    }
  }

  return null;
};

export const largeSvgPointerDeselectBenchmark: PerformanceBenchmarkDefinition =
  {
    defaultOptions: {
      frames: 24,
      nodeCount: 0,
      stepX: 0,
      stepY: 0,
      warmupFrames: 4,
    },
    description:
      "Loads the large SVG fixture and measures deselecting it through an empty-canvas pointer click.",
    id: "large-svg-pointer-deselect",
    label: "Large SVG Pointer Deselect",
    setup: (context) =>
      setupLargeSvgDocument(context, {
        selectRoot: true,
        viewport: { x: 550, y: 1000, zoom: 0.18 },
      }),
    run: async ({ editor, options, waitForFrame }) => {
      recordLargeSvgStats(editor);

      const rootId = getLargeSvgRootId(editor);
      const point = findEmptyCanvasPoint();

      if (!point) {
        throw new Error("Unable to find empty canvas point.");
      }

      const dispatchPointerEvent = (type: "pointerdown" | "pointerup") => {
        const target = document.elementFromPoint(point.x, point.y);

        if (!target) {
          throw new Error("Unable to find empty canvas target.");
        }

        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            button: 0,
            buttons: type === "pointerup" ? 0 : 1,
            cancelable: true,
            clientX: point.x,
            clientY: point.y,
            pointerId: 1,
            pointerType: "mouse",
          })
        );
      };

      for (let index = 0; index < options.frames; index += 1) {
        editor.setSelectedNodes([rootId]);
        await waitForFrame();

        dispatchPointerEvent("pointerdown");
        dispatchPointerEvent("pointerup");
        await waitForFrame();
      }
    },
    usesScratchDocument: true,
  };

export const largeSvgTextDeselectBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 24,
    nodeCount: 0,
    stepX: 0,
    stepY: 0,
    warmupFrames: 4,
  },
  description:
    "Loads the large SVG fixture and measures clearing selection from a simple text node while the SVG remains visible.",
  id: "large-svg-text-deselect",
  label: "Large SVG Text Deselect",
  setup: async (context) => {
    const { editor, waitForFrames } = context;
    await setupLargeSvgDocument(context, {
      viewport: { x: 550, y: 1000, zoom: 0.18 },
      warmupFrames: 0,
    });
    editor.addTextNode({ x: 900, y: 900 });
    editor.finalizeEditing();
    await waitForFrames(12);
  },
  run: async ({ editor, options, waitForFrame }) => {
    recordLargeSvgStats(editor);

    const textNode = editor.nodes.find((node) => node.type === "text");

    if (!textNode) {
      throw new Error("Large SVG benchmark did not create a text node.");
    }

    for (let index = 0; index < options.frames; index += 1) {
      editor.setSelectedNodes([textNode.id]);
      await waitForFrame();

      editor.clearSelection();
      editor.getSelectionProperties();
      await waitForFrame();
    }
  },
  usesScratchDocument: true,
};
