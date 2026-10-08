import { expect, type Page, test } from "@playwright/test";
import { gotoEditor, loadDocument, setViewport } from "./helpers/editor";

// A whole-group drag moves one presentation root: the wrapper group's
// presentation element takes a single translation while every shell, effect
// layer, and filter definition beneath it stays untouched. Release hands off
// to committed placement without a visible jump.

const IDENTITY = { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 };

const shadow = (id: string, extra = {}) => ({
  blur: 8,
  color: "#000000",
  enabled: true,
  id,
  kind: "drop-shadow",
  opacity: 0.6,
  x: 12,
  y: 12,
  ...extra,
});

const square = (id: string, parentId: string, x: number, y: number) => ({
  appearance: {
    fills: [
      {
        enabled: true,
        id: "fill",
        opacity: 1,
        paint: { color: "#1f6feb", kind: "solid" },
      },
    ],
    strokes: [],
  },
  cornerRadius: 0,
  height: 80,
  id,
  opacity: 1,
  parentId,
  shape: "polygon",
  transform: { ...IDENTITY, x, y },
  type: "shape",
  visible: true,
  width: 80,
});

const group = (id: string, parentId: string, extra = {}) => ({
  id,
  name: id,
  opacity: 1,
  parentId,
  transform: IDENTITY,
  type: "group",
  visible: true,
  ...extra,
});

const DOCUMENT = JSON.stringify({
  assets: {},
  nodes: [
    {
      background: "#ffffff",
      height: 800,
      id: "art",
      locked: false,
      name: "Art",
      opacity: 1,
      parentId: "root",
      transform: IDENTITY,
      type: "artboard",
      visible: true,
      width: 1200,
    },
    group("wrap", "art"),
    group("one", "wrap", { effects: [shadow("s1")] }),
    group("inner", "one", { effects: [shadow("s2", { x: -10 })] }),
    square("a", "inner", 200, 200),
    square("b", "one", 320, 200),
    group("two", "wrap", {
      effects: [shadow("s3"), shadow("s4", { x: -20, y: 30 })],
      opacity: 0.7,
    }),
    square("c", "two", 200, 400),
    square("d", "two", 260, 430),
    square("loose", "art", 800, 200),
  ],
  version: "1.12",
});

const frames = (page: Page, count = 2) => {
  return page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
};

// Inline styles of every presentation, effect, and shell element, plus the
// rendered filter definitions.
const readCanvasDom = (page: Page) => {
  return page.evaluate(() => {
    const byAttribute = (attribute: string) => {
      return [...document.querySelectorAll<HTMLElement>(`[${attribute}]`)];
    };

    return {
      effects: byAttribute("data-render-layer").map((element) => {
        const defs = element.querySelector(":scope > svg")?.innerHTML ?? "";

        return `${element.dataset.renderLayer}|${element.style.filter}|${element.style.opacity}|${defs}`;
      }),
      moving: byAttribute("data-presentation-node-id")
        .filter(
          (element) => element.style.transform || element.style.willChange
        )
        .map((element) => {
          return `${element.dataset.presentationNodeId}|${element.style.transform}|${element.style.willChange}`;
        }),
      shells: byAttribute("data-node-shell").map((element) => {
        const inner = element.firstElementChild as HTMLElement | null;

        return `${element.style.transform}|${element.style.willChange}|${inner?.style.transform ?? ""}`;
      }),
    };
  });
};

const readRect = (page: Page, nodeId: string) => {
  return page.evaluate((id) => {
    const rect = window.__PUNCHPRESS_EDITOR__
      ?.getNodeElement(id)
      ?.getBoundingClientRect();

    return rect ? { x: rect.x, y: rect.y } : null;
  }, nodeId);
};

