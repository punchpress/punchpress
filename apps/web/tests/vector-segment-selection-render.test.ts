import { describe, expect, test } from "bun:test";
import paper from "paper";
import {
  createAnchorItem,
  createHandleItem,
  createHandleLine,
  createHoverHaloItem,
  refreshSegmentChrome,
  type VectorPaperSceneStyles,
  type VectorSegmentChrome,
} from "../src/components/canvas/canvas-overlay/vector-path/paper-session-render";

const createTestStyles = (scope: paper.PaperScope): VectorPaperSceneStyles => {
  return {
    anchorSelectedWidthPx: 2,
    anchorWidthPx: 1.5,
    handleLineWidthPx: 1,
    hoverHalo: new scope.Color("#6EA5FF"),
    indicatorWidthPx: 1.5,
    selected: new scope.Color("#165DFC"),
    shadow: new scope.Color(0, 0, 0, 0.18),
    surface: new scope.Color("#FFFFFF"),
    warning: new scope.Color("#EF4444"),
    warningSoft: new scope.Color("#FF7A93"),
    warningStrong: new scope.Color("#FF4568"),
  };
};

const createSegmentChrome = (
  scope: paper.PaperScope,
  styles: VectorPaperSceneStyles,
  point: paper.Point
): VectorSegmentChrome => {
  return {
    anchorHalo: createHoverHaloItem(scope, styles, point, 11),
    anchor: createAnchorItem(scope, styles, point),
    handleInHalo: createHoverHaloItem(scope, styles, point, 11),
    handleIn: createHandleItem(scope, styles, point),
    handleInLine: createHandleLine(scope, styles, point, point),
    handleOutHalo: createHoverHaloItem(scope, styles, point, 11),
    handleOut: createHandleItem(scope, styles, point),
    handleOutLine: createHandleLine(scope, styles, point, point),
  };
};

describe("vector segment selection render", () => {
  test("keeps the selected coincident anchor on top", () => {
    const scope = new paper.PaperScope();
    scope.setup(new scope.Size(100, 100));

    const styles = createTestStyles(scope);
    const point = new scope.Point(50, 50);
    const segment = new scope.Segment(
      point,
      new scope.Point(0, 0),
      new scope.Point(0, 0)
    );

    const selectedChrome = createSegmentChrome(scope, styles, point);
    const unselectedChrome = createSegmentChrome(scope, styles, point);

    refreshSegmentChrome(segment, selectedChrome, styles, true);
    refreshSegmentChrome(segment, unselectedChrome, styles, false);

    const topItem =
      scope.project.activeLayer.lastChild ??
      scope.project.activeLayer.children.at(-1);

    expect(topItem).toBe(selectedChrome.anchor);
    expect(selectedChrome.anchor.fillColor?.toCSS(true)).toBe(
      styles.selected.toCSS(true)
    );
    expect(unselectedChrome.anchor.fillColor?.toCSS(true)).toBe(
      styles.surface.toCSS(true)
    );
  });
});
