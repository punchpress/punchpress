import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultEmptyNode,
  createDefaultGroupNode,
  createDefaultImageNode,
  createDefaultPathNode,
  createDefaultShapeNode,
  createDefaultNode as createDefaultTextNode,
  createDefaultVectorNode,
  getNodeSourceKind,
} from "@punchpress/engine";

describe("node source kinds", () => {
  test("classifies built-in node types for raster tool targeting", () => {
    expect(getNodeSourceKind(createDefaultImageNode())).toBe("raster");
    expect(getNodeSourceKind(createDefaultEmptyNode())).toBe("empty");
    expect(getNodeSourceKind(createDefaultArtboardNode())).toBe("artboard");
    expect(getNodeSourceKind(createDefaultGroupNode())).toBe("container");
    expect(getNodeSourceKind(createDefaultPathNode())).toBe("vector");
    expect(getNodeSourceKind(createDefaultShapeNode("rect"))).toBe("vector");
    expect(getNodeSourceKind(createDefaultVectorNode())).toBe("vector");
    expect(getNodeSourceKind(createDefaultTextNode())).toBe("text");
    expect(getNodeSourceKind(null)).toBeNull();
  });
});
