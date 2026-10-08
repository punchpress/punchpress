import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

// Mirrors react-infinite-viewer under the canvas adapter: every viewer move
// echoes synchronously through the scroll handler, which hands the camera to
// `syncViewportFromViewer`. The viewer rounds positions to 1/100 px, like a
// viewer whose applied camera differs from the request.
const mountViewer = (editor: Editor) => {
  let camera = { x: 0, y: 0, zoom: 1 };
  const calls: string[] = [];
  const round = (value: number) => Math.round(value * 100) / 100;
  const echo = () => {
    editor.syncViewportFromViewer();
  };
  const viewer = {
    getScrollLeft: () => camera.x,
    getScrollTop: () => camera.y,
    getZoom: () => camera.zoom,
    // A native wheel pan: the viewer moves itself, then emits scroll.
    nativeScrollTo: (x: number, y: number) => {
      camera = { ...camera, x: round(x), y: round(y) };
      echo();
    },
    scrollTo: (x: number, y: number) => {
      calls.push("scrollTo");
      camera = { ...camera, x: round(x), y: round(y) };
      echo();
    },
    setTo: (next) => {
      calls.push("setTo");
      // Intermediate echo before the zoom lands, like the vendor's setTo.
      camera = { ...camera, x: round(next.x) + 5 };
      echo();
      camera = { x: round(next.x), y: round(next.y), zoom: next.zoom };
      echo();
    },
  };

  editor.attachViewport({
    host: {
      getBoundingClientRect: () => ({
        height: 800,
        left: 0,
        top: 0,
        width: 1200,
      }),
    },
    viewer,
  });
  calls.length = 0;

  return { calls, viewer };
};

const countPresentations = (editor: Editor) => {
  const counter = { count: 0 };

  editor.subscribeViewportPresentation(() => {
    counter.count += 1;
  });

  return counter;
};

describe("viewport camera publication", () => {
  test("a discrete move publishes the applied camera once and writes the store", () => {
    const editor = new Editor();
    mountViewer(editor);
    const presentations = countPresentations(editor);

    editor.moveViewportTo({ x: 120.004, y: -40, zoom: 0.5 });

    expect(presentations.count).toBe(1);
    expect(editor.viewportInteracting).toBe(false);
    expect(editor.viewport).toEqual({ x: 120, y: -40, zoom: 0.5 });
    expect(editor.getState().viewport).toEqual({ x: 120, y: -40, zoom: 0.5 });
  });

  test("moves inside a held interaction stay off the store until release", () => {
    const editor = new Editor();
    const { calls } = mountViewer(editor);
    const presentations = countPresentations(editor);
    let storeWrites = 0;
    const unsubscribe = editor.store.subscribe((state, previous) => {
      if (state.viewport !== previous.viewport) {
        storeWrites += 1;
      }
    });

    editor.setViewportInteracting(true);
    editor.moveViewportTo({ x: 10, y: 10, zoom: 0.8 });
    editor.moveViewportTo({ x: 20, y: 10, zoom: 0.8 });
    editor.moveViewportTo({ x: 20, y: 10, zoom: 0.8 });

    expect(calls).toEqual(["setTo", "scrollTo"]);
    expect(presentations.count).toBe(2);
    expect(storeWrites).toBe(0);
    expect(editor.viewport).toEqual({ x: 20, y: 10, zoom: 0.8 });

    editor.setViewportInteracting(false);

    expect(storeWrites).toBe(1);
    expect(editor.getState().viewport).toEqual({ x: 20, y: 10, zoom: 0.8 });
    unsubscribe();
  });

  test("a native viewer scroll is a gesture that settles the store when idle", () => {
    const editor = new Editor();
    const { viewer } = mountViewer(editor);

    viewer.nativeScrollTo(300, 200);

    expect(editor.viewportInteracting).toBe(true);
    expect(editor.viewport).toEqual({ x: 300, y: 200, zoom: 1 });
    expect(editor.getState().viewport).toEqual({ x: 0, y: 0, zoom: 1 });

    // A late echo that leaves the camera in place is not a new gesture.
    expect(editor.syncViewportFromViewer()).toBe(false);

    editor.setViewportGestureActive(false);

    expect(editor.viewportInteracting).toBe(false);
    expect(editor.getState().viewport).toEqual({ x: 300, y: 200, zoom: 1 });
  });

  test("gesture idle never ends an explicit hold", () => {
    const editor = new Editor();
    const { viewer } = mountViewer(editor);

    editor.setViewportInteracting(true);
    viewer.nativeScrollTo(50, 0);
    editor.setViewportGestureActive(false);

    expect(editor.viewportInteracting).toBe(true);
    expect(editor.getState().viewport).toEqual({ x: 0, y: 0, zoom: 1 });

    editor.setViewportInteracting(false);

    expect(editor.getState().viewport).toEqual({ x: 50, y: 0, zoom: 1 });
  });

  test("zoom commands keep the viewport center fixed", () => {
    const editor = new Editor();
    const { viewer } = mountViewer(editor);
    viewer.getContainerWidth = () => 1200;
    viewer.getContainerHeight = () => 800;

    editor.moveViewportTo({ x: 100, y: 100, zoom: 1 });
    editor.zoomTo(2);

    // Center (700, 500) stays put: x = 700 - 600 / 2.
    expect(editor.viewport).toEqual({ x: 400, y: 300, zoom: 2 });
    expect(editor.getState().viewport).toEqual({ x: 400, y: 300, zoom: 2 });
  });

  test("detaching the viewer settles an open gesture", () => {
    const editor = new Editor();
    const { viewer } = mountViewer(editor);

    viewer.nativeScrollTo(80, 40);
    editor.detachViewport(viewer);

    expect(editor.viewportInteracting).toBe(false);
    expect(editor.viewerRef).toBeNull();
    expect(editor.getState().viewport).toEqual({ x: 80, y: 40, zoom: 1 });
  });

  test("reattaching a viewer with an unchanged camera refreshes camera readers", () => {
    const editor = new Editor();
    const { viewer } = mountViewer(editor);
    let overlayRefreshes = 0;

    editor.moveViewportTo({ x: 30, y: 20, zoom: 1 });
    // Returning to a tab: the canvas detaches, then a viewer already at the
    // stored camera reattaches.
    editor.detachViewport(viewer);
    editor.onViewportChange = () => {
      overlayRefreshes += 1;
    };
    const presentations = countPresentations(editor);

    editor.attachViewport({
      host: {
        getBoundingClientRect: () => ({
          height: 800,
          left: 0,
          top: 0,
          width: 1200,
        }),
      },
      viewer,
    });

    expect(editor.viewport).toEqual({ x: 30, y: 20, zoom: 1 });
    expect(presentations.count).toBe(1);
    expect(overlayRefreshes).toBe(1);
  });

  test("window blur settles a held interaction whose release never arrived", () => {
    const editor = new Editor();
    mountViewer(editor);

    editor.setViewportInteracting(true);
    editor.zoomTo(2);
    editor.handleWindowBlur();

    expect(editor.viewportInteracting).toBe(false);
    expect(editor.getState().viewport).toEqual(editor.viewport);
    expect(editor.getState().viewport.zoom).toBe(2);
  });
});
