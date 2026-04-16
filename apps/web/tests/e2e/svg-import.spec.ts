import { expect, test } from "@playwright/test";
import { exportDocument, gotoEditor, panViewportBy } from "./helpers/editor";

const ARCH_WARP_SVG = `
  <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M423.75 212.481C284.346 72.1556 137.665 154.012 81.75 212.481L158.863 377C158.863 377 195.023 341.254 258.867 341.254C322.71 341.254 355.65 377 355.65 377L423.75 212.481Z" stroke="black" stroke-width="40" stroke-linejoin="round"/>
    <path d="M394.75 289C323.119 239.796 224.939 202.059 121.75 289" stroke="black" stroke-width="40"/>
  </svg>
`;

const importSvgIntoDocument = (page, source) => {
  return page.evaluate(async (nextSource) => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return null;
    }

    const module = await import("/src/platform/svg-import-document.ts");
    const nodes = await module.importSvgToNodes(nextSource, {
      targetCenter: editor.getViewportCenter?.(),
    });

    editor.insertNodes(nodes);
    return editor.getDebugDump();
  }, source);
};

test("imports svg artwork centered in the current viewport", async ({
  page,
}) => {
  await gotoEditor(page);
  await panViewportBy(page, { x: 1400, y: 900 });

  const dump = await importSvgIntoDocument(page, ARCH_WARP_SVG);
  const viewportCenter = await page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.getViewportCenter() || null;
  });
  const importedBounds = (dump?.nodes || []).reduce(
    (bounds, node) => {
      const frameBounds = node.frame?.bounds;

      if (!frameBounds) {
        return bounds;
      }

      return {
        minX: Math.min(bounds.minX, frameBounds.minX),
        minY: Math.min(bounds.minY, frameBounds.minY),
        maxX: Math.max(bounds.maxX, frameBounds.maxX),
        maxY: Math.max(bounds.maxY, frameBounds.maxY),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );
  const importedCenter = {
    x: (importedBounds.minX + importedBounds.maxX) / 2,
    y: (importedBounds.minY + importedBounds.maxY) / 2,
  };

  expect(viewportCenter).not.toBeNull();
  expect(Math.abs(importedCenter.x - viewportCenter.x)).toBeLessThanOrEqual(5);
  expect(Math.abs(importedCenter.y - viewportCenter.y)).toBeLessThanOrEqual(5);
});

test("imports compound path svg artwork into the current document as an editable vector node", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.addVectorNode({
      x: 120,
      y: 120,
    });
  });
  const dump = await importSvgIntoDocument(
    page,
    `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path
          d="M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 25 75 L 75 75 L 75 25 Z"
          fill="#ff0000"
          fill-opacity="0.5"
          fill-rule="evenodd"
          stroke="#000000"
          stroke-opacity="0.25"
          stroke-width="4"
          stroke-linecap="square"
          stroke-linejoin="bevel"
          stroke-miterlimit="9"
        />
      </svg>
    `
  );
  const importedVector = dump?.nodes?.find((node) => {
    if (node.type !== "vector") {
      return false;
    }

    return dump.nodes.filter((candidate) => candidate.parentId === node.id).length === 2;
  });
  const importedPaths = (dump?.nodes || []).filter((node) => {
    return node.parentId === importedVector?.id;
  });

  expect(dump?.nodes).toHaveLength(5);
  expect(dump?.selection?.ids).toEqual([importedVector?.id]);
  expect(importedVector).toMatchObject({
    type: "vector",
  });
  expect(importedPaths).toHaveLength(2);
  expect(importedPaths).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        contours: [{ closed: true, segments: 4 }],
        fill: "rgba(255,0,0,0.5)",
        fillRule: "evenodd",
        stroke: "rgba(0,0,0,0.25)",
        strokeLineCap: "square",
        strokeLineJoin: "bevel",
        strokeMiterLimit: 9,
        strokeWidth: 4,
        type: "path",
      }),
      expect.objectContaining({
        contours: [{ closed: true, segments: 4 }],
        fill: "rgba(255,0,0,0.5)",
        fillRule: "evenodd",
        stroke: "rgba(0,0,0,0.25)",
        strokeLineCap: "square",
        strokeLineJoin: "bevel",
        strokeMiterLimit: 9,
        strokeWidth: 4,
        type: "path",
      }),
    ])
  );
});

test("round-trips imported svg path artwork back through svg export without filling open lines", async ({
  page,
}) => {
  await gotoEditor(page);
  const dump = await importSvgIntoDocument(
    page,
    `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40">
        <line
          x1="10"
          y1="20"
          x2="50"
          y2="20"
          stroke="#123456"
          stroke-width="3"
          stroke-linecap="round"
        />
        <rect
          x="110"
          y="5"
          width="40"
          height="30"
          fill="#abcdef"
        />
      </svg>
    `
  );
  const exportedSvg = await exportDocument(page);
  const sortedNodes = [...(dump?.nodes || [])]
    .filter((node) => node.type === "path")
    .sort(
    (left, right) => left.transform.x - right.transform.x
  );

  expect(sortedNodes).toHaveLength(2);
  expect(sortedNodes[0]).toMatchObject({
    fill: null,
    stroke: "rgb(18,52,86)",
    strokeLineCap: "round",
    strokeWidth: 3,
    type: "path",
  });
  expect(sortedNodes[0]?.contours).toHaveLength(1);
  expect(sortedNodes[0]?.contours[0]?.closed).toBe(false);
  expect(sortedNodes[1]).toMatchObject({
    fill: "rgb(171,205,239)",
    stroke: null,
    type: "path",
  });
  expect(
    Math.round(sortedNodes[1].transform.x - sortedNodes[0].transform.x)
  ).toBe(100);
  expect(exportedSvg).toContain('fill="none"');
  expect(exportedSvg).toContain('stroke="rgb(18,52,86)"');
  expect(exportedSvg).toContain('stroke-linecap="round"');
  expect(exportedSvg).toContain('fill="rgb(171,205,239)"');
});