const beginDrag = (page: Page, nodeIds: string[], duplicate = false) => {
  return page.evaluate(
    ({ ids, isDuplicate }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;

      editor?.setSelectedNodes(ids);
      (window as never as { dragSession: unknown }).dragSession =
        editor?.beginSelectionDrag(
          isDuplicate ? { duplicate: true, nodeId: ids[0] } : { nodeIds: ids }
        );
    },
    { ids: nodeIds, isDuplicate: duplicate }
  );
};

const moveDrag = (page: Page, delta: { x: number; y: number }) => {
  return page.evaluate((step) => {
    window.__PUNCHPRESS_EDITOR__?.updateSelectionDrag(
      (window as never as { dragSession: unknown }).dragSession,
      { delta: step }
    );
  }, delta);
};

// Ends the drag, then records the probe's screen position right after the
// release task and after each of the next frames has painted.
const releaseAndTrack = (page: Page, nodeId: string, cancel = false) => {
  return page.evaluate(
    async ({ id, isCancel }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const read = () => {
        const rect = editor?.getNodeElement(id)?.getBoundingClientRect();

        return rect ? { x: rect.x, y: rect.y } : null;
      };

      editor?.endSelectionDrag(
        (window as never as { dragSession: unknown }).dragSession,
        isCancel ? { cancel: true } : {}
      );

      const positions = [read()];

      for (let index = 0; index < 3; index += 1) {
        await new Promise((resolve) =>
          requestAnimationFrame(() => setTimeout(resolve))
        );
        positions.push(read());
      }

      return positions;
    },
    { id: nodeId, isCancel: cancel }
  );
};

const expectAt = (
  actual: { x: number; y: number } | null,
  expected: { x: number; y: number } | null,
  label: string
) => {
  expect(actual, label).not.toBeNull();
  expect(Math.abs((actual?.x ?? 0) - (expected?.x ?? 0)), label).toBeLessThan(
    0.01
  );
  expect(Math.abs((actual?.y ?? 0) - (expected?.y ?? 0)), label).toBeLessThan(
    0.01
  );
};

const offset = (
  point: { x: number; y: number } | null,
  delta: { x: number; y: number }
) => ({ x: (point?.x ?? 0) + delta.x, y: (point?.y ?? 0) + delta.y });

