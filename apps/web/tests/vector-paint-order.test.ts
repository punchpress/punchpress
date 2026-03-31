import { describe, expect, test } from "bun:test";
import { getVectorPathPaintOrder } from "../src/components/canvas/vector-paint-order";

describe("vector path paint order", () => {
  test("renders fill beneath stroke for illustrator-style vector appearance", () => {
    expect(getVectorPathPaintOrder()).toBe("fill stroke");
  });
});
