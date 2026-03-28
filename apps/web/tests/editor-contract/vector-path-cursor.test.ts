import { describe, expect, test } from "bun:test";
import {
  getVectorPathCursorMode,
  isVectorPathPointRole,
} from "@punchpress/engine";

describe("vector path cursor semantics", () => {
  test("treats anchors and handles as point-edit affordances", () => {
    expect(isVectorPathPointRole("anchor")).toBe(true);
    expect(isVectorPathPointRole("handle-in")).toBe(true);
    expect(isVectorPathPointRole("handle-out")).toBe(true);
    expect(isVectorPathPointRole("path")).toBe(false);
  });

  test("prefers point-edit cursor language over body dragging language", () => {
    expect(getVectorPathCursorMode({ role: "anchor" })).toBe("point");
    expect(getVectorPathCursorMode({ role: "handle-out" })).toBe("point");
    expect(getVectorPathCursorMode({ isInsertHit: true })).toBe("insert");
    expect(getVectorPathCursorMode({ isBodyHit: true, isInsertHit: true })).toBe(
      "insert"
    );
    expect(getVectorPathCursorMode({ isBodyHit: true })).toBe("body");
    expect(getVectorPathCursorMode({ isDraggingBody: true })).toBe("body");
    expect(getVectorPathCursorMode({ role: "path", isBodyHit: false })).toBe(
      null
    );
  });
});