test.describe("group presentation drag", () => {
  test.beforeEach(async ({ page }) => {
    await gotoEditor(page);
    await loadDocument(page, DOCUMENT);
    await setViewport(page, { x: 0, y: 0, zoom: 1 });
    await frames(page, 3);
  });

  test("moves exactly one root and leaves descendants and filters untouched", async ({
    page,
  }) => {
    const idle = await readCanvasDom(page);

    expect(idle.moving).toEqual([]);

    await beginDrag(page, ["wrap"]);
    await moveDrag(page, { x: 10.25, y: 3.5 });
    await frames(page);

    const first = await readCanvasDom(page);

    expect(first.moving).toEqual(["wrap|translate(10.25px, 3.5px)|transform"]);
    expect(first.shells).toEqual(idle.shells);
    expect(first.effects).toEqual(idle.effects);

    await moveDrag(page, { x: 40.5, y: -17.75 });
    await frames(page);

    const second = await readCanvasDom(page);

    expect(second.moving).toEqual([
      "wrap|translate(50.75px, -14.25px)|transform",
    ]);
    expect(second.shells).toEqual(idle.shells);
    expect(second.effects).toEqual(idle.effects);

    await releaseAndTrack(page, "a", true);
  });

  test("commit hands off without a jump and leaves no preview styles", async ({
    page,
  }) => {
    const before = await readRect(page, "a");

    await beginDrag(page, ["wrap"]);
    await moveDrag(page, { x: 30.5, y: 20 });
    await frames(page);

    const preview = await readRect(page, "a");

    expectAt(preview, offset(before, { x: 30.5, y: 20 }), "preview");

    for (const [index, position] of (
      await releaseAndTrack(page, "a")
    ).entries()) {
      expectAt(position, preview, `release frame ${index}`);
    }

    expect((await readCanvasDom(page)).moving).toEqual([]);
    expect(
      await page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getNode("a")?.transform.x;
      })
    ).toBe(230.5);
  });

  test("cancel and zero displacement restore the exact placement", async ({
    page,
  }) => {
    const idle = await readCanvasDom(page);
    const before = await readRect(page, "a");

    await beginDrag(page, ["wrap"]);
    await moveDrag(page, { x: 64, y: 32 });
    await frames(page);

    const positions = await releaseAndTrack(page, "a", true);

    expectAt(positions.at(-1) ?? null, before, "after cancel");
    expect(await readCanvasDom(page)).toEqual(idle);

    await beginDrag(page, ["wrap"]);
    await moveDrag(page, { x: 12, y: 0 });
    await moveDrag(page, { x: -12, y: 0 });
    await frames(page);

    expectAt((await releaseAndTrack(page, "a")).at(-1) ?? null, before, "zero");
    expect(await readCanvasDom(page)).toEqual(idle);
    expect(
      await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.undo())
    ).toBeFalsy();
  });

  test("undo, redo, and rapid successive gestures land in place", async ({
    page,
  }) => {
    const before = await readRect(page, "a");

    await beginDrag(page, ["wrap"]);
    await moveDrag(page, { x: 20, y: 0 });
    await frames(page);

    // A second gesture starts in the same task as the first one's release.
    await page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const holder = window as never as { dragSession: unknown };

      editor?.endSelectionDrag(holder.dragSession, {});
      holder.dragSession = editor?.beginSelectionDrag({ nodeIds: ["wrap"] });
      editor?.updateSelectionDrag(holder.dragSession, {
        delta: { x: 0, y: 25 },
      });
    });
    await frames(page);

    expectAt(
      await readRect(page, "a"),
      offset(before, { x: 20, y: 25 }),
      "second gesture preview"
    );
    expect((await readCanvasDom(page)).moving).toEqual([
      "wrap|translate(0px, 25px)|transform",
    ]);

    await releaseAndTrack(page, "a");

    const committed = offset(before, { x: 20, y: 25 });

    expectAt(await readRect(page, "a"), committed, "second commit");

    await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.undo());
    await frames(page);
    expectAt(
      await readRect(page, "a"),
      offset(before, { x: 20, y: 0 }),
      "undo"
    );

    await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.redo());
    await frames(page);
    expectAt(await readRect(page, "a"), committed, "redo");
    expect((await readCanvasDom(page)).moving).toEqual([]);
  });

  test("an alt-drag duplicate moves the copy and leaves the original", async ({
    page,
  }) => {
    const before = await readRect(page, "a");

    await beginDrag(page, ["wrap"], true);
    await moveDrag(page, { x: 0, y: 150 });
    await frames(page);

    const copyId = await page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const [wrapCopy] = editor?.selectedNodeIds ?? [];

      return editor?.getDescendantLeafNodeIds(wrapCopy)[0] ?? null;
    });

    expect(copyId).not.toBe("a");

    const preview = await readRect(page, copyId ?? "");

    expectAt(preview, offset(before, { x: 0, y: 150 }), "copy preview");

    for (const position of await releaseAndTrack(page, copyId ?? "")) {
      expectAt(position, preview, "copy release");
    }

    expectAt(await readRect(page, "a"), before, "original");
    expect((await readCanvasDom(page)).moving).toEqual([]);
  });

  test("a leaf drag moves only its shell", async ({ page }) => {
    await beginDrag(page, ["loose"]);
    await moveDrag(page, { x: 5, y: 5 });
    await frames(page);

    const dom = await readCanvasDom(page);

    expect(dom.moving).toEqual([]);
    expect(
      dom.shells.filter((shell) => shell.includes("|transform|"))
    ).toHaveLength(1);

    await releaseAndTrack(page, "loose", true);
  });
});
