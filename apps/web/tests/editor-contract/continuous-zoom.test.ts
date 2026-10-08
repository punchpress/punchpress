import { describe, expect, test } from "bun:test";
import { createDefaultShapeNode, Editor } from "@punchpress/engine";

const load = () => {
  const editor = new Editor();
  const node = createDefaultShapeNode("polygon");

  editor.getState().loadNodes([{ ...node, id: "a" }] as never);

  return editor;
};

const track = (editor: Editor) => {
  const events: string[] = [];

  editor.subscribeContinuousZoom(() => {
    events.push(editor.continuousZoom?.owner ?? "ended");
  });

  return events;
};

describe("continuous zoom", () => {
  test("a session ends once and requests one exact render", () => {
    const editor = load();
    const events = track(editor);
    const revision = editor.getContinuousZoomExactRenderRevision();
    const session = editor.beginContinuousZoom("pinch");

    // Repeated begins from the same owner continue the session.
    expect(editor.beginContinuousZoom("pinch")).toBe(session);
    expect(editor.endContinuousZoom(session, "end")).toBe(true);
    expect(editor.endContinuousZoom(session, "end")).toBe(false);
    expect(editor.continuousZoom).toBeNull();
    expect(editor.getContinuousZoomExactRenderRevision()).toBe(revision + 1);
    expect(events).toEqual(["pinch", "ended"]);
  });

  test("a stale token cannot end a newer session", () => {
    const editor = load();
    const wheel = editor.beginContinuousZoom("wheel");
    const scrub = editor.beginContinuousZoom("scrub");

    expect(editor.continuousZoom).toBe(scrub);
    expect(editor.endContinuousZoom(wheel, "idle")).toBe(false);
    expect(editor.continuousZoom).toBe(scrub);
  });

  test("discrete zoom, edits, and drags interrupt; camera moves do not", () => {
    const editor = load();

    editor.beginContinuousZoom("pinch");
    editor.getState().setViewport({ x: 10, y: 10, zoom: 0.5 });
    editor.setHoveredNode("a");

    expect(editor.continuousZoom?.owner).toBe("pinch");

    editor.zoomTo(2);

    expect(editor.continuousZoom).toBeNull();

    editor.beginContinuousZoom("scrub");
    editor.zoomTo(2, { continuous: true });

    expect(editor.continuousZoom?.owner).toBe("scrub");

    editor.updateNode("a", { opacity: 0.5 });

    expect(editor.continuousZoom).toBeNull();

    editor.beginContinuousZoom("wheel");
    editor.setSelectedNodes(["a"]);

    const session = editor.beginSelectionDrag({ nodeIds: ["a"] });

    editor.updateSelectionDrag(session, { delta: { x: 4, y: 0 } });

    expect(editor.continuousZoom).toBeNull();

    editor.endSelectionDrag(session, { cancel: true });
  });

  test("a continuous zoom leaves the store camera to its interaction", () => {
    const editor = load();
    const session = editor.beginContinuousZoom("pinch");
    const nodes = editor.nodes;

    editor.endContinuousZoom(session, "end");

    expect(editor.nodes).toBe(nodes);
    expect(editor.undo()).toBeFalsy();
  });
});
