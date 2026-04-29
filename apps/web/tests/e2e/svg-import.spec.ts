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

const getImportedCenter = (dump) => {
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

  return {
    x: (importedBounds.minX + importedBounds.maxX) / 2,
    y: (importedBounds.minY + importedBounds.maxY) / 2,
  };
};

const getImportedGroup = (dump) => {
  return dump?.nodes?.find((node) => node.type === "group") || null;
};

const getGroupChildren = (dump, groupId) => {
  return (dump?.nodes || []).filter((node) => node.parentId === groupId);
};

const dispatchSvgFileDrop = async (page, source, point) => {
  const dataTransfer = await page.evaluateHandle((nextSource) => {
    const transfer = new DataTransfer();
    const file = new File([nextSource], "dropped-artwork.svg", {
      type: "image/svg+xml",
    });

    transfer.items.add(file);
    return transfer;
  }, source);

  const canvasHost = page.locator(".canvas-host");

  await canvasHost.dispatchEvent("dragover", {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    dataTransfer,
  });
  await canvasHost.dispatchEvent("drop", {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    dataTransfer,
  });
};

const getCanvasPointFromClientPoint = (page, point) => {
  return page.evaluate((clientPoint) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const host = editor?.hostRef;
    const viewer = editor?.viewerRef;

    if (!(editor && host && viewer)) {
      return null;
    }

    const rect = host.getBoundingClientRect();

    return {
      x: viewer.getScrollLeft() + (clientPoint.x - rect.left) / editor.zoom,
      y: viewer.getScrollTop() + (clientPoint.y - rect.top) / editor.zoom,
    };
  }, point);
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
  const importedGroup = getImportedGroup(dump);
  const importedCenter = getImportedCenter(dump);

  expect(importedGroup).not.toBeNull();
  expect(getGroupChildren(dump, importedGroup?.id)).toHaveLength(2);
  expect(dump?.selection?.ids).toEqual([importedGroup?.id]);
  expect(viewportCenter).not.toBeNull();
  expect(Math.abs(importedCenter.x - viewportCenter.x)).toBeLessThanOrEqual(5);
  expect(Math.abs(importedCenter.y - viewportCenter.y)).toBeLessThanOrEqual(5);
});

test("imports an SVG file dropped from the OS onto the canvas", async ({
  page,
}) => {
  await gotoEditor(page);
  await panViewportBy(page, { x: 900, y: 650 });

  const canvasHost = page.locator(".canvas-host");
  const hostBox = await canvasHost.boundingBox();

  if (!hostBox) {
    throw new Error("Expected canvas host to have layout bounds");
  }

  const dropClientPoint = {
    x: hostBox.x + hostBox.width * 0.38,
    y: hostBox.y + hostBox.height * 0.44,
  };
  const targetCanvasPoint = await getCanvasPointFromClientPoint(
    page,
    dropClientPoint
  );

  await dispatchSvgFileDrop(page, ARCH_WARP_SVG, dropClientPoint);

  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.__PUNCHPRESS_EDITOR__?.getDebugDump()?.nodes?.length || 0;
      });
    })
    .toBeGreaterThan(0);

  const dump = await page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.getDebugDump() || null;
  });
  const importedGroup = getImportedGroup(dump);
  const importedCenter = getImportedCenter(dump);

  expect(importedGroup).not.toBeNull();
  expect(targetCanvasPoint).not.toBeNull();
  expect(dump?.nodes?.length).toBeGreaterThan(0);
  expect(dump?.selection?.ids).toEqual([importedGroup?.id]);
  expect(getGroupChildren(dump, importedGroup?.id)).toHaveLength(2);
  expect(Math.abs(importedCenter.x - targetCanvasPoint.x)).toBeLessThanOrEqual(
    5
  );
  expect(Math.abs(importedCenter.y - targetCanvasPoint.y)).toBeLessThanOrEqual(
    5
  );
});

