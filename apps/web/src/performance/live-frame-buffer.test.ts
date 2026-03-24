import { describe, expect, it } from "bun:test";
import { LiveFrameBuffer } from "./live-frame-buffer";

describe("LiveFrameBuffer", () => {
  it("preserves insertion order until capacity is reached", () => {
    const buffer = new LiveFrameBuffer<number>(3);

    expect(buffer.append(1)).toBeUndefined();
    expect(buffer.append(2)).toBeUndefined();

    expect(buffer.toArray()).toEqual([1, 2]);
  });

  it("drops the oldest entries once capacity is exceeded", () => {
    const buffer = new LiveFrameBuffer<number>(3);

    expect(buffer.append(1)).toBeUndefined();
    expect(buffer.append(2)).toBeUndefined();
    expect(buffer.append(3)).toBeUndefined();
    expect(buffer.append(4)).toBe(1);
    expect(buffer.append(5)).toBe(2);

    expect(buffer.toArray()).toEqual([3, 4, 5]);
  });

  it("can be cleared and reused", () => {
    const buffer = new LiveFrameBuffer<number>(2);

    buffer.append(1);
    buffer.append(2);
    buffer.clear();
    expect(buffer.append(3)).toBeUndefined();

    expect(buffer.toArray()).toEqual([3]);
  });
});
