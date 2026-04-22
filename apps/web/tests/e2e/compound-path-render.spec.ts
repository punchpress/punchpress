import { expect, test } from "@playwright/test";
import { gotoEditor, loadDocument } from "./helpers/editor";

const ADD_COMPOUND_SOURCE_DOCUMENT = JSON.stringify({
  nodes: [
    {
      id: "vector-node",
      name: "Vector",
      pathComposition: "independent",
      parentId: "root",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      },
      type: "vector",
      visible: true,
    },
    {
      closed: true,
      fill: "#c05a53",
      fillRule: "nonzero",
      id: "vector-node-path-1",
      parentId: "vector-node",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -140, y: -110 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 0, y: -180 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 150, y: -100 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 180, y: 80 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 10, y: 170 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -190, y: 60 },
          pointType: "corner",
        },
      ],
      stroke: "#111111",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 6,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 540,
        y: 360,
      },
      type: "path",
      visible: true,
    },
    {
      closed: true,
      fill: "#c05a53",
      fillRule: "nonzero",
      id: "vector-node-path-2",
      parentId: "vector-node",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -50, y: -30 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 35, y: -95 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 90, y: -20 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 65, y: 70 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -20, y: 70 },
          pointType: "corner",
        },
      ],
      stroke: "#111111",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 6,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 540,
        y: 360,
      },
      type: "path",
      visible: true,
    },
  ],
  version: "1.7",
});

const FILL_COMPOUND_DOCUMENT = JSON.stringify({
  nodes: [
    {
      id: "vector-node",
      name: "Vector",
      pathComposition: "compound-fill",
      parentId: "root",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      },
      type: "vector",
      visible: true,
    },
    {
      closed: true,
      fill: "#c05a53",
      fillRule: "evenodd",
      id: "vector-node-path-1",
      parentId: "vector-node",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -140, y: -110 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 0, y: -180 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 150, y: -100 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 180, y: 80 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 10, y: 170 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -190, y: 60 },
          pointType: "corner",
        },
      ],
      stroke: "#111111",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 6,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 540,
        y: 360,
      },
      type: "path",
      visible: true,
    },
    {
      closed: true,
      fill: "#c05a53",
      fillRule: "evenodd",
      id: "vector-node-path-2",
      parentId: "vector-node",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -50, y: -30 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 35, y: -95 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 90, y: -20 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 65, y: 70 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -20, y: 70 },
          pointType: "corner",
        },
      ],
      stroke: "#111111",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 6,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 540,
        y: 360,
      },
      type: "path",
      visible: true,
    },
  ],
  version: "1.7",
});

test("making a compound path collapses the vector render to one boolean-add svg path", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ADD_COMPOUND_SOURCE_DOCUMENT);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("vector-node");
    editor?.makeCompoundPath();
  });

  await expect
    .poll(() => {
      return page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const dump = editor?.getDebugDump();
        const vectorNode = document.querySelector(
          '.canvas-node[data-node-id="vector-node"]'
        );
        const renderedPaths = vectorNode?.querySelectorAll("path") || [];

        return {
          vectorNode: dump?.document?.serialized
            ? JSON.parse(dump.document.serialized).nodes.find(
                (node) => node.id === "vector-node"
              )
            : null,
          childPaths: dump?.document?.serialized
            ? JSON.parse(dump.document.serialized)
                .nodes.filter((node) => node.parentId === "vector-node")
                .map((node) => ({
                  fillRule: node.fillRule || null,
                  id: node.id,
                }))
            : [],
          renderedPathCount: renderedPaths.length,
          renderedPathD:
            renderedPaths[0]?.getAttribute("d")?.match(/M/g)?.length || 0,
          renderedPathFillRule:
            renderedPaths[0]?.getAttribute("fill-rule") ||
            renderedPaths[0]?.getAttribute("fillRule") ||
            null,
        };
      });
    })
    .toEqual({
      childPaths: [
        {
          fillRule: "nonzero",
          id: "vector-node-path-1",
        },
        {
          fillRule: "nonzero",
          id: "vector-node-path-2",
        },
      ],
      vectorNode: expect.objectContaining({
        id: "vector-node",
        pathComposition: "unite",
      }),
      renderedPathCount: 1,
      renderedPathD: 1,
      renderedPathFillRule: "nonzero",
    });
});

test("loaded fill-compound render stays punched out when path editing starts", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, FILL_COMPOUND_DOCUMENT);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("vector-node");
    editor?.startPathEditing("vector-node");
  });

  await expect
    .poll(() => {
      return page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const vectorNode = document.querySelector(
          '.canvas-node[data-node-id="vector-node"]'
        );
        const renderedPaths = vectorNode?.querySelectorAll("path") || [];

        return {
          pathEditingNodeId:
            editor?.getDebugDump()?.editing?.pathNodeId || null,
          renderedPathCount: renderedPaths.length,
          renderedPathD:
            renderedPaths[0]?.getAttribute("d")?.match(/M/g)?.length || 0,
          renderedPathFillRule:
            renderedPaths[0]?.getAttribute("fill-rule") ||
            renderedPaths[0]?.getAttribute("fillRule") ||
            null,
        };
      });
    })
    .toEqual({
      pathEditingNodeId: "vector-node-path-2",
      renderedPathCount: 1,
      renderedPathD: 2,
      renderedPathFillRule: "evenodd",
    });
});

test("path editing a loaded fill-compound vector does not show a duplicate hover preview for the parent vector", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, FILL_COMPOUND_DOCUMENT);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("vector-node");
    editor?.startPathEditing("vector-node");
    editor?.setHoveredNode("vector-node");
  });

  await expect
    .poll(() => {
      return page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;

        return {
          hoveredNodeId: editor?.hoveredNodeId || null,
          hoverPreviewCount: document.querySelectorAll(".canvas-hover-preview")
            .length,
          pathEditingNodeId: editor?.pathEditingNodeId || null,
        };
      });
    })
    .toEqual({
      hoveredNodeId: "vector-node",
      hoverPreviewCount: 0,
      pathEditingNodeId: "vector-node-path-2",
    });
});
