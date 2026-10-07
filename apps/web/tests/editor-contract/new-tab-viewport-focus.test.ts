import { afterEach, describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const globalWithWindow = globalThis as typeof globalThis & { window?: any };
const originalWindow = globalWithWindow.window;

afterEach(() => {
  globalWithWindow.window = originalWindow;
});

const installFakeRaf = () => {
  const queue: Array<() => void> = [];
  globalWithWindow.window = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    requestAnimationFrame: (cb: () => void) => {
      queue.push(cb);
      return queue.length;
    },
    cancelAnimationFrame: () => undefined,
  };
  return {
    tick: () => {
      const cbs = queue.splice(0, queue.length);
      for (const cb of cbs) {
        cb();
      }
    },
  };
};

const ARTBOARD_WIDTH = 4500;
const ARTBOARD_HEIGHT = 5400;

const createEditorWithArtboard = () => {
  const editor = new Editor();
  let nodeId: string | null = null;

  editor.run(() => {
    nodeId = editor.getState().addArtboardNode(
      { x: 0, y: 0 },
      {
        patch: {
          height: ARTBOARD_HEIGHT,
          name: "Amazon Merch",
          width: ARTBOARD_WIDTH,
        },
      }
    );
  });

  return { editor, nodeId: nodeId as unknown as string };
};

const mountFakeViewport = (editor: Editor) => {
  (editor as any).viewerRef = {
    setTo: () => undefined,
    setZoom: () => undefined,
  };
  (editor as any).hostRef = {
    getBoundingClientRect: () => ({ height: 800, width: 1200 }),
  };
};

describe("new-tab viewport focus", () => {
  test("focus scheduled before the canvas mounts applies once the viewer exists", () => {
    const raf = installFakeRaf();
    const { editor, nodeId } = createEditorWithArtboard();

    editor.scheduleViewportFocus([nodeId], {
      paddingX: ARTBOARD_WIDTH * 0.1,
      paddingY: ARTBOARD_HEIGHT * 0.1,
    });

    raf.tick();
    raf.tick();

    mountFakeViewport(editor);

    for (let i = 0; i < 130; i++) {
      raf.tick();
    }

    // True fit for a 4500x5400 artboard in a 1200x800 host is ~0.123.
    expect(editor.zoom).toBeLessThan(0.2);
  });

  test("degenerate selection bounds during mount do not satisfy the focus request", () => {
    const raf = installFakeRaf();
    const { editor, nodeId } = createEditorWithArtboard();

    // Simulate the mount race observed in the app: the artboard's geometry
    // reports ready while its selection frame still measures as a zero-size
    // rect at the artboard center for the first few frames.
    const realGetNodeSelectionFrame = (
      editor as any
    ).getNodeSelectionFrame.bind(editor);
    const centerX = ARTBOARD_WIDTH / 2;
    const centerY = ARTBOARD_HEIGHT / 2;
    let degenerateFrames = 5;
    (editor as any).getNodeSelectionFrame = (frameNodeId: string) => {
      if (degenerateFrames > 0) {
        degenerateFrames -= 1;
        return {
          bounds: {
            maxX: centerX,
            maxY: centerY,
            minX: centerX,
            minY: centerY,
          },
        };
      }

      return realGetNodeSelectionFrame(frameNodeId);
    };

    editor.scheduleViewportFocus([nodeId], {
      paddingX: ARTBOARD_WIDTH * 0.1,
      paddingY: ARTBOARD_HEIGHT * 0.1,
    });

    mountFakeViewport(editor);

    for (let i = 0; i < 130; i++) {
      raf.tick();
    }

    // The request must hold out for measurable bounds instead of fitting a
    // zero-size rect (which leaves the artboard out of view). True fit ~0.123.
    expect(editor.zoom).toBeLessThan(0.2);
  });
});
