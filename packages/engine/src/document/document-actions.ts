import {
  getMissingDocumentFonts,
  loadDesignDocument,
  MissingDocumentFontsError,
  replaceMissingDocumentFonts,
  saveDesignDocument,
} from "@punchpress/punch-schema";
import { finishEditingIfNeeded } from "../editing/editing-actions";
import {
  toInternalEditorNodes,
  toSerializableDocumentNodes,
} from "../nodes/vector/vector-document-conversion";
import {
  absorbInlineTileSources,
  inlineTileSources,
} from "../raster/raster-tile-transport";
import { exportArtboardSvg, exportDesignDocument } from "./export";

export const getDocument = (editor) => {
  if (editor.editingNodeId) {
    editor.finalizeEditing();
  }

  return saveDesignDocument(toSerializableDocumentNodes(editor.nodes)).document;
};

/**
 * Export reads a self-contained document: tile manifests get their inline
 * data URLs back from the asset store so exported markup (and its embedded
 * document metadata) renders outside this session.
 */
const getExportDocument = (editor) => {
  const document = getDocument(editor);

  return {
    ...document,
    nodes: inlineTileSources(editor.rasterAssets, document.nodes),
  };
};

export const exportDocument = (editor) => {
  const missingFonts = getMissingDocumentFonts(
    editor.nodes,
    editor.availableFonts
  );

  if (missingFonts.length > 0) {
    throw new MissingDocumentFontsError(missingFonts);
  }

  return exportDesignDocument(getExportDocument(editor), (font) =>
    editor.fonts.loadFontForExport(font)
  );
};

export const exportSelectedArtboardSvg = (editor, artboardId = editor.selectedNodeId) => {
  const node = editor.getNode(artboardId);

  if (node?.type !== "artboard") {
    return null;
  }

  const missingFonts = getMissingDocumentFonts(
    editor.nodes,
    editor.availableFonts
  );

  if (missingFonts.length > 0) {
    throw new MissingDocumentFontsError(missingFonts);
  }

  return exportArtboardSvg(getExportDocument(editor), node.id, (font) =>
    editor.fonts.loadFontForExport(font)
  );
};

export const loadDocument = (editor, contents) => {
  const { nodes } = loadDesignDocument(contents);
  const resolution = replaceMissingDocumentFonts(
    absorbInlineTileSources(editor.rasterAssets, toInternalEditorNodes(nodes)),
    editor.availableFonts,
    editor.getDefaultFont()
  );

  editor.getState().loadNodes(resolution.nodes);
  editor.resetHistory();
  editor.resetPasteSequence();

  if (typeof window !== "undefined") {
    editor.scheduleViewportFocus(resolution.nodes.map((node) => node.id));
  }

  return resolution;
};

export const newDocument = (editor) => {
  finishEditingIfNeeded(editor);
  editor.getState().loadNodes([]);
  editor.resetHistory();
  editor.resetPasteSequence();
};

export const serializeDocument = (editor) => {
  return saveDesignDocument(toSerializableDocumentNodes(editor.nodes)).contents;
};
