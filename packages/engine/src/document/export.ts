import type { DesignDocument, TextNodeDocument } from "@punchpress/punch-schema";
import { isDescendantOf } from "../nodes/node-tree";
import { buildNodeGeometry } from "../shapes/warp-text/warp-engine";
import { buildSvgExport } from "../shapes/warp-text/warp-svg-export";

const escapeMetadata = (value: string) => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
};

export const exportDesignDocument = async (
  document: DesignDocument,
  loadFont: (font: TextNodeDocument["font"]) => Promise<unknown>
) => {
  const nodes = document.nodes.filter((node): node is TextNodeDocument => {
    if (node.type !== "text" || node.visible === false) {
      return false;
    }

    return !document.nodes.some((ancestorNode) => {
      return (
        ancestorNode.id !== node.id &&
        ancestorNode.visible === false &&
        isDescendantOf(document.nodes, node.id, ancestorNode.id)
      );
    });
  });
  const fontPromises = new Map<string, ReturnType<typeof loadFont>>();
  const geometryById = new Map();

  for (const node of nodes) {
    if (!fontPromises.has(node.font.postscriptName)) {
      fontPromises.set(node.font.postscriptName, loadFont(node.font));
    }

    const font = await fontPromises.get(node.font.postscriptName);
    geometryById.set(node.id, buildNodeGeometry(node, font));
  }

  const svg = buildSvgExport(nodes, geometryById);
  const metadata = [
    "<metadata>",
    `<punchpress-document version="${document.version}">`,
    escapeMetadata(JSON.stringify(document)),
    "</punchpress-document>",
    "</metadata>",
  ].join("");

  return svg.replace("</svg>", `${metadata}</svg>`);
};
