import opentype from "opentype.js";
import {
  buildNodeGeometry,
  buildSvgExport,
} from "../editor/shapes/warp-text/warp-engine";
import type { DesignDocument } from "./schema";

const loadFont = (url: string) => {
  return new Promise((resolve, reject) => {
    opentype.load(url, (error, font) => {
      if (error || !font) {
        reject(error || new Error(`Unable to load font: ${url}`));
        return;
      }

      resolve(font);
    });
  });
};

const escapeMetadata = (value: string) => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
};

export const exportDesignDocument = async (document: DesignDocument) => {
  const nodes = document.nodes.filter((node) => node.visible !== false);
  const fontPromises = new Map<string, ReturnType<typeof loadFont>>();
  const geometryById = new Map();

  for (const node of nodes) {
    if (!fontPromises.has(node.fontUrl)) {
      fontPromises.set(node.fontUrl, loadFont(node.fontUrl));
    }

    const font = await fontPromises.get(node.fontUrl);
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