test("preserves non-empty SVG group hierarchy", async ({ page }) => {
  await gotoEditor(page);

  const dump = await importSvgIntoDocument(
    page,
    `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
        <g id="body">
          <path d="M 10 10 L 70 10 L 70 60 L 10 60 Z" fill="#f8ae46" />
          <g id="face">
            <circle cx="30" cy="30" r="5" fill="#111111" />
            <circle cx="50" cy="30" r="5" fill="#111111" />
          </g>
        </g>
        <g id="tail">
          <path d="M 75 25 C 105 5 105 70 75 50" fill="none" stroke="#f8ae46" stroke-width="6" />
        </g>
        <g id="empty" />
      </svg>
    `
  );
  const importedGroup = getImportedGroup(dump);
  const topLevelImportedGroups = getGroupChildren(
    dump,
    importedGroup?.id
  ).filter((node) => node.type === "group");
  const bodyChildren = getGroupChildren(dump, topLevelImportedGroups[0]?.id);
  const bodyNestedGroups = bodyChildren.filter((node) => node.type === "group");
  const faceChildren = getGroupChildren(dump, bodyNestedGroups[0]?.id);
  const tailChildren = getGroupChildren(dump, topLevelImportedGroups[1]?.id);

  expect(importedGroup).not.toBeNull();
  expect(dump?.selection?.ids).toEqual([importedGroup?.id]);
  expect(topLevelImportedGroups).toHaveLength(2);
  expect(bodyChildren.filter((node) => node.type === "path")).toHaveLength(1);
  expect(bodyNestedGroups).toHaveLength(1);
  expect(faceChildren.filter((node) => node.type === "path")).toHaveLength(2);
  expect(tailChildren.filter((node) => node.type === "path")).toHaveLength(1);
});

test("imports compound path svg artwork into the current document as one editable multi-contour path", async ({
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
  const importedPath = dump?.nodes?.find((node) => {
    return (
      node.type === "path" &&
      node.parentId !== "root" &&
      node.contours?.length === 2
    );
  });
  const importedGroup = getImportedGroup(dump);

  expect(dump?.nodes).toHaveLength(3);
  expect(dump?.selection?.ids).toEqual([importedGroup?.id]);
  expect(getGroupChildren(dump, importedGroup?.id)).toEqual([importedPath]);
  expect(importedPath).toMatchObject({
    contours: [
      { closed: true, segments: 4 },
      { closed: true, segments: 4 },
    ],
    fill: "rgba(255,0,0,0.5)",
    fillRule: "evenodd",
    parentId: importedGroup?.id,
    stroke: "rgba(0,0,0,0.25)",
    strokeLineCap: "square",
    strokeLineJoin: "bevel",
    strokeMiterLimit: 9,
    strokeWidth: 4,
    type: "path",
  });

  await expect
    .poll(() => {
      return page.evaluate((currentPathId) => {
        const pathNode = document.querySelector(
          `.canvas-node[data-node-id="${currentPathId}"]`
        );
        const renderedPaths = pathNode?.querySelectorAll("path") || [];

        return {
          pathCommandCount:
            renderedPaths[0]?.getAttribute("d")?.match(/M/g)?.length || 0,
          pathCount: renderedPaths.length,
          pathFillRule:
            renderedPaths[0]?.getAttribute("fill-rule") ||
            renderedPaths[0]?.getAttribute("fillRule") ||
            null,
        };
      }, importedPath?.id || null);
    })
    .toEqual({
      pathCommandCount: 2,
      pathCount: 1,
      pathFillRule: "evenodd",
    });
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
  const importedGroup = getImportedGroup(dump);
  const sortedNodes = getGroupChildren(dump, importedGroup?.id)
    .filter((node) => node.type === "path")
    .sort((left, right) => left.transform.x - right.transform.x);

  expect(importedGroup).not.toBeNull();
  expect(dump?.selection?.ids).toEqual([importedGroup?.id]);
  expect(getGroupChildren(dump, importedGroup?.id)).toHaveLength(2);
  expect(sortedNodes).toHaveLength(2);
  expect(sortedNodes[0]?.parentId).toBe(importedGroup?.id);
  expect(sortedNodes[1]?.parentId).toBe(importedGroup?.id);
  expect(sortedNodes[0]).toMatchObject({
    fill: null,
    stroke: "#123456",
    strokeLineCap: "round",
    strokeWidth: 3,
    type: "path",
  });
  expect(sortedNodes[0]?.contours).toHaveLength(1);
  expect(sortedNodes[0]?.contours[0]?.closed).toBe(false);
  expect(sortedNodes[1]).toMatchObject({
    fill: "#abcdef",
    stroke: null,
    type: "path",
  });
  expect(
    Math.round(sortedNodes[1].transform.x - sortedNodes[0].transform.x)
  ).toBe(100);
  expect(exportedSvg).toContain('fill="none"');
  expect(exportedSvg).toContain('stroke="#123456"');
  expect(exportedSvg).toContain('stroke-linecap="round"');
  expect(exportedSvg).toContain('fill="#abcdef"');
});
