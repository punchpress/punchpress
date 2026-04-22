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
import { exportDesignDocument } from "./export";

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

export const loadDocument = (editor, contents) => {
  const { nodes } = loadDesignDocument(contents);
  const resolution = replaceMissingDocumentFonts(
    toInternalEditorNodes(nodes),
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
