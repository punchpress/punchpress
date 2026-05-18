import type {
  DesignDocument,
  TextNodeDocument,
} from "@punchpress/punch-schema";
import { buildNodeCapabilityGeometry } from "../nodes/node-capabilities";
import { buildSvgExport } from "../nodes/node-svg-export";
import { isDescendantOf } from "../nodes/node-tree";
import { buildVectorRenderGeometry } from "../nodes/vector/vector-render-geometry";

const escapeMetadata = (value: string) => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
};

const isNodeVisibleForExport = (document, node) => {
  if (node.visible === false) {
    return false;
  }

  return !document.nodes.some((ancestorNode) => {
    return (
      ancestorNode.id !== node.id &&
      ancestorNode.visible === false &&
      isDescendantOf(document.nodes, node.id, ancestorNode.id)
    );
  });
};

const shouldExportNode = (document, node) => {
  if (node.type === "group" || node.visible === false) {
    return false;
  }

  if (
    node.type === "path" &&
    document.nodes.find((parentNode) => parentNode.id === node.parentId)
      ?.type === "vector"
  ) {
    return false;
  }

  return isNodeVisibleForExport(document, node);
};

const buildGeometryById = async (document, loadFont) => {
  const fontPromises = new Map<string, ReturnType<typeof loadFont>>();
  const geometryById = new Map();

  for (const node of document.nodes) {
    if (node.type === "text" && !fontPromises.has(node.font.postscriptName)) {
      fontPromises.set(node.font.postscriptName, loadFont(node.font));
    }

    const font =
      node.type === "text"
        ? await fontPromises.get(node.font.postscriptName)
        : null;

    if (node.type === "vector") {
      continue;
    }

    geometryById.set(node.id, buildNodeCapabilityGeometry(node, font));
  }

  for (const node of document.nodes) {
    if (node.type !== "vector") {
      continue;
    }

    const childPathNodes = document.nodes.filter((childNode) => {
      return childNode.parentId === node.id && childNode.type === "path";
    });

    geometryById.set(
      node.id,
      buildVectorRenderGeometry(node, childPathNodes, (pathNode) => {
        return geometryById.get(pathNode.id) || null;
      })
    );
  }

  return geometryById;
};

const withDocumentMetadata = (svg, document) => {
  const metadata = [
    "<metadata>",
    `<punchpress-document version="${document.version}">`,
    escapeMetadata(JSON.stringify(document)),
    "</punchpress-document>",
    "</metadata>",
  ].join("");

  return svg.replace("</svg>", `${metadata}</svg>`);
};

export const exportDesignDocument = async (
  document: DesignDocument,
  loadFont: (font: TextNodeDocument["font"]) => Promise<unknown>
) => {
  const nodes = document.nodes.filter((node) => shouldExportNode(document, node));
  const geometryById = await buildGeometryById(document, loadFont);
  const svg = buildSvgExport(nodes, geometryById);

  return withDocumentMetadata(svg, document);
};

export const exportArtboardSvg = async (
  document: DesignDocument,
  artboardId: string,
  loadFont: (font: TextNodeDocument["font"]) => Promise<unknown>
) => {
  const artboard = document.nodes.find((node) => node.id === artboardId);

  if (artboard?.type !== "artboard") {
    return null;
  }

  const nodes = document.nodes.filter((node) => {
    return (
      node.id !== artboard.id &&
      isDescendantOf(document.nodes, node.id, artboard.id) &&
      shouldExportNode(document, node)
    );
  });
  const geometryById = await buildGeometryById(document, loadFont);
  const svg = buildSvgExport(nodes, geometryById, {
    background: artboard.background,
    height: artboard.height,
    offsetX: artboard.transform.x,
    offsetY: artboard.transform.y,
    width: artboard.width,
  });

  return withDocumentMetadata(svg, document);
};
