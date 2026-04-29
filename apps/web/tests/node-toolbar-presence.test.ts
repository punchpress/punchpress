import { describe, expect, test } from "bun:test";
import { getRenderedSelectionToolbarActions } from "../src/components/canvas/canvas-overlay/toolbar/selection-toolbar";

const createAction = (id: string, title = id) => {
  return {
    id,
    isActive: false,
    label: title,
    onSelect: () => undefined,
    title,
    variant: "ghost" as const,
  };
};

describe("selection toolbar presence", () => {
  test("prefers the current action set while the toolbar remains visible", () => {
    const renderedActions = getRenderedSelectionToolbarActions(
      [createAction("clear-path-selection"), createAction("delete-point")],
      {
        actions: [
          createAction("split-path"),
          createAction("delete-point"),
          createAction("set-point-corner"),
          createAction("set-point-smooth"),
          createAction("clear-path-selection"),
        ],
        phase: "open" as const,
      }
    );

    expect(renderedActions.map((action) => action.id)).toEqual([
      "clear-path-selection",
      "delete-point",
    ]);
  });

  test("preserves the last visible action set while the toolbar closes", () => {
    const renderedActions = getRenderedSelectionToolbarActions([], {
      actions: [
        createAction("clear-path-selection"),
        createAction("delete-point"),
      ],
      phase: "closing" as const,
    });

    expect(renderedActions.map((action) => action.id)).toEqual([
      "clear-path-selection",
      "delete-point",
    ]);
  });
});
