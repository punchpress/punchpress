import type {
  RasterCommit,
  RasterOperation,
  RasterPoint,
  RasterStrokeContext,
  RasterStrokeSettings,
  RasterSurface,
  RasterTarget,
} from "./contracts";
import { createRasterDabGenerator } from "./dab-generator";

type CreateRasterStrokeInput = {
  operation: RasterOperation;
  point: RasterPoint;
  settings: RasterStrokeSettings;
  surface: RasterSurface;
  target: RasterTarget;
};

export type RasterStroke = {
  append: (points: readonly RasterPoint[]) => void;
  cancel: () => void;
  commit: () => RasterCommit;
};

export const createRasterStroke = ({
  operation,
  point,
  settings,
  surface,
  target,
}: CreateRasterStrokeInput): RasterStroke => {
  const context = freezeContext({ operation, settings, target });
  const generator = createRasterDabGenerator(context.settings);
  const surfaceSession = surface.beginStroke(context);
  let state: "active" | "cancelled" | "committed" = "active";

  surfaceSession.applyDabs(generator.append([point]));

  const requireActive = () => {
    if (state !== "active") {
      throw new Error(`Raster stroke is already ${state}`);
    }
  };

  return {
    append: (points) => {
      requireActive();
      surfaceSession.applyDabs(generator.append(points));
    },
    cancel: () => {
      requireActive();
      state = "cancelled";
      surfaceSession.cancel();
    },
    commit: () => {
      requireActive();
      surfaceSession.applyDabs(generator.finish());
      state = "committed";
      return surfaceSession.commit();
    },
  };
};

const freezeContext = ({
  operation,
  settings,
  target,
}: RasterStrokeContext): RasterStrokeContext =>
  Object.freeze({
    operation,
    settings: Object.freeze({
      ...settings,
      tip: Object.freeze({ ...settings.tip }),
    }),
    target: Object.freeze({
      ...target,
      bounds: Object.freeze({ ...target.bounds }),
      pixelSize: Object.freeze({ ...target.pixelSize }),
    }),
  });
