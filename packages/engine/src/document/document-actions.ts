import {
  getMissingDocumentFonts,
  loadDesignDocument,
  MissingDocumentFontsError,
  saveDesignDocument,
} from "@punchpress/punch-schema";
import { finishEditingIfNeeded } from "../editing/editing-actions";
import {
  toInternalEditorNodes,
  toSerializableDocumentNodes,
} from "../nodes/vector/vector-document-conversion";
import { exportArtboardSvg, exportDesignDocument } from "./export";

export const getDocument = (editor) => {
  if (editor.editingNodeId) {
    editor.finalizeEditing();
  }

  return saveDesignDocument(toSerializableDocumentNodes(editor.nodes)).document;
};

export const exportDocument = (editor) => {
  const missingFonts = getMissingDocumentFonts(
    editor.nodes,
    editor.availableFonts
  );

  if (missingFonts.length > 0) {
    throw new MissingDocumentFontsError(missingFonts);
  }

  return exportDesignDocument(getDocument(editor), (font) =>
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

  return exportArtboardSvg(getDocument(editor), node.id, (font) =>
    editor.fonts.loadFontForExport(font)
  );
};

export const loadDocument = (editor, contents) => {
  const { nodes } = loadDesignDocument(contents);
  const internalNodes = toInternalEditorNodes(nodes);
  const resolution = {
    catalogState: editor.fontCatalogState,
    missingFonts: getMissingDocumentFonts(internalNodes, editor.availableFonts),
    replacementFont: null,
  };

  editor.getState().loadNodes(internalNodes);
  editor.resetHistory();
  editor.resetPasteSequence();

  if (typeof window !== "undefined") {
    editor.scheduleViewportFocus(internalNodes.map((node) => node.id));
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
