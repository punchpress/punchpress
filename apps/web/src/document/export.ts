import {
  buildNodeGeometry,
  buildSvgExport,
} from "../editor/shapes/warp-text/warp-engine";
import type { DesignDocument } from "./schema";

const escapeMetadata = (value: string) => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
};

export const exportDesignDocument = async (
  document: DesignDocument,
  loadFont: (font: DesignDocument["nodes"][number]["font"]) => Promise<unknown>
) => {
  const nodes = document.nodes.filter((node) => node.visible !== false);
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
