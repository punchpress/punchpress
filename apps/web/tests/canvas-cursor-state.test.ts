import { describe, expect, test } from "bun:test";
import {
  getActiveCanvasCursorCompanion,
  setActiveCanvasCursorCompanion,
} from "../src/components/canvas/canvas-cursor-policy";
import { getCanvasCursorCompanion } from "../src/components/canvas/canvas-cursor-state";

describe("canvas cursor state", () => {
  test("reads the active cursor companion from the host element dataset", () => {
    const hostElement = {
      dataset: {},
    } as {
      dataset: Record<string, string | undefined>;
    };

    setActiveCanvasCursorCompanion(hostElement, {
      kind: "label",
      offsetX: 28,
      offsetY: -28,
      text: "Snap to Point",
    });

    expect(getActiveCanvasCursorCompanion(hostElement)).toEqual({
      kind: "label",
      offsetX: 28,
      offsetY: -28,
      text: "Snap to Point",
    });

    expect(
      getCanvasCursorCompanion(
        {
          hostRef: hostElement,
          getPenHoverState: () => null,
        },
        {
          activeTool: "pointer",
          pathEditingNodeId: "vector-node",
          spacePressed: false,
        }
      )
    ).toEqual({
      kind: "label",
      offsetX: 28,
      offsetY: -28,
      text: "Snap to Point",
    });
  });

  test("clears the active cursor companion dataset", () => {
    const hostElement = {
      dataset: {},
    } as {
      dataset: Record<string, string | undefined>;
    };

    setActiveCanvasCursorCompanion(hostElement, {
      kind: "label",
      text: "Close Path",
    });
    setActiveCanvasCursorCompanion(hostElement, null);

    expect(getActiveCanvasCursorCompanion(hostElement)).toBeNull();
  });
});
