import { describe, expect, test } from "bun:test";
import {
  createRasterOperationRecorder,
  createRasterStroke,
  type RasterStrokeSettings,
  type RasterTarget,
} from "@punchpress/engine";

const settings: RasterStrokeSettings = {
  color: "#AABBCC",
  hardness: 0.75,
  opacity: 0.5,
  size: 20,
  smoothing: 0,
  spacing: 0.5,
  tip: { kind: "round" },
};

const target: RasterTarget = {
  bounds: { height: 100, width: 100, x: 10, y: 20 },
  id: "raster-a",
  pixelSize: { height: 200, width: 200 },
};

describe("raster stroke contract", () => {
  test("locks the target, operation, and settings when the stroke starts", () => {
    const recorder = createRasterOperationRecorder();
    const mutableSettings = structuredClone(settings);
    const mutableTarget = structuredClone(target);
    const stroke = createRasterStroke({
      operation: "paint",
      point: { x: 20, y: 30 },
      settings: mutableSettings,
      surface: recorder,
      target: mutableTarget,
    });

    mutableSettings.color = "#000000";
    mutableSettings.size = 80;
    mutableTarget.id = "raster-b";
    mutableTarget.bounds.x = 500;
    stroke.append([{ x: 40, y: 30 }]);
    const commit = stroke.commit();

    expect(recorder.commits).toHaveLength(1);
    expect(recorder.commits[0]?.context).toEqual({
      operation: "paint",
      settings,
      target,
    });
    expect(recorder.commits[0]?.dabs).toHaveLength(3);
    expect(recorder.commits[0]?.dabs.every((dab) => dab.size === 20)).toBe(
      true
    );
    expect(commit).toEqual({
      dirtyRegion: { height: 40, width: 73, x: 0, y: 0 },
      targetId: "raster-a",
    });
  });

  test("cancellation leaves no durable recorder commit", () => {
    const recorder = createRasterOperationRecorder();
    const stroke = createRasterStroke({
      operation: "erase",
      point: { x: 20, y: 30 },
      settings,
      surface: recorder,
      target,
    });

    stroke.append([{ x: 60, y: 30 }]);
    stroke.cancel();

    expect(recorder.commits).toEqual([]);
    expect(() => stroke.commit()).toThrow("already cancelled");
  });

  test("keeps scattered edge Dabs whose tips can reach the target", () => {
    const recorder = createRasterOperationRecorder();
    const stroke = createRasterStroke({
      operation: "paint",
      point: { x: -15, y: 50 },
      settings: {
        ...settings,
        scatter: 1,
        seed: 36,
      },
      surface: recorder,
      target: {
        ...target,
        bounds: { height: 100, width: 100, x: 0, y: 0 },
      },
    });

    stroke.commit();

    expect(recorder.commits[0]?.dabs).toHaveLength(1);
    expect(recorder.commits[0]?.dabs[0]?.center.x).toBeGreaterThan(-10);
  });
});
