import type {
  RasterOperation,
  RasterPoint,
  RasterStrokeSettings,
} from "../raster/contracts";
import { DEFAULT_BRUSH_SETTINGS } from "./brush-settings";
import { RasterStrokeRuntime } from "./raster-stroke-runtime";
import { selectToolFromShortcut, Tool } from "./tool";

type BrushPointerInput = {
  point: RasterPoint;
};

export class BrushTool extends Tool {
  readonly operation: RasterOperation;
  readonly runtime: RasterStrokeRuntime;

  constructor(
    editor,
    runtime: RasterStrokeRuntime,
    operation: RasterOperation = "paint"
  ) {
    super(editor);
    this.operation = operation;
    this.runtime = runtime;
  }

  get activeSession() {
    return this.runtime.activeSession;
  }

  getSettings(): RasterStrokeSettings {
    const state = this.editor.getState();

    return (
      (this.operation === "erase"
        ? state.eraserSettings
        : state.brushSettings) || DEFAULT_BRUSH_SETTINGS
    );
  }

  hasActiveSession() {
    return this.runtime.hasActiveSession();
  }

  onCanvasPointerDown({ point }: BrushPointerInput) {
    return this.beginStroke({ point });
  }

  onNodePointerDown({ point }: BrushPointerInput) {
    return this.beginStroke({ point });
  }

  beginStroke({ point }: BrushPointerInput) {
    return this.runtime.beginStroke({
      operation: this.operation,
      point,
      settings: this.getSettings(),
    });
  }

  onKeyDown({ event, key }) {
    if (key === "escape") {
      this.editor.setActiveTool("pointer");
      return true;
    }

    return selectToolFromShortcut(this.editor, key, event);
  }
}
