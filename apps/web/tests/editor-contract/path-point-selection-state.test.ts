import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

describe("path point selection state", () => {
  test("setPathEditingPoints dedupes points and preserves an explicit primary point", () => {
    const editor = new Editor();

    editor.setPathEditingPoints(
      [
        {
          contourIndex: 0,
          segmentIndex: 1,
        },
        {
          contourIndex: 0,
          segmentIndex: 1,
        },
      ],
      {
        contourIndex: 0,
        segmentIndex: 2,
      }
    );

    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 2,
    });
    expect(editor.pathEditingPoints).toEqual([
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
      {
        contourIndex: 0,
        segmentIndex: 2,
      },
    ]);
  });
});
