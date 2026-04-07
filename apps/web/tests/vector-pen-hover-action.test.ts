import { describe, expect, test } from "bun:test";
import { resolveVectorPenHoverAction } from "../src/components/canvas/canvas-overlay/vector-path/pen-hover";

describe("vector pen hover action", () => {
  test("maps hover intents to a user-facing label and cursor mode", () => {
    expect(
      resolveVectorPenHoverAction({
        contourIndex: 0,
        intent: "close",
        nodeId: "node",
        point: { x: 0, y: 0 },
        role: "anchor",
        segmentIndex: 0,
      })
    ).toEqual({
      cursorMode: "default",
      intent: "close",
      label: "Close Path",
    });

    expect(
      resolveVectorPenHoverAction({
        contourIndex: 0,
        intent: "delete",
        nodeId: "node",
        point: { x: 0, y: 0 },
        role: "anchor",
        segmentIndex: 1,
      })
    ).toEqual({
      cursorMode: "minus",
      intent: "delete",
      label: "Delete Point",
    });

    expect(
      resolveVectorPenHoverAction({
        contourIndex: 0,
        intent: "add",
        nodeId: "node",
        point: { x: 10, y: 10 },
        role: "segment",
        segmentIndex: 1,
      })
    ).toEqual({
      cursorMode: "add",
      intent: "add",
      label: "Add Point",
    });
  });
});
