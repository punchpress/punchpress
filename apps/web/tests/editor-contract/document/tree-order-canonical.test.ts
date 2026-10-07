import { describe, expect, test } from "bun:test";
import {
  canonicalizeTreeOrder,
  findParentCycleIds,
  PUNCH_CLIPBOARD_MIME_TYPE,
  PUNCH_DOCUMENT_VERSION,
  parseClipboardContent,
  parseDesignDocument,
} from "@punchpress/punch-schema";

const PARENT_CYCLE_ERROR = /parent cycle/;
const node = (id: string, parentId = "root") => ({ id, parentId });
const ids = (nodes: { id: string }[]) => nodes.map((entry) => entry.id);

describe("canonicalizeTreeOrder", () => {
  test("returns the same array when already canonical, and is idempotent", () => {
    const nodes = [node("g"), node("a", "g"), node("b", "g"), node("x")];
    const shuffled = [node("g"), node("a", "g"), node("x"), node("b", "g")];
    const once = canonicalizeTreeOrder(shuffled);

    expect(canonicalizeTreeOrder(nodes)).toBe(nodes);
    expect(ids(once)).toEqual(["g", "a", "b", "x"]);
    expect(canonicalizeTreeOrder(once)).toBe(once);
    expect(once[0]).toBe(shuffled[0]);
  });

  test("places children after their parent and keeps sibling order", () => {
    const nodes = [
      node("c", "g2"),
      node("g1"),
      node("g2", "g1"),
      node("a", "g1"),
      node("x"),
      node("d", "g2"),
    ];

    expect(ids(canonicalizeTreeOrder(nodes))).toEqual([
      "g1",
      "g2",
      "c",
      "d",
      "a",
      "x",
    ]);
  });

  test("keeps every occurrence of malformed input exactly once", () => {
    const nodes = [
      node("orphan", "missing"),
      node("child", "orphan"),
      node("loop-a", "loop-b"),
      node("loop-b", "loop-a"),
      node("dup"),
      node("dup"),
      node("x"),
    ];
    const result = canonicalizeTreeOrder(nodes);

    expect(result).toHaveLength(nodes.length);
    expect(new Set(result)).toEqual(new Set(nodes));
    expect(ids(result)).toEqual([
      "orphan",
      "child",
      "dup",
      "dup",
      "x",
      "loop-a",
      "loop-b",
    ]);
    expect(findParentCycleIds(nodes).sort()).toEqual(["loop-a", "loop-b"]);
  });
});

describe("parent cycles at ingress", () => {
  const group = (id: string, parentId: string) => ({
    id,
    name: id,
    opacity: 1,
    parentId,
    transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
    type: "group",
    visible: true,
  });

  test("documents with a parent cycle fail validation", () => {
    expect(() =>
      parseDesignDocument(
        JSON.stringify({
          assets: {},
          nodes: [group("a", "b"), group("b", "a")],
          version: PUNCH_DOCUMENT_VERSION,
        })
      )
    ).toThrow(PARENT_CYCLE_ERROR);
  });

  test("clipboard payloads with a parent cycle are rejected", () => {
    expect(() =>
      parseClipboardContent(
        JSON.stringify({
          documentVersion: PUNCH_DOCUMENT_VERSION,
          nodes: [group("a", "b"), group("b", "a")],
          rootNodeIds: ["a"],
          type: PUNCH_CLIPBOARD_MIME_TYPE,
          version: 1,
        })
      )
    ).toThrow(PARENT_CYCLE_ERROR);
  });

  test("interleaved clipboard payloads paste in canonical order", () => {
    const shape = (id: string, parentId: string) => ({
      appearance: { fills: [], strokes: [] },
      height: 10,
      id,
      opacity: 1,
      parentId,
      shape: "ellipse",
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      type: "shape",
      visible: true,
      width: 10,
    });
    const content = parseClipboardContent(
      JSON.stringify({
        documentVersion: PUNCH_DOCUMENT_VERSION,
        nodes: [
          group("g", "root"),
          shape("a", "g"),
          shape("x", "root"),
          shape("b", "g"),
        ],
        rootNodeIds: ["g", "x"],
        type: PUNCH_CLIPBOARD_MIME_TYPE,
        version: 1,
      })
    );

    expect(ids(content.nodes)).toEqual(["g", "a", "b", "x"]);
  });
});
